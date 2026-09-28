import type { AnswerMode } from "./config";

// ─── Questions ───────────────────────────────────────────────────────────────

export type Difficulty = 1 | 2 | 3 | 4;
export type QuestionStatus = "published" | "draft" | "disabled";

export interface ModeStats {
  answers: number;
  correct: number;
}

export interface QuestionStats {
  /** Nombre de parties dans lesquelles la question a été posée. */
  timesUsed: number;
  /** Nombre de réponses données (tous modes). */
  answers: number;
  /** Nombre de bonnes réponses. */
  correct: number;
  /** Nombre de joueurs n'ayant pas répondu à temps. */
  timeouts: number;
  byMode: Record<AnswerMode, ModeStats>;
}

export interface Question {
  id: string;
  question: string;
  category: string;
  difficulty: Difficulty;
  correctAnswer: string;
  /** Variantes acceptées en mode SOLO (en plus de correctAnswer). */
  acceptedAnswers: string[];
  /** Mauvaises réponses crédibles, de la plus crédible à la moins crédible. La 1re sert au mode 2 réponses. */
  wrongAnswers: string[];
  explanation: string;
  status: QuestionStatus;
  source: "seed" | "admin" | "ai" | "import";
  createdAt: string;
  updatedAt: string;
  stats: QuestionStats;
}

export function emptyStats(): QuestionStats {
  return {
    timesUsed: 0,
    answers: 0,
    correct: 0,
    timeouts: 0,
    byMode: { "4": { answers: 0, correct: 0 }, "2": { answers: 0, correct: 0 }, solo: { answers: 0, correct: 0 } },
  };
}

// ─── État public d'une room (diffusé à tous) ─────────────────────────────────

export type Phase =
  | "lobby"
  | "intro"
  | "round_intro"
  | "question"
  | "reveal"
  | "leaderboard"
  | "wheel"
  | "final";

export type WheelStage = "intro" | "waiting_spin" | "spinning" | "choose_target" | "result";

export interface PlayerModifiers {
  /** Multiplicateur de points pour la manche en cours (1, 2 ou 0.5). */
  pointsMultiplier: number;
  /** Secondes ajoutées/retirées au chrono pour la manche en cours. */
  timeDeltaSec: number;
  /** Effets en attente pour la manche suivante. */
  pending: { pointsMultiplier: number; timeDeltaSec: number };
  shield: boolean;
}

export interface PublicPlayer {
  id: string;
  name: string;
  character: string;
  seat: number;
  score: number;
  connected: boolean;
  isHost: boolean;
  /** Candidat simulé par le serveur (partie de démonstration). */
  bot: boolean;
  /** Joueur humain dont le serveur joue les coups (pilote automatique). */
  autopilot: boolean;
  /** Mode choisi pendant la question en cours (visible par tous : « Sarah joue SOLO ! »). */
  mode: AnswerMode | null;
  answered: boolean;
  /** Échéance personnelle du chrono (timestamp serveur). */
  deadline: number | null;
  modifiers: PlayerModifiers;
  roundScore: number;
  lastResult: PlayerResult | null;
}

export interface PlayerResult {
  questionIndex: number;
  mode: AnswerMode | null;
  answer: string | null;
  correct: boolean;
  points: number;
  basePoints: number;
  multiplier: number;
  timedOut: boolean;
}

export interface PublicQuestion {
  index: number; // index global 0..N-1
  inRound: number; // 0..4
  text: string;
  category: string;
  difficulty: Difficulty;
  /** Timestamp serveur de démarrage du chrono (après l'annonce). */
  startsAt: number;
  endsAt: number; // fin du chrono de base (12 s)
}

export interface RevealInfo {
  questionIndex: number;
  correctAnswer: string;
  explanation: string;
  results: Record<string, PlayerResult>;
}

export interface RankingEntry {
  playerId: string;
  rank: number;
  score: number;
  previousRank: number;
  previousScore: number;
  roundScore: number;
}

export interface WheelState {
  stage: WheelStage;
  spinnerId: string;
  /** Index de la case gagnante (connu dès le lancement : le serveur décide, le client anime). */
  resultIndex: number | null;
  spinStartedAt: number | null;
  spinDurationMs: number;
  /** Nombre de tours complets avant l'arrêt (animation). */
  spinTurns: number;
  targetId: string | null;
  /** Texte d'effet appliqué, ex. « -300 à SARAH (bouclier !) » */
  outcome: WheelOutcome | null;
}

export interface WheelOutcome {
  segmentId: string;
  text: string;
  affectedIds: string[];
  blockedByShield: boolean;
  scoreChanges: Record<string, number>;
}

export interface RoomSettings {
  rounds: number;
}

export interface PublicRoomState {
  code: string;
  phase: Phase;
  phaseStartedAt: number;
  phaseEndsAt: number | null;
  settings: RoomSettings;
  round: number; // 1-based
  totalRounds: number;
  questionNumber: number; // 1-based global, 0 avant la 1re question
  totalQuestions: number;
  players: PublicPlayer[];
  question: PublicQuestion | null;
  reveal: RevealInfo | null;
  ranking: RankingEntry[];
  wheel: WheelState | null;
  /** Journal d'événements marquants (pour les réactions visuelles). */
  events: GameEvent[];
  serverNow: number;
}

export interface GameEvent {
  id: number;
  at: number;
  type: "join" | "leave" | "mode" | "answer" | "reveal" | "wheel_result" | "effect" | "winner" | "round_winner";
  playerId?: string;
  data?: Record<string, unknown>;
}

// ─── État privé (envoyé à un seul joueur) ────────────────────────────────────

export interface PrivateState {
  questionIndex: number | null;
  mode: AnswerMode | null;
  /** Propositions visibles par ce joueur selon son mode (vide en SOLO). */
  options: string[];
  answered: boolean;
  answer: string | null;
  deadline: number | null;
}

// ─── Messages réseau ─────────────────────────────────────────────────────────

export type ClientMessage =
  | { t: "create"; name: string; character: string; rounds?: number }
  | { t: "join"; code: string; name: string; character: string }
  | { t: "resume"; code: string; token: string }
  | { t: "start" }
  | { t: "settings"; rounds: number }
  | { t: "mode"; mode: AnswerMode }
  | { t: "answer"; value: string }
  | { t: "spin" }
  | { t: "target"; playerId: string }
  | { t: "restart" }
  | { t: "addBots"; count?: number }
  | { t: "removeBots" }
  | { t: "autopilot"; on: boolean }
  | { t: "leave" }
  | { t: "ping"; clientTime: number };

export type ServerMessage =
  | { t: "welcome"; playerId: string; token: string; state: PublicRoomState; private: PrivateState }
  | { t: "state"; state: PublicRoomState }
  | { t: "private"; private: PrivateState; serverNow: number }
  | { t: "error"; message: string; code?: string }
  | { t: "pong"; clientTime: number; serverNow: number };
