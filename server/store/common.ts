import type { Question } from "../../shared/types";
import { normalizeAnswer } from "../game/answer";
import type { QuestionFilter, QuestionPage } from "./types";

export function successRate(q: Question): number | null {
  return q.stats.answers ? q.stats.correct / q.stats.answers : null;
}

export function applyFilter(all: Question[], f: QuestionFilter): QuestionPage {
  let list = all;
  if (f.category) list = list.filter((q) => q.category === f.category);
  if (f.difficulty) list = list.filter((q) => q.difficulty === f.difficulty);
  if (f.status) list = list.filter((q) => q.status === f.status);
  if (f.search) {
    const s = normalizeAnswer(f.search);
    list = list.filter((q) =>
      normalizeAnswer([q.question, q.correctAnswer, ...q.wrongAnswers, q.explanation, q.id].join(" ")).includes(s),
    );
  }
  const sort = f.sort ?? "updated";
  list = [...list].sort((a, b) => {
    switch (sort) {
      case "difficulty":
        return a.difficulty - b.difficulty || a.question.localeCompare(b.question);
      case "successRate":
        return (successRate(a) ?? 2) - (successRate(b) ?? 2);
      case "used":
        return b.stats.timesUsed - a.stats.timesUsed;
      case "category":
        return a.category.localeCompare(b.category) || a.difficulty - b.difficulty;
      default:
        return b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id);
    }
  });
  const offset = Math.max(0, f.offset ?? 0);
  const limit = Math.min(500, Math.max(1, f.limit ?? 50));
  return { total: list.length, items: list.slice(offset, offset + limit) };
}

export function summarize(all: Question[]) {
  const byCategory: Record<string, number> = {};
  const byDifficulty: Record<string, number> = {};
  let published = 0;
  let draft = 0;
  let disabled = 0;
  for (const q of all) {
    if (q.status === "published") published++;
    else if (q.status === "draft") draft++;
    else disabled++;
    if (q.status === "published") {
      byCategory[q.category] = (byCategory[q.category] ?? 0) + 1;
      byDifficulty[q.difficulty] = (byDifficulty[q.difficulty] ?? 0) + 1;
    }
  }
  return { total: all.length, published, draft, disabled, byCategory, byDifficulty };
}
