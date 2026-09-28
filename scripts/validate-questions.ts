// Contrôle qualité de la base initiale : doublons, réponses incohérentes, répartition.
import { SEED_QUESTIONS } from "../data/questions";
import { CATEGORY_BY_ID } from "../shared/categories";
import { normalizeAnswer, isAnswerCorrect } from "../server/game/answer";
import { validateQuestionInput } from "../server/store/validate";

const errors: string[] = [];
const ids = new Set<string>();
const texts = new Map<string, string>();
const byCat: Record<string, number> = {};
const byDiff: Record<number, number> = {};

for (const q of SEED_QUESTIONS) {
  if (ids.has(q.id)) errors.push(`id en double : ${q.id}`);
  ids.add(q.id);
  const t = normalizeAnswer(q.question);
  if (texts.has(t)) errors.push(`question en double : « ${q.question} »`);
  texts.set(t, q.id);
  if (!CATEGORY_BY_ID[q.category]) errors.push(`catégorie inconnue ${q.category}`);
  try {
    validateQuestionInput(q);
  } catch (e) {
    errors.push(`${q.id} « ${q.question} » : ${(e as Error).message}`);
  }
  if (q.wrongAnswers.length !== 3) errors.push(`${q.id} : ${q.wrongAnswers.length} mauvaises réponses`);
  if (!isAnswerCorrect(q.correctAnswer, q.correctAnswer, q.acceptedAnswers)) errors.push(`${q.id} : la bonne réponse ne se valide pas elle-même`);
  for (const w of q.wrongAnswers) {
    if (isAnswerCorrect(w, q.correctAnswer, q.acceptedAnswers)) errors.push(`${q.id} : la mauvaise réponse « ${w} » serait acceptée en SOLO`);
  }
  if (q.question.length > 140) errors.push(`${q.id} : question longue (${q.question.length} car.)`);
  if (q.correctAnswer.length > 40) errors.push(`${q.id} : bonne réponse longue « ${q.correctAnswer} »`);
  byCat[q.category] = (byCat[q.category] ?? 0) + 1;
  byDiff[q.difficulty] = (byDiff[q.difficulty] ?? 0) + 1;
}

console.log(`${SEED_QUESTIONS.length} questions`);
console.log("Par difficulté :", byDiff);
console.log("Par catégorie :", byCat);
if (errors.length) {
  console.error(`\n${errors.length} problème(s) :\n- ${errors.join("\n- ")}`);
  process.exit(1);
}
console.log("\nAucun problème détecté ✔");
