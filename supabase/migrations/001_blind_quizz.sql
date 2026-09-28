-- BLIND QUIZZ — schéma Supabase
-- Questions + statistiques, et historique des parties.
-- Tous les objets sont préfixés « bq_ » pour cohabiter avec d'autres applications dans le même projet.

create table if not exists public.bq_questions (
  id text primary key,
  question text not null,
  category text not null,
  difficulty smallint not null check (difficulty between 1 and 4),
  correct_answer text not null,
  accepted_answers text[] not null default '{}',
  wrong_answers text[] not null check (array_length(wrong_answers, 1) >= 3),
  explanation text not null,
  status text not null default 'draft' check (status in ('published', 'draft', 'disabled')),
  source text not null default 'admin' check (source in ('seed', 'admin', 'ai', 'import')),
  -- statistiques
  times_used integer not null default 0,
  answers integer not null default 0,
  correct integer not null default 0,
  timeouts integer not null default 0,
  by_mode jsonb not null default '{"4":{"answers":0,"correct":0},"2":{"answers":0,"correct":0},"solo":{"answers":0,"correct":0}}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bq_questions_status_idx on public.bq_questions (status);
create index if not exists bq_questions_category_idx on public.bq_questions (category);
create index if not exists bq_questions_difficulty_idx on public.bq_questions (difficulty);

-- Taux de réussite calculé (pour repérer les questions trop faciles / trop difficiles)
create or replace view public.bq_question_success with (security_invoker = true) as
  select id, category, difficulty, times_used, answers, correct,
         case when answers > 0 then round(correct::numeric / answers, 3) end as success_rate
  from public.bq_questions;

-- Incréments atomiques appelés par le serveur de jeu
create or replace function public.bq_record_usage(ids text[]) returns void
language sql security definer set search_path = public as $$
  update public.bq_questions set times_used = times_used + 1 where id = any(ids);
$$;

create or replace function public.bq_record_answers(qid text, stats jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  m text;
begin
  update public.bq_questions set
    answers = answers + coalesce((stats->>'answers')::int, 0),
    correct = correct + coalesce((stats->>'correct')::int, 0),
    timeouts = timeouts + coalesce((stats->>'timeouts')::int, 0)
  where id = qid;
  for m in select jsonb_object_keys(coalesce(stats->'byMode', '{}'::jsonb)) loop
    update public.bq_questions set by_mode = jsonb_set(
      jsonb_set(by_mode, array[m, 'answers'], to_jsonb(coalesce((by_mode->m->>'answers')::int, 0) + (stats->'byMode'->m->>'answers')::int)),
      array[m, 'correct'], to_jsonb(coalesce((by_mode->m->>'correct')::int, 0) + (stats->'byMode'->m->>'correct')::int))
    where id = qid;
  end loop;
end;
$$;

-- Historique des parties (classements finaux)
create table if not exists public.bq_games (
  id uuid primary key default gen_random_uuid(),
  room_code text not null,
  rounds smallint not null,
  players jsonb not null,
  finished_at timestamptz not null default now()
);

-- Sécurité : lecture/écriture réservées au serveur (clé service_role).
-- Le navigateur n'accède jamais directement aux questions (sinon les bonnes réponses fuiteraient).
alter table public.bq_questions enable row level security;
alter table public.bq_games enable row level security;

-- Les fonctions d'incrément ne sont appelables que par le serveur (service_role).
revoke execute on function public.bq_record_usage(text[]) from public, anon, authenticated;
revoke execute on function public.bq_record_answers(text, jsonb) from public, anon, authenticated;
grant execute on function public.bq_record_usage(text[]) to service_role;
grant execute on function public.bq_record_answers(text, jsonb) to service_role;
