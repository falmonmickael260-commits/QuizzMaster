import type { Difficulty } from "../../shared/types";

/**
 * Format compact d'une question de la base initiale :
 * [question, bonneRéponse, [3 mauvaises réponses crédibles — la 1re est la plus crédible], explication, difficulté, variantesAcceptées?]
 */
export type SeedTuple = [
  question: string,
  correct: string,
  wrong: [string, string, string],
  explanation: string,
  difficulty: Difficulty,
  accepted?: string[],
];

export interface SeedQuestion {
  id: string;
  question: string;
  category: string;
  difficulty: Difficulty;
  correctAnswer: string;
  acceptedAnswers: string[];
  wrongAnswers: string[];
  explanation: string;
}

/** Hash FNV-1a court et stable : l'id ne change pas si l'on réordonne les fichiers. */
export function stableId(category: string, text: string): string {
  let h = 0x811c9dc5;
  const s = `${category}|${text}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `${category}-${(h >>> 0).toString(36)}`;
}

export function build(category: string, tuples: SeedTuple[]): SeedQuestion[] {
  return tuples.map(([question, correct, wrong, explanation, difficulty, accepted]) => ({
    id: stableId(category, question),
    question,
    category,
    difficulty,
    correctAnswer: correct,
    acceptedAnswers: accepted ?? [],
    wrongAnswers: [...wrong],
    explanation,
  }));
}
