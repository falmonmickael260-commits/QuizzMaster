import { CATEGORY_BY_ID } from "../../shared/categories";
import type { Difficulty, QuestionStatus } from "../../shared/types";
import { normalizeAnswer } from "../game/answer";
import type { QuestionInput } from "./types";

const STATUSES: QuestionStatus[] = ["published", "draft", "disabled"];

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Valide et nettoie une question saisie (admin, import, génération IA). Lève une erreur lisible sinon. */
export function validateQuestionInput(raw: unknown, partial = false): Partial<QuestionInput> {
  const r = (raw ?? {}) as Record<string, unknown>;
  const out: Partial<QuestionInput> = {};
  const errors: string[] = [];

  if (!partial || "question" in r) {
    out.question = str(r.question, 300);
    if (out.question.length < 8) errors.push("question trop courte");
  }
  if (!partial || "category" in r) {
    out.category = str(r.category, 40);
    if (!CATEGORY_BY_ID[out.category]) errors.push(`catégorie inconnue « ${out.category} »`);
  }
  if (!partial || "difficulty" in r) {
    const d = Number(r.difficulty);
    if (![1, 2, 3, 4].includes(d)) errors.push("difficulté entre 1 et 4");
    out.difficulty = d as Difficulty;
  }
  if (!partial || "correctAnswer" in r) {
    out.correctAnswer = str(r.correctAnswer, 80);
    if (!out.correctAnswer) errors.push("bonne réponse manquante");
  }
  if (!partial || "wrongAnswers" in r) {
    const w = Array.isArray(r.wrongAnswers) ? r.wrongAnswers.map((x) => str(x, 80)).filter(Boolean) : [];
    if (w.length < 3) errors.push("3 mauvaises réponses crédibles sont nécessaires");
    out.wrongAnswers = w.slice(0, 3);
  }
  if (!partial || "acceptedAnswers" in r) {
    out.acceptedAnswers = Array.isArray(r.acceptedAnswers) ? r.acceptedAnswers.map((x) => str(x, 80)).filter(Boolean).slice(0, 12) : [];
  }
  if (!partial || "explanation" in r) {
    out.explanation = str(r.explanation, 400);
    if (out.explanation.length < 10) errors.push("explication trop courte");
  }
  if ("status" in r && r.status !== undefined) {
    if (!STATUSES.includes(r.status as QuestionStatus)) errors.push("statut invalide");
    out.status = r.status as QuestionStatus;
  }
  if ("id" in r && typeof r.id === "string" && r.id) out.id = r.id.slice(0, 64);
  if ("source" in r && ["seed", "admin", "ai", "import"].includes(r.source as string)) out.source = r.source as QuestionInput["source"];

  if (out.correctAnswer && out.wrongAnswers) {
    const c = normalizeAnswer(out.correctAnswer);
    const norm = out.wrongAnswers.map(normalizeAnswer);
    if (norm.includes(c)) errors.push("une mauvaise réponse est identique à la bonne");
    if (new Set(norm).size !== norm.length) errors.push("mauvaises réponses en double");
  }
  if (errors.length) throw new Error(errors.join(", "));
  return out;
}
