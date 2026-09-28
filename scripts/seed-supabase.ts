// Charge la base initiale de questions dans Supabase (table public.bq_questions).
// Prérequis : migration supabase/migrations/001_blind_quizz.sql appliquée,
// SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY définis.
//
//   npm run supabase:seed

import { createClient } from "@supabase/supabase-js";
import { SEED_QUESTIONS } from "../data/questions";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Définissez SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false } });

const rows = SEED_QUESTIONS.map((q) => ({
  id: q.id,
  question: q.question,
  category: q.category,
  difficulty: q.difficulty,
  correct_answer: q.correctAnswer,
  accepted_answers: q.acceptedAnswers,
  wrong_answers: q.wrongAnswers,
  explanation: q.explanation,
  status: "published",
  source: "seed",
}));

let done = 0;
for (let i = 0; i < rows.length; i += 200) {
  // ignoreDuplicates : ne remplace jamais une question déjà modifiée dans la régie
  const { error } = await db.from("bq_questions").upsert(rows.slice(i, i + 200), { onConflict: "id", ignoreDuplicates: true });
  if (error) {
    console.error(error.message);
    process.exit(1);
  }
  done += Math.min(200, rows.length - i);
}
console.log(`${done} questions envoyées vers Supabase (les questions existantes ont été conservées).`);
