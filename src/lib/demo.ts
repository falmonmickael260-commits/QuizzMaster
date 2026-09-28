// État fictif du plateau : vitrine de l'écran d'accueil et prévisualisation des phases (?demo=question…).
// Purement visuel : aucune donnée de ce fichier n'est envoyée au serveur.

import { CHARACTERS } from "@shared/characters";
import type { Phase, PlayerModifiers, PublicPlayer, PublicRoomState } from "@shared/types";

const NAMES = ["Nova", "Rocco", "Maya", "Hugo", "Yuna", "Sam", "Lily", "Karim"];
const SCORES = [2450, 2100, 1950, 1800, 1600, 1400, 1200, 950];
const mods = (): PlayerModifiers => ({ pointsMultiplier: 1, timeDeltaSec: 0, pending: { pointsMultiplier: 1, timeDeltaSec: 0 }, shield: false });

export const DEMO_CODE = "DEMO";

export function demoState(phase: Phase | "attract", start: number, now: number): PublicRoomState {
  const players: PublicPlayer[] = NAMES.map((name, i) => ({
    id: `demo-${i}`,
    name,
    character: CHARACTERS[i].id,
    seat: i,
    score: SCORES[i],
    connected: true,
    isHost: i === 0,
    bot: i > 0,
    autopilot: false,
    mode: null,
    answered: false,
    deadline: null,
    modifiers: mods(),
    roundScore: 0,
    lastResult: null,
  }));
  const ranking = players.map((p, i) => ({ playerId: p.id, rank: i + 1, score: p.score, previousRank: i + 1, previousScore: p.score, roundScore: 0 }));
  const base: PublicRoomState = {
    code: DEMO_CODE,
    phase: phase === "attract" ? "lobby" : phase,
    phaseStartedAt: start,
    phaseEndsAt: null,
    settings: { rounds: 3 },
    round: phase === "attract" || phase === "lobby" ? 0 : 2,
    totalRounds: 3,
    questionNumber: 8,
    totalQuestions: 15,
    players,
    question: null,
    reveal: null,
    ranking,
    wheel: null,
    events: [],
    serverNow: now,
  };
  const question = {
    index: 7,
    inRound: 2,
    text: "Quelle est la planète la plus chaude du système solaire ?",
    category: "espace",
    difficulty: 3 as const,
    startsAt: start + 1500,
    endsAt: start + 13_500,
  };
  if (phase === "question") {
    const modes = ["solo", "2", "4", null, "2", "solo", "4", null] as const;
    players.forEach((p, i) => {
      p.mode = modes[i];
      p.answered = !!p.mode && i % 3 === 0;
      p.deadline = question.endsAt;
    });
    return { ...base, question };
  }
  if (phase === "reveal") {
    const results = Object.fromEntries(
      players.map((p, i) => {
        const mode = (["solo", "2", "4", null, "2", "solo", "4", "2"] as const)[i];
        const correct = [true, true, false, false, true, false, true, false][i];
        const pts = correct && mode ? { solo: 200, "2": 50, "4": 100 }[mode] : 0;
        p.lastResult = { questionIndex: 7, mode, answer: correct ? "Vénus" : "Mercure", correct, points: pts, basePoints: pts, multiplier: 1, timedOut: !mode };
        p.mode = mode;
        p.answered = !!mode;
        return [p.id, p.lastResult];
      }),
    );
    return {
      ...base,
      question,
      reveal: { questionIndex: 7, correctAnswer: "Vénus", explanation: "Piège : ce n'est pas Mercure ! L'effet de serre de Vénus fait monter sa surface à environ 465 °C.", results },
    };
  }
  if (phase === "leaderboard") {
    const shuffled = [...ranking].map((r, i) => ({ ...r, previousRank: [3, 1, 2, 5, 4, 8, 6, 7][i], previousScore: r.score - [600, 200, 300, 250, 150, 50, 200, 100][i], roundScore: [600, 200, 300, 250, 150, 50, 200, 100][i] }));
    players.forEach((p, i) => (p.roundScore = shuffled[i].roundScore));
    return { ...base, ranking: shuffled };
  }
  if (phase === "wheel") {
    const t = now - start;
    const stage = t < 2500 ? "waiting_spin" : t < 9000 ? "spinning" : t < 12000 ? "choose_target" : "result";
    return {
      ...base,
      wheel: {
        stage,
        spinnerId: "demo-0",
        resultIndex: stage === "waiting_spin" ? null : 1,
        spinStartedAt: start + 2500,
        spinDurationMs: 6500,
        spinTurns: 5,
        targetId: stage === "result" ? "demo-1" : null,
        outcome: stage === "result" ? { segmentId: "malus300", text: "Rocco perd 300 points !", affectedIds: ["demo-1"], blockedByShield: false, scoreChanges: { "demo-1": -300 } } : null,
      },
    };
  }
  if (phase === "final") return { ...base, questionNumber: 15 };
  return base;
}
