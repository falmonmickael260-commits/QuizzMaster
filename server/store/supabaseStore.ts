import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import crypto from "node:crypto";
import type { AnswerMode } from "../../shared/config";
import type { Question } from "../../shared/types";
import { applyFilter, summarize } from "./common";
import type { QuestionFilter, QuestionInput, QuestionPage, QuestionStore } from "./types";

interface Row {
  id: string;
  question: string;
  category: string;
  difficulty: number;
  correct_answer: string;
  accepted_answers: string[];
  wrong_answers: string[];
  explanation: string;
  status: Question["status"];
  source: Question["source"];
  times_used: number;
  answers: number;
  correct: number;
  timeouts: number;
  by_mode: Question["stats"]["byMode"];
  created_at: string;
  updated_at: string;
}

export function rowToQuestion(r: Row): Question {
  return {
    id: r.id,
    question: r.question,
    category: r.category,
    difficulty: r.difficulty as Question["difficulty"],
    correctAnswer: r.correct_answer,
    acceptedAnswers: r.accepted_answers ?? [],
    wrongAnswers: r.wrong_answers,
    explanation: r.explanation,
    status: r.status,
    source: r.source,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    stats: { timesUsed: r.times_used, answers: r.answers, correct: r.correct, timeouts: r.timeouts, byMode: r.by_mode },
  };
}

export function inputToRow(q: Partial<QuestionInput>): Partial<Row> {
  const row: Partial<Row> = {};
  if (q.id !== undefined) row.id = q.id;
  if (q.question !== undefined) row.question = q.question;
  if (q.category !== undefined) row.category = q.category;
  if (q.difficulty !== undefined) row.difficulty = q.difficulty;
  if (q.correctAnswer !== undefined) row.correct_answer = q.correctAnswer;
  if (q.acceptedAnswers !== undefined) row.accepted_answers = q.acceptedAnswers;
  if (q.wrongAnswers !== undefined) row.wrong_answers = q.wrongAnswers;
  if (q.explanation !== undefined) row.explanation = q.explanation;
  if (q.status !== undefined) row.status = q.status;
  if (q.source !== undefined) row.source = q.source;
  return row;
}

/**
 * Stockage Supabase (Postgres). Le serveur de jeu utilise la clé service_role :
 * les questions et bonnes réponses ne transitent jamais directement vers le navigateur.
 * Un cache mémoire de 60 s évite de recharger toute la base à chaque partie.
 */
export class SupabaseQuestionStore implements QuestionStore {
  readonly kind = "supabase" as const;
  private db: SupabaseClient;
  private cache: { at: number; list: Question[] } | null = null;

  constructor(url: string, serviceKey: string) {
    this.db = createClient(url, serviceKey, { auth: { persistSession: false } });
  }

  async init() {
    const { error } = await this.db.from("questions").select("id", { count: "exact", head: true });
    if (error) throw new Error(`Supabase inaccessible : ${error.message}`);
  }

  private async all(force = false): Promise<Question[]> {
    if (!force && this.cache && Date.now() - this.cache.at < 60_000) return this.cache.list;
    const out: Question[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await this.db.from("questions").select("*").range(from, from + 999);
      if (error) throw new Error(error.message);
      out.push(...(data as Row[]).map(rowToQuestion));
      if (!data || data.length < 1000) break;
    }
    this.cache = { at: Date.now(), list: out };
    return out;
  }

  async list(filter: QuestionFilter): Promise<QuestionPage> {
    return applyFilter(await this.all(true), filter);
  }

  async get(id: string) {
    const { data, error } = await this.db.from("questions").select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? rowToQuestion(data as Row) : null;
  }

  async create(input: QuestionInput) {
    const row = inputToRow({ status: "draft", source: "admin", ...input });
    row.id = input.id ?? `${input.category}-${crypto.randomBytes(5).toString("hex")}`;
    const { data, error } = await this.db.from("questions").insert(row).select("*").single();
    if (error) throw new Error(error.message);
    this.cache = null;
    return rowToQuestion(data as Row);
  }

  async update(id: string, patch: Partial<QuestionInput>) {
    const { id: _ignored, ...rest } = patch;
    const row = { ...inputToRow(rest), updated_at: new Date().toISOString() };
    const { data, error } = await this.db.from("questions").update(row).eq("id", id).select("*").single();
    if (error) throw new Error(error.message);
    this.cache = null;
    return rowToQuestion(data as Row);
  }

  async remove(id: string) {
    const { error } = await this.db.from("questions").delete().eq("id", id);
    if (error) throw new Error(error.message);
    this.cache = null;
  }

  async getPlayablePool() {
    return (await this.all()).filter((q) => q.status === "published");
  }

  async recordUsage(ids: string[]) {
    await this.db.rpc("bq_record_usage", { ids });
  }

  async recordAnswers(id: string, results: { mode: AnswerMode | null; correct: boolean }[]) {
    const stats = { answers: 0, correct: 0, timeouts: 0, byMode: {} as Record<string, { answers: number; correct: number }> };
    for (const r of results) {
      if (!r.mode) {
        stats.timeouts++;
        continue;
      }
      stats.answers++;
      const m = (stats.byMode[r.mode] ??= { answers: 0, correct: 0 });
      m.answers++;
      if (r.correct) {
        stats.correct++;
        m.correct++;
      }
    }
    await this.db.rpc("bq_record_answers", { qid: id, stats });
  }

  async summary() {
    return summarize(await this.all(true));
  }
}
