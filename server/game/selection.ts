import type { Difficulty, Question } from "../../shared/types";

type Rng = () => number;

/** Répartition des difficultés selon l'avancée de la partie (0 = début, 1 = fin). */
function difficultyWeights(progress: number): Record<Difficulty, number> {
  const start = { 1: 0.45, 2: 0.35, 3: 0.15, 4: 0.05 };
  const end = { 1: 0.12, 2: 0.33, 3: 0.35, 4: 0.2 };
  const lerp = (a: number, b: number) => a + (b - a) * progress;
  return { 1: lerp(start[1], end[1]), 2: lerp(start[2], end[2]), 3: lerp(start[3], end[3]), 4: lerp(start[4], end[4]) };
}

function pickWeighted<T extends string | number>(weights: Record<T, number>, rng: Rng): T {
  const entries = Object.entries(weights) as [T, number][];
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = rng() * total;
  for (const [k, w] of entries) {
    r -= w;
    if (r <= 0) return k;
  }
  return entries[entries.length - 1][0];
}

/**
 * Sélectionne `count` questions pour une partie :
 * - jamais deux fois la même question, en évitant celles déjà jouées dans la room ;
 * - difficulté progressive au fil des manches ;
 * - jamais deux fois de suite la même catégorie et au plus 2 questions par catégorie (si possible).
 */
export function selectQuestions(pool: Question[], count: number, excludeIds: Set<string>, rng: Rng = Math.random): Question[] {
  let available = pool.filter((q) => q.status === "published" && !excludeIds.has(q.id));
  if (available.length < count) available = pool.filter((q) => q.status === "published"); // base épuisée : on recycle
  const remaining = [...available];
  const chosen: Question[] = [];
  const perCategory = new Map<string, number>();

  for (let i = 0; i < count && remaining.length; i++) {
    const progress = count <= 1 ? 0 : i / (count - 1);
    const lastCat = chosen[chosen.length - 1]?.category;
    const wanted = Number(pickWeighted(difficultyWeights(progress), rng)) as Difficulty;
    const filters: ((q: Question) => boolean)[] = [
      (q) => q.difficulty === wanted && q.category !== lastCat && (perCategory.get(q.category) ?? 0) < 2,
      (q) => Math.abs(q.difficulty - wanted) <= 1 && q.category !== lastCat && (perCategory.get(q.category) ?? 0) < 2,
      (q) => q.category !== lastCat,
      () => true,
    ];
    let candidates: Question[] = [];
    for (const f of filters) {
      candidates = remaining.filter(f);
      if (candidates.length) break;
    }
    const q = candidates[Math.floor(rng() * candidates.length)];
    chosen.push(q);
    perCategory.set(q.category, (perCategory.get(q.category) ?? 0) + 1);
    remaining.splice(remaining.indexOf(q), 1);
  }
  return chosen;
}

export function shuffle<T>(arr: T[], rng: Rng = Math.random): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
