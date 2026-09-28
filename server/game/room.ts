// Moteur autoritaire d'une room BLIND QUIZZ.
// Le serveur décide de tout : questions, chrono, bonnes réponses, scores, classement, roue et effets.
// Les clients n'envoient que des intentions (choix du mode, réponse, lancer la roue, choisir une cible).

import crypto from "node:crypto";
import {
  DEFAULT_ROUNDS,
  MAX_PLAYERS,
  MAX_ROUNDS,
  MIN_QUESTION_SECONDS,
  MIN_ROUNDS,
  MODE_POINTS,
  QUESTIONS_PER_ROUND,
  TIMINGS,
  type AnswerMode,
} from "../../shared/config";
import { CHARACTER_BY_ID } from "../../shared/characters";
import type {
  ClientMessage,
  GameEvent,
  Phase,
  PlayerModifiers,
  PlayerResult,
  PrivateState,
  PublicPlayer,
  PublicRoomState,
  Question,
  RankingEntry,
  RevealInfo,
  RoomSettings,
  WheelOutcome,
  WheelState,
} from "../../shared/types";
import { WHEEL_SEGMENTS, type WheelSegment } from "../../shared/wheel";
import { isAnswerCorrect } from "./answer";
import { selectQuestions, shuffle } from "./selection";

export interface QuestionSource {
  getPlayablePool(): Promise<Question[]>;
  recordUsage(ids: string[]): Promise<void>;
  recordAnswers(id: string, results: { mode: AnswerMode | null; correct: boolean }[]): Promise<void>;
}

export interface RoomTimings {
  questionMs: number;
  introMs: number;
  questionAnnounceMs: number;
  networkGraceMs: number;
  revealMs: number;
  leaderboardMs: number;
  wheelIntroMs: number;
  wheelWaitSpinMs: number;
  wheelSpinMs: number;
  wheelTargetMs: number;
  wheelResultMs: number;
  roundIntroMs: number;
}

interface ServerPlayer {
  id: string;
  token: string;
  name: string;
  character: string;
  seat: number;
  score: number;
  connected: boolean;
  disconnectedAt: number | null;
  joinedAt: number;
  modifiers: PlayerModifiers;
  roundScore: number;
  roundStartScore: number;
  lastResult: PlayerResult | null;
  // question en cours
  mode: AnswerMode | null;
  options: string[];
  answer: string | null;
  answeredAt: number | null;
  correct: boolean;
  deadline: number | null;
  /** Candidat simulé par le serveur. */
  bot: boolean;
  /** Le serveur joue à la place de ce joueur humain. */
  autopilot: boolean;
}

/** Candidats simulés pour les parties de démonstration. */
const BOT_NAMES = ["Sarah", "Lucas", "Emma", "Tom", "Inès", "Nathan", "Chloé"];

export class GameError extends Error {
  constructor(message: string, public code = "invalid") {
    super(message);
  }
}

const freshModifiers = (): PlayerModifiers => ({
  pointsMultiplier: 1,
  timeDeltaSec: 0,
  pending: { pointsMultiplier: 1, timeDeltaSec: 0 },
  shield: false,
});

export function sanitizeName(name: string): string {
  const clean = (name ?? "").toString().replace(/[\u0000-\u001f<>]/g, "").replace(/\s+/g, " ").trim().slice(0, 14);
  return clean || "Candidat";
}

export class Room {
  readonly code: string;
  readonly createdAt = Date.now();
  lastActivity = Date.now();

  private players = new Map<string, ServerPlayer>();
  private hostId: string | null = null;
  private phase: Phase = "lobby";
  private phaseStartedAt = Date.now();
  private phaseEndsAt: number | null = null;
  private settings: RoomSettings = { rounds: DEFAULT_ROUNDS };
  private questions: Question[] = [];
  private questionIdx = -1;
  private round = 0;
  private questionStartsAt = 0;
  private questionTextVisible = false;
  private reveal: RevealInfo | null = null;
  private ranking: RankingEntry[] = [];
  private wheel: WheelState | null = null;
  private events: GameEvent[] = [];
  private eventSeq = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private subTimer: ReturnType<typeof setTimeout> | null = null;
  private usedQuestionIds = new Set<string>();
  private rankBeforeRound = new Map<string, { rank: number; score: number }>();
  private disposed = false;

  onState: (state: PublicRoomState) => void = () => {};
  onPrivate: (playerId: string, priv: PrivateState) => void = () => {};

  constructor(
    code: string,
    private source: QuestionSource,
    private timings: RoomTimings = TIMINGS,
    private rng: () => number = Math.random,
  ) {
    this.code = code;
  }

  // ─── Joueurs ───────────────────────────────────────────────────────────────

  addPlayer(name: string, character: string, opts: { bot?: boolean } = {}): ServerPlayer {
    if (this.phase !== "lobby") throw new GameError("La partie a déjà commencé.", "started");
    if (this.players.size >= MAX_PLAYERS) throw new GameError("Le plateau est complet (8 candidats maximum).", "full");
    const usedSeats = new Set([...this.players.values()].map((p) => p.seat));
    let seat = 0;
    while (usedSeats.has(seat)) seat++;
    const cleanName = sanitizeName(name);
    let finalName = cleanName;
    let n = 2;
    const names = new Set([...this.players.values()].map((p) => p.name.toLowerCase()));
    while (names.has(finalName.toLowerCase())) finalName = `${cleanName.slice(0, 12)} ${n++}`;
    const p: ServerPlayer = {
      id: crypto.randomUUID(),
      token: crypto.randomBytes(18).toString("base64url"),
      name: finalName,
      character: CHARACTER_BY_ID[character] ? character : "nova",
      seat,
      score: 0,
      connected: true,
      disconnectedAt: null,
      joinedAt: Date.now(),
      modifiers: freshModifiers(),
      roundScore: 0,
      roundStartScore: 0,
      lastResult: null,
      mode: null,
      options: [],
      answer: null,
      answeredAt: null,
      correct: false,
      deadline: null,
      bot: !!opts.bot,
      autopilot: false,
    };
    this.players.set(p.id, p);
    if (!this.hostId && !p.bot) this.hostId = p.id;
    this.pushEvent("join", p.id);
    this.touch();
    this.broadcast();
    return p;
  }

  resume(token: string): ServerPlayer {
    const p = [...this.players.values()].find((x) => x.token === token);
    if (!p) throw new GameError("Session introuvable dans cette room.", "unknown_token");
    p.connected = true;
    p.disconnectedAt = null;
    if (!this.hostId || !this.players.get(this.hostId)?.connected) this.hostId = p.id;
    this.touch();
    this.broadcast();
    return p;
  }

  setConnected(playerId: string, connected: boolean) {
    const p = this.players.get(playerId);
    if (!p) return;
    p.connected = connected;
    p.disconnectedAt = connected ? null : Date.now();
    if (!connected && this.hostId === playerId) {
      const next = [...this.players.values()].filter((x) => x.connected && !x.bot).sort((a, b) => a.joinedAt - b.joinedAt)[0];
      if (next) this.hostId = next.id;
    }
    if (!connected) this.pushEvent("leave", playerId);
    this.broadcast();
    if (!connected && this.phase === "question") this.maybeEndQuestionEarly();
  }

  removePlayer(playerId: string) {
    const p = this.players.get(playerId);
    if (!p) return;
    if (this.phase !== "lobby") {
      // Personne n'est éliminé : en cours de partie, le candidat reste sur le plateau (déconnecté).
      this.setConnected(playerId, false);
      return;
    }
    this.players.delete(playerId);
    if (this.hostId === playerId) {
      const next = [...this.players.values()].filter((x) => !x.bot).sort((a, b) => a.joinedAt - b.joinedAt)[0];
      this.hostId = next?.id ?? null;
    }
    this.pushEvent("leave", playerId);
    this.broadcast();
  }

  /** Retire du lobby les candidats déconnectés depuis longtemps. Retourne true si la room est vide/abandonnée. */
  sweep(now = Date.now()): boolean {
    if (this.phase === "lobby") {
      for (const p of [...this.players.values()]) {
        if (!p.connected && p.disconnectedAt && now - p.disconnectedAt > 30_000) this.removePlayer(p.id);
      }
    }
    const humans = [...this.players.values()].filter((p) => !p.bot);
    const anyConnected = humans.some((p) => p.connected);
    return humans.length === 0 || (!anyConnected && now - this.lastActivity > 10 * 60_000);
  }

  get playerCount() {
    return this.players.size;
  }

  // ─── Messages ──────────────────────────────────────────────────────────────

  handle(playerId: string, msg: ClientMessage) {
    const p = this.players.get(playerId);
    if (!p) throw new GameError("Candidat inconnu.");
    this.touch();
    switch (msg.t) {
      case "start":
        return this.start(playerId);
      case "settings":
        return this.updateSettings(playerId, msg.rounds);
      case "mode":
        return this.chooseMode(p, msg.mode);
      case "answer":
        return this.submitAnswer(p, msg.value);
      case "spin":
        return this.spin(playerId);
      case "target":
        return this.chooseTarget(playerId, msg.playerId);
      case "restart":
        return this.restart(playerId);
      case "leave":
        return this.removePlayer(playerId);
      case "addBots":
        return this.addBots(playerId, msg.count ?? 3);
      case "removeBots":
        return this.removeBots(playerId);
      case "autopilot":
        p.autopilot = !!msg.on;
        this.broadcast();
        if (p.autopilot && this.phase === "question" && this.questionTextVisible) this.scheduleBots([p]);
        if (p.autopilot && this.phase === "wheel") this.driveWheel();
        return;
      default:
        return;
    }
  }

  // ─── Candidats simulés (partie de démonstration) ───────────────────────────

  private botTimers = new Set<ReturnType<typeof setTimeout>>();

  private later(ms: number, fn: () => void) {
    const t = setTimeout(() => {
      this.botTimers.delete(t);
      if (this.disposed) return;
      try {
        fn();
      } catch {
        /* coup refusé (trop tard, déjà joué…) : le serveur reste la source de vérité */
      }
    }, Math.max(0, ms));
    this.botTimers.add(t);
  }

  private addBots(playerId: string, count: number) {
    if (playerId !== this.hostId) throw new GameError("Seul l'hôte peut ajouter des candidats simulés.");
    if (this.phase !== "lobby") return;
    const taken = new Set([...this.players.values()].map((p) => p.name.toLowerCase()));
    const usedChars = new Set([...this.players.values()].map((p) => p.character));
    const chars = Object.keys(CHARACTER_BY_ID).filter((c) => !usedChars.has(c));
    let added = 0;
    for (const name of BOT_NAMES) {
      if (added >= count || this.players.size >= MAX_PLAYERS) break;
      if (taken.has(name.toLowerCase())) continue;
      this.addPlayer(name, chars[added % chars.length] ?? "nova", { bot: true });
      added++;
    }
  }

  private removeBots(playerId: string) {
    if (playerId !== this.hostId || this.phase !== "lobby") return;
    for (const p of [...this.players.values()]) if (p.bot) this.players.delete(p.id);
    this.broadcast();
  }

  private automated(p: ServerPlayer | undefined) {
    return !!p && (p.bot || p.autopilot);
  }

  /** Les candidats simulés réfléchissent, choisissent 2 / 4 / SOLO puis répondent, dans les 12 secondes. */
  private scheduleBots(only?: ServerPlayer[]) {
    const q = this.currentQuestion;
    if (!q) return;
    const qi = this.questionIdx;
    const now = Date.now();
    for (const p of only ?? [...this.players.values()]) {
      if (!this.automated(p) || p.mode || p.answer !== null || p.deadline === null) continue;
      if (Math.random() < 0.1) continue; // de temps en temps, un candidat ne répond pas à temps
      const hard = (q.difficulty - 1) / 3; // 0 → facile, 1 → très difficile
      const w = { solo: 0.45 - 0.3 * hard, "4": 0.3 };
      const x = Math.random();
      const mode: AnswerMode = x < w.solo ? "solo" : x < w.solo + w["4"] ? "4" : "2";
      const window = p.deadline - now;
      const t1 = 900 + Math.random() * Math.min(3500, window * 0.35);
      const t2 = Math.min(window - 400, t1 + 1200 + Math.random() * Math.min(4500, window * 0.4));
      const pCorrect = { solo: 0.78, "4": 0.72, "2": 0.86 }[mode] - hard * 0.4;
      const correct = Math.random() < pCorrect;
      this.later(t1, () => {
        if (this.questionIdx !== qi || this.phase !== "question") return;
        this.chooseMode(p, mode);
      });
      this.later(t2, () => {
        if (this.questionIdx !== qi || this.phase !== "question" || !p.mode) return;
        let value: string;
        if (p.mode === "solo") value = correct ? q.correctAnswer.toLowerCase() : q.wrongAnswers[0];
        else value = correct ? q.correctAnswer : p.options.find((o) => o !== q.correctAnswer) ?? p.options[0];
        this.submitAnswer(p, value);
      });
    }
  }

  /** Si le gagnant de la manche est simulé, il lance la roue et choisit sa cible (le leader). */
  private driveWheel() {
    const w = this.wheel;
    if (!w || this.phase !== "wheel") return;
    const spinner = this.players.get(w.spinnerId);
    if (!this.automated(spinner)) return;
    if (w.stage === "waiting_spin") this.later(2200, () => this.spin(w.spinnerId));
    if (w.stage === "choose_target") {
      this.later(2800, () => {
        const target = [...this.players.values()].filter((p) => p.id !== w.spinnerId).sort((a, b) => b.score - a.score)[0];
        if (target) this.chooseTarget(w.spinnerId, target.id);
      });
    }
  }

  private updateSettings(playerId: string, rounds: number) {
    if (playerId !== this.hostId) throw new GameError("Seul l'hôte peut modifier les réglages.");
    if (this.phase !== "lobby") return;
    const r = Math.round(Number(rounds));
    if (!Number.isFinite(r)) return;
    this.settings.rounds = Math.max(MIN_ROUNDS, Math.min(MAX_ROUNDS, r));
    this.broadcast();
  }

  // ─── Déroulé ───────────────────────────────────────────────────────────────

  async start(playerId: string) {
    if (playerId !== this.hostId) throw new GameError("Seul l'hôte peut lancer la partie.");
    if (this.phase !== "lobby") return;
    if (this.players.size < 1) throw new GameError("Il faut au moins un candidat.");
    const pool = await this.source.getPlayablePool();
    const count = this.settings.rounds * QUESTIONS_PER_ROUND;
    this.questions = selectQuestions(pool, count, this.usedQuestionIds, this.rng);
    if (this.questions.length < count) throw new GameError("Pas assez de questions publiées dans la base.");
    this.questions.forEach((q) => this.usedQuestionIds.add(q.id));
    void this.source.recordUsage(this.questions.map((q) => q.id)).catch(() => {});
    for (const p of this.players.values()) {
      p.score = 0;
      p.roundScore = 0;
      p.modifiers = freshModifiers();
      p.lastResult = null;
      this.resetQuestionState(p);
    }
    this.questionIdx = -1;
    this.round = 0;
    this.ranking = this.computeRanking();
    this.setPhase("intro", this.timings.introMs, () => this.startRound());
  }

  private startRound() {
    this.round++;
    for (const p of this.players.values()) {
      // Les effets gagnés à la roue s'appliquent pendant toute la manche suivante.
      p.modifiers.pointsMultiplier = clamp(p.modifiers.pending.pointsMultiplier, 0.5, 2);
      p.modifiers.timeDeltaSec = p.modifiers.pending.timeDeltaSec;
      p.modifiers.pending = { pointsMultiplier: 1, timeDeltaSec: 0 };
      p.roundScore = 0;
      p.roundStartScore = p.score;
    }
    this.rankBeforeRound = new Map(this.computeRanking().map((r) => [r.playerId, { rank: r.rank, score: r.score }]));
    this.setPhase("round_intro", this.timings.roundIntroMs, () => this.nextQuestion());
  }

  private nextQuestion() {
    this.questionIdx++;
    const now = Date.now();
    this.reveal = null;
    this.questionStartsAt = now + this.timings.questionAnnounceMs;
    this.questionTextVisible = false;
    let maxDeadline = this.questionStartsAt + this.timings.questionMs;
    for (const p of this.players.values()) {
      this.resetQuestionState(p);
      const seconds = Math.max(MIN_QUESTION_SECONDS, this.timings.questionMs / 1000 + p.modifiers.timeDeltaSec);
      p.deadline = this.questionStartsAt + seconds * 1000;
      maxDeadline = Math.max(maxDeadline, p.deadline);
    }
    this.setPhase("question", maxDeadline + this.timings.networkGraceMs - now, () => this.endQuestion());
    this.clearSubTimer();
    this.subTimer = setTimeout(() => {
      this.questionTextVisible = true;
      this.broadcast();
      this.scheduleBots();
    }, this.timings.questionAnnounceMs);
    for (const p of this.players.values()) this.sendPrivate(p);
  }

  private resetQuestionState(p: ServerPlayer) {
    p.mode = null;
    p.options = [];
    p.answer = null;
    p.answeredAt = null;
    p.correct = false;
    p.deadline = null;
  }

  private get currentQuestion(): Question | null {
    return this.questions[this.questionIdx] ?? null;
  }

  private assertAnswerWindow(p: ServerPlayer) {
    if (this.phase !== "question") throw new GameError("Aucune question en cours.", "late");
    const now = Date.now();
    if (now < this.questionStartsAt) throw new GameError("Le chrono n'a pas encore démarré.", "early");
    if (p.deadline === null || now > p.deadline + this.timings.networkGraceMs) throw new GameError("Temps écoulé !", "late");
  }

  chooseMode(p: ServerPlayer, mode: AnswerMode) {
    if (mode !== "4" && mode !== "2" && mode !== "solo") throw new GameError("Mode inconnu.");
    this.assertAnswerWindow(p);
    if (p.mode) throw new GameError("Le niveau d'aide est déjà choisi.", "locked");
    const q = this.currentQuestion!;
    p.mode = mode;
    if (mode === "4") p.options = shuffle([q.correctAnswer, ...q.wrongAnswers.slice(0, 3)], this.rng);
    else if (mode === "2") p.options = shuffle([q.correctAnswer, q.wrongAnswers[0]], this.rng);
    else p.options = [];
    this.pushEvent("mode", p.id, { mode });
    this.sendPrivate(p);
    this.broadcast();
  }

  submitAnswer(p: ServerPlayer, value: string) {
    this.assertAnswerWindow(p);
    if (!p.mode) throw new GameError("Choisis d'abord ton niveau d'aide.", "no_mode");
    if (p.answer !== null) throw new GameError("Réponse déjà verrouillée.", "locked");
    const q = this.currentQuestion!;
    const raw = (value ?? "").toString().slice(0, 80).trim();
    if (!raw) throw new GameError("Réponse vide.", "empty");
    if (p.mode === "solo") {
      p.correct = isAnswerCorrect(raw, q.correctAnswer, q.acceptedAnswers);
    } else {
      if (!p.options.includes(raw)) throw new GameError("Proposition inconnue.");
      p.correct = raw === q.correctAnswer;
    }
    p.answer = raw;
    p.answeredAt = Date.now();
    this.pushEvent("answer", p.id);
    this.sendPrivate(p);
    this.broadcast();
    this.maybeEndQuestionEarly();
  }

  private maybeEndQuestionEarly() {
    if (this.phase !== "question") return;
    const active = [...this.players.values()].filter((p) => p.connected);
    if (active.length && active.every((p) => p.answer !== null)) {
      // Tout le monde a répondu : on verrouille après un court suspense.
      this.clearTimer();
      this.phaseEndsAt = Date.now() + 900;
      this.timer = setTimeout(() => this.endQuestion(), 900);
      this.broadcast();
    }
  }

  private endQuestion() {
    const q = this.currentQuestion;
    if (!q || this.phase !== "question") return;
    this.clearSubTimer();
    this.questionTextVisible = true;
    const results: Record<string, PlayerResult> = {};
    const statRows: { mode: AnswerMode | null; correct: boolean }[] = [];
    for (const p of this.players.values()) {
      const base = p.mode ? MODE_POINTS[p.mode] : 0;
      const mult = p.modifiers.pointsMultiplier;
      const answered = p.answer !== null;
      const correct = answered && p.correct;
      const points = correct ? Math.round(base * mult) : 0;
      p.score += points;
      p.roundScore += points;
      const r: PlayerResult = {
        questionIndex: this.questionIdx,
        mode: p.mode,
        answer: p.answer,
        correct,
        points,
        basePoints: base,
        multiplier: mult,
        timedOut: !answered,
      };
      p.lastResult = r;
      results[p.id] = r;
      if (p.connected || answered) statRows.push({ mode: answered ? p.mode : null, correct });
    }
    void this.source.recordAnswers(q.id, statRows).catch(() => {});
    this.reveal = { questionIndex: this.questionIdx, correctAnswer: q.correctAnswer, explanation: q.explanation, results };
    this.ranking = this.computeRanking();
    this.pushEvent("reveal", undefined, { questionIndex: this.questionIdx });
    const inRound = this.questionIdx % QUESTIONS_PER_ROUND;
    this.setPhase("reveal", this.timings.revealMs, () => {
      if (inRound < QUESTIONS_PER_ROUND - 1 && this.questionIdx < this.questions.length - 1) this.nextQuestion();
      else this.showLeaderboard();
    });
    for (const p of this.players.values()) this.sendPrivate(p);
  }

  private showLeaderboard() {
    this.ranking = this.computeRanking(true);
    const isLast = this.round >= this.settings.rounds;
    if (isLast) return this.showFinal();
    const winner = this.roundWinner();
    if (winner) this.pushEvent("round_winner", winner.id);
    this.setPhase("leaderboard", this.timings.leaderboardMs, () => this.startWheel());
  }

  /** Le meilleur de la manche (points marqués pendant les 5 questions) gagne la roue. Égalité : avantage au moins bien classé. */
  private roundWinner(): ServerPlayer | null {
    const list = [...this.players.values()];
    if (!list.length) return null;
    const connected = list.filter((p) => p.connected);
    const pool = connected.length ? connected : list;
    const sorted = [...pool].sort((a, b) => b.roundScore - a.roundScore || a.score - b.score || a.seat - b.seat);
    return sorted[0];
  }

  // ─── Roue ─────────────────────────────────────────────────────────────────

  private startWheel() {
    const spinner = this.roundWinner();
    if (!spinner) return this.startRound();
    this.wheel = {
      stage: "intro",
      spinnerId: spinner.id,
      resultIndex: null,
      spinStartedAt: null,
      spinDurationMs: this.timings.wheelSpinMs,
      spinTurns: 5,
      targetId: null,
      outcome: null,
    };
    this.setPhase("wheel", this.timings.wheelIntroMs, () => {
      this.wheel!.stage = "waiting_spin";
      // Si le joueur est absent ou ne lance pas, la roue part toute seule.
      const wait = spinner.connected ? this.timings.wheelWaitSpinMs : 1_500;
      this.setPhase("wheel", wait, () => this.doSpin());
      this.driveWheel();
    });
  }

  spin(playerId: string) {
    if (this.phase !== "wheel" || !this.wheel || this.wheel.stage !== "waiting_spin") throw new GameError("La roue n'est pas prête.");
    if (playerId !== this.wheel.spinnerId) throw new GameError("Ce n'est pas à toi de lancer la roue.");
    this.doSpin();
  }

  private doSpin() {
    const w = this.wheel!;
    if (w.stage !== "waiting_spin") return;
    w.stage = "spinning";
    w.resultIndex = Math.floor(this.rng() * WHEEL_SEGMENTS.length);
    w.spinStartedAt = Date.now() + 150;
    w.spinTurns = 4 + Math.floor(this.rng() * 3);
    this.setPhase("wheel", this.timings.wheelSpinMs + 150 + 400, () => this.afterSpin());
  }

  private afterSpin() {
    const w = this.wheel!;
    const seg = WHEEL_SEGMENTS[w.resultIndex!];
    const others = [...this.players.values()].filter((p) => p.id !== w.spinnerId);
    if (seg.needsTarget && others.length) {
      w.stage = "choose_target";
      const spinner = this.players.get(w.spinnerId);
      const wait = spinner?.connected ? this.timings.wheelTargetMs : 1_500;
      this.setPhase("wheel", wait, () => {
        // Pas de choix à temps : cible tirée au sort.
        const target = others[Math.floor(this.rng() * others.length)];
        this.applyEffect(seg, target.id);
      });
      this.driveWheel();
    } else {
      this.applyEffect(seg, null);
    }
  }

  chooseTarget(playerId: string, targetId: string) {
    const w = this.wheel;
    if (this.phase !== "wheel" || !w || w.stage !== "choose_target") throw new GameError("Aucune cible à choisir.");
    if (playerId !== w.spinnerId) throw new GameError("Ce n'est pas toi qui choisis la cible.");
    if (targetId === playerId || !this.players.has(targetId)) throw new GameError("Cible invalide.");
    this.applyEffect(WHEEL_SEGMENTS[w.resultIndex!], targetId);
  }

  private applyEffect(seg: WheelSegment, targetId: string | null) {
    const w = this.wheel!;
    const spinner = this.players.get(w.spinnerId)!;
    const target = targetId ? this.players.get(targetId)! : null;
    const changes: Record<string, number> = {};
    let blocked = false;
    let text = "";
    const affected: string[] = [];
    const add = (p: ServerPlayer, delta: number) => {
      const before = p.score;
      p.score = Math.max(0, p.score + delta);
      changes[p.id] = (changes[p.id] ?? 0) + (p.score - before);
    };

    if (target && target.modifiers.shield && seg.needsTarget) {
      target.modifiers.shield = false;
      blocked = true;
      affected.push(target.id);
      text = `${target.name} était protégé par son BOUCLIER !`;
    } else {
      switch (seg.kind) {
        case "bonus_points":
          add(spinner, seg.value);
          affected.push(spinner.id);
          text = `+${seg.value} points pour ${spinner.name} !`;
          break;
        case "double_points":
          spinner.modifiers.pending.pointsMultiplier = clamp(spinner.modifiers.pending.pointsMultiplier * 2, 0.5, 2);
          affected.push(spinner.id);
          text = `${spinner.name} marquera DOUBLE pendant la prochaine manche !`;
          break;
        case "extra_time":
          spinner.modifiers.pending.timeDeltaSec += seg.value;
          affected.push(spinner.id);
          text = `${spinner.name} aura ${seg.value} secondes de plus pendant la prochaine manche !`;
          break;
        case "shield":
          spinner.modifiers.shield = true;
          affected.push(spinner.id);
          text = `${spinner.name} est protégé contre le prochain malus !`;
          break;
        case "underdog_boost": {
          const min = Math.min(...[...this.players.values()].map((p) => p.score));
          const lasts = [...this.players.values()].filter((p) => p.score === min);
          lasts.forEach((p) => {
            add(p, seg.value);
            affected.push(p.id);
          });
          text = `Coup de pouce : +${seg.value} pour ${lasts.map((p) => p.name).join(", ")} !`;
          break;
        }
        case "malus_points":
          if (target) {
            add(target, -seg.value);
            affected.push(target.id);
            text = `${target.name} perd ${-changes[target.id]} points !`;
          }
          break;
        case "malus_time":
          if (target) {
            target.modifiers.pending.timeDeltaSec -= seg.value;
            affected.push(target.id);
            text = `${target.name} aura ${seg.value} secondes de moins pendant la prochaine manche !`;
          }
          break;
        case "half_points":
          if (target) {
            target.modifiers.pending.pointsMultiplier = clamp(target.modifiers.pending.pointsMultiplier * 0.5, 0.5, 2);
            affected.push(target.id);
            text = `${target.name} ne marquera que la moitié des points pendant la prochaine manche !`;
          }
          break;
        case "steal_points":
          if (target) {
            const amount = Math.min(seg.value, target.score);
            add(target, -amount);
            add(spinner, amount);
            affected.push(target.id, spinner.id);
            text = amount > 0 ? `${spinner.name} vole ${amount} points à ${target.name} !` : `${target.name} n'avait rien à voler !`;
          }
          break;
      }
      if (!text) text = "Aucun effet.";
    }

    const outcome: WheelOutcome = { segmentId: seg.id, text, affectedIds: affected, blockedByShield: blocked, scoreChanges: changes };
    w.stage = "result";
    w.targetId = target?.id ?? null;
    w.outcome = outcome;
    this.ranking = this.computeRanking();
    this.pushEvent("wheel_result", spinner.id, { segmentId: seg.id });
    for (const id of affected) this.pushEvent("effect", id, { segmentId: seg.id, tone: seg.tone, blocked, delta: changes[id] ?? 0 });
    this.setPhase("wheel", this.timings.wheelResultMs, () => {
      this.wheel = null;
      this.startRound();
    });
  }

  // ─── Fin de partie ─────────────────────────────────────────────────────────

  private showFinal() {
    this.ranking = this.computeRanking(true);
    const winner = this.ranking[0];
    if (winner) this.pushEvent("winner", winner.playerId);
    this.setPhase("final", null, null);
  }

  private restart(playerId: string) {
    if (playerId !== this.hostId) throw new GameError("Seul l'hôte peut relancer une partie.");
    if (this.phase !== "final") return;
    for (const p of [...this.players.values()]) {
      if (!p.connected) {
        this.players.delete(p.id);
        continue;
      }
      p.score = 0;
      p.roundScore = 0;
      p.modifiers = freshModifiers();
      p.lastResult = null;
      this.resetQuestionState(p);
    }
    this.questions = [];
    this.questionIdx = -1;
    this.round = 0;
    this.reveal = null;
    this.wheel = null;
    this.ranking = [];
    this.setPhase("lobby", null, null);
  }

  // ─── Classement ────────────────────────────────────────────────────────────

  private computeRanking(sinceRoundStart = false): RankingEntry[] {
    const list = [...this.players.values()].sort((a, b) => b.score - a.score || a.seat - b.seat);
    const prev = new Map(this.ranking.map((r) => [r.playerId, r]));
    let rank = 0;
    let lastScore = Number.NaN;
    return list.map((p, i) => {
      if (p.score !== lastScore) rank = i + 1;
      lastScore = p.score;
      const before = sinceRoundStart ? this.rankBeforeRound.get(p.id) : undefined;
      const pr = prev.get(p.id);
      return {
        playerId: p.id,
        rank,
        score: p.score,
        previousRank: before?.rank ?? pr?.rank ?? rank,
        previousScore: before?.score ?? pr?.score ?? p.score,
        roundScore: p.roundScore,
      };
    });
  }

  // ─── Diffusion ─────────────────────────────────────────────────────────────

  private setPhase(phase: Phase, durationMs: number | null, next: (() => void) | null) {
    this.clearTimer();
    const now = Date.now();
    if (this.phase !== phase) this.phaseStartedAt = now;
    this.phase = phase;
    this.phaseEndsAt = durationMs === null ? null : now + durationMs;
    if (next && durationMs !== null) {
      this.timer = setTimeout(() => {
        this.timer = null;
        if (this.disposed) return;
        try {
          next();
        } catch (e) {
          console.error(`[room ${this.code}]`, e);
        }
      }, Math.max(0, durationMs));
    }
    this.broadcast();
  }

  private clearTimer() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private clearSubTimer() {
    if (this.subTimer) clearTimeout(this.subTimer);
    this.subTimer = null;
  }

  private pushEvent(type: GameEvent["type"], playerId?: string, data?: Record<string, unknown>) {
    this.events.push({ id: ++this.eventSeq, at: Date.now(), type, playerId, data });
    if (this.events.length > 30) this.events.splice(0, this.events.length - 30);
  }

  private touch() {
    this.lastActivity = Date.now();
  }

  publicState(): PublicRoomState {
    const q = this.currentQuestion;
    const inQuestion = this.phase === "question" || this.phase === "reveal";
    const players: PublicPlayer[] = [...this.players.values()]
      .sort((a, b) => a.seat - b.seat)
      .map((p) => ({
        id: p.id,
        name: p.name,
        character: p.character,
        seat: p.seat,
        score: p.score,
        connected: p.connected,
        isHost: p.id === this.hostId,
        bot: p.bot,
        autopilot: p.autopilot,
        mode: inQuestion ? p.mode : null,
        answered: inQuestion ? p.answer !== null : false,
        deadline: inQuestion ? p.deadline : null,
        modifiers: p.modifiers,
        roundScore: p.roundScore,
        lastResult: p.lastResult,
      }));
    return {
      code: this.code,
      phase: this.phase,
      phaseStartedAt: this.phaseStartedAt,
      phaseEndsAt: this.phaseEndsAt,
      settings: { ...this.settings },
      round: this.round,
      totalRounds: this.settings.rounds,
      questionNumber: this.questionIdx + 1,
      totalQuestions: this.settings.rounds * QUESTIONS_PER_ROUND,
      players,
      question:
        q && inQuestion
          ? {
              index: this.questionIdx,
              inRound: this.questionIdx % QUESTIONS_PER_ROUND,
              // Le texte n'est envoyé qu'au démarrage du chrono : personne ne gagne de temps de réflexion.
              text: this.questionTextVisible ? q.question : "",
              category: q.category,
              difficulty: q.difficulty,
              startsAt: this.questionStartsAt,
              endsAt: this.questionStartsAt + this.timings.questionMs,
            }
          : null,
      reveal: this.phase === "reveal" ? this.reveal : null,
      ranking: this.ranking,
      wheel: this.wheel,
      events: this.events,
      serverNow: Date.now(),
    };
  }

  privateState(playerId: string): PrivateState {
    const p = this.players.get(playerId);
    const inQuestion = this.phase === "question" || this.phase === "reveal";
    if (!p || !inQuestion) return { questionIndex: null, mode: null, options: [], answered: false, answer: null, deadline: null };
    return { questionIndex: this.questionIdx, mode: p.mode, options: p.options, answered: p.answer !== null, answer: p.answer, deadline: p.deadline };
  }

  private broadcast() {
    if (this.disposed) return;
    this.onState(this.publicState());
  }

  private sendPrivate(p: ServerPlayer) {
    this.onPrivate(p.id, this.privateState(p.id));
  }

  /** Pour les tests. */
  debugPlayer(id: string) {
    return this.players.get(id);
  }

  dispose() {
    this.disposed = true;
    this.botTimers.forEach((t) => clearTimeout(t));
    this.botTimers.clear();
    this.clearTimer();
    this.clearSubTimer();
  }
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}
