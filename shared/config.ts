// Règles et timings de BLIND QUIZZ — partagés entre le serveur (source de vérité) et le client (affichage).

export type AnswerMode = "4" | "2" | "solo";

// Barème officiel : 2 réponses = plus de sécurité (50), 4 réponses = plus de possibilités (100),
// SOLO = aucun filet de sécurité (200).
export const MODE_POINTS: Record<AnswerMode, number> = {
  "2": 50,
  "4": 100,
  solo: 200,
};

/** Ordre d'affichage des trois niveaux d'aide (touches 1, 2, 3). */
export const MODE_ORDER: AnswerMode[] = ["2", "4", "solo"];

export const MODE_LABELS: Record<AnswerMode, { title: string; subtitle: string; color: string; name: string }> = {
  "2": { title: "2", name: "2 RÉPONSES", subtitle: "Plus de sécurité", color: "#ff9f1c" },
  "4": { title: "4", name: "4 RÉPONSES", subtitle: "Plus de possibilités", color: "#3a86ff" },
  solo: { title: "SOLO", name: "SOLO", subtitle: "Aucun filet de sécurité", color: "#2ee59d" },
};

export const QUESTIONS_PER_ROUND = 5;
export const MAX_QUESTIONS = 30;
export const MIN_ROUNDS = 1;
export const MAX_ROUNDS = MAX_QUESTIONS / QUESTIONS_PER_ROUND; // 6
export const DEFAULT_ROUNDS = 3;
export const MAX_PLAYERS = 8;

/** Durées des phases (ms). Les 12 secondes englobent réflexion + choix de l'aide + réponse. */
export const TIMINGS = {
  questionMs: 12_000,
  introMs: 6_500,
  /** Annonce de la question par l'animateur avant que le chrono ne démarre. */
  questionAnnounceMs: 2_500,
  /** Délai de grâce réseau accepté après la fin du chrono (ne donne aucun temps au joueur, compense la latence). */
  networkGraceMs: 350,
  /** Inclut ~1,4 s d'écran « réponses verrouillées » avant la bonne réponse. */
  revealMs: 9_000,
  leaderboardMs: 7_000,
  wheelIntroMs: 3_500,
  wheelWaitSpinMs: 12_000,
  wheelSpinMs: 6_500,
  wheelTargetMs: 15_000,
  wheelResultMs: 5_000,
  roundIntroMs: 3_500,
};

/** Bornes des modificateurs de temps (en secondes) — le chrono ne descend jamais sous ce seuil. */
export const MIN_QUESTION_SECONDS = 7;

/** Début de la révélation : écran « réponses verrouillées » avant d'afficher la bonne réponse (ms). */
export const REVEAL_LOCK_MS = 1400;
