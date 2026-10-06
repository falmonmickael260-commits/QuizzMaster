import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Room, type QuestionSource } from "../server/game/room";
import { TIMINGS, MODE_POINTS } from "../shared/config";
import { emptyStats, type PrivateState, type PublicRoomState, type Question } from "../shared/types";
import { WHEEL_SEGMENTS } from "../shared/wheel";
import { SEED_QUESTIONS } from "../data/questions";

const pool: Question[] = SEED_QUESTIONS.map((s) => ({
  ...s,
  status: "published",
  source: "seed",
  createdAt: "",
  updatedAt: "",
  stats: emptyStats(),
}));

function makeSource() {
  const answers: { id: string; n: number }[] = [];
  const source: QuestionSource = {
    getPlayablePool: async () => pool,
    recordUsage: async () => {},
    recordAnswers: async (id, r) => {
      answers.push({ id, n: r.length });
    },
  };
  return { source, answers };
}

/** Générateur pseudo-aléatoire déterministe pour rendre la roue prévisible. */
function seeded(values: number[]) {
  let i = 0;
  return () => values[i++ % values.length];
}

describe("Room — moteur autoritaire", () => {
  let room: Room;
  let last: PublicRoomState;
  const priv = new Map<string, PrivateState>();

  beforeEach(() => {
    vi.useFakeTimers();
    const { source } = makeSource();
    room = new Room("BQ-1234", source, TIMINGS, seeded([0.1, 0.5, 0.9, 0.3, 0.7]));
    room.onState = (s) => (last = s);
    room.onPrivate = (id, p) => priv.set(id, p);
  });
  afterEach(() => {
    room.dispose();
    vi.useRealTimers();
  });

  async function setup(n = 4) {
    const players = ["Alex", "Sarah", "Lucas", "Emma", "Tom", "Inès"].slice(0, n).map((name, i) => room.addPlayer(name, ["nova", "rocco", "maya", "hugo", "yuna", "sam"][i]));
    room.handle(players[0].id, { t: "settings", rounds: 2 });
    await room.start(players[0].id);
    return players;
  }

  async function toQuestion() {
    await vi.advanceTimersByTimeAsync(TIMINGS.introMs + TIMINGS.roundIntroMs + TIMINGS.questionAnnounceMs + 10);
    expect(last.phase).toBe("question");
    expect(last.question?.text).not.toBe("");
  }

  it("déroule une manche complète : modes 4/2/SOLO, bonnes et mauvaises réponses, expiration", async () => {
    const [a, b, c, d] = await setup(4);
    expect(last.phase).toBe("intro");
    expect(last.players.map((p) => p.seat)).toEqual([0, 1, 2, 3]);
    await toQuestion();

    const q = (room as unknown as { questions: Question[] }).questions[0];
    // Le texte de la bonne réponse n'est jamais diffusé pendant la question.
    expect(JSON.stringify(last)).not.toContain(`"correctAnswer"`);

    // Alex : SOLO, bonne réponse tapée en minuscules sans accents
    room.handle(a.id, { t: "mode", mode: "solo" });
    expect(priv.get(a.id)?.options).toEqual([]);
    room.handle(a.id, { t: "answer", value: q.correctAnswer.toLowerCase() });
    // Sarah : 2 réponses, choisit la bonne
    room.handle(b.id, { t: "mode", mode: "2" });
    expect(priv.get(b.id)?.options).toHaveLength(2);
    expect(priv.get(b.id)?.options).toContain(q.correctAnswer);
    room.handle(b.id, { t: "answer", value: q.correctAnswer });
    // Lucas : 4 réponses, choisit une mauvaise
    room.handle(c.id, { t: "mode", mode: "4" });
    expect(priv.get(c.id)?.options).toHaveLength(4);
    const wrong = priv.get(c.id)!.options.find((o) => o !== q.correctAnswer)!;
    room.handle(c.id, { t: "answer", value: wrong });
    // Emma : choisit un mode mais ne répond pas → expiration
    room.handle(d.id, { t: "mode", mode: "2" });
    // Impossible de changer de mode une fois choisi
    expect(() => room.handle(d.id, { t: "mode", mode: "solo" })).toThrow();

    await vi.advanceTimersByTimeAsync(TIMINGS.questionMs + TIMINGS.networkGraceMs + 10);
    expect(last.phase).toBe("reveal");
    const r = last.reveal!.results;
    expect(r[a.id]).toMatchObject({ correct: true, points: MODE_POINTS.solo });
    expect(r[b.id]).toMatchObject({ correct: true, points: MODE_POINTS["2"] });
    expect(r[c.id]).toMatchObject({ correct: false, points: 0 });
    expect(r[d.id]).toMatchObject({ correct: false, points: 0, timedOut: true });
    expect(last.reveal!.correctAnswer).toBe(q.correctAnswer);
    expect(last.players.find((p) => p.id === a.id)!.score).toBe(200);

    // Une réponse après la fin est refusée
    expect(() => room.handle(d.id, { t: "answer", value: "x" })).toThrow();
  });

  it("refuse les réponses avant le démarrage du chrono et hors du temps imparti", async () => {
    const [a] = await setup(2);
    await vi.advanceTimersByTimeAsync(TIMINGS.introMs + TIMINGS.roundIntroMs + 100);
    expect(last.phase).toBe("question");
    expect(last.question?.text).toBe(""); // annonce : le texte n'est pas encore envoyé
    expect(() => room.handle(a.id, { t: "mode", mode: "4" })).toThrow(/pas encore/);
    await vi.advanceTimersByTimeAsync(TIMINGS.questionAnnounceMs + TIMINGS.questionMs + 500);
    expect(() => room.handle(a.id, { t: "mode", mode: "4" })).toThrow();
  });

  it("accepte une réponse SOLO tapée directement, sans choisir l'aide avant", async () => {
    const [a, b] = await setup(2);
    await toQuestion();
    const q = (room as unknown as { questions: Question[] }).questions[0];
    room.handle(a.id, { t: "answer", value: q.correctAnswer, solo: true });
    expect(() => room.handle(b.id, { t: "answer", value: q.correctAnswer })).toThrow(/aide/);
    const me = last.players.find((p) => p.id === a.id)!;
    expect(me.mode).toBe("solo");
    expect(me.answered).toBe(true);
  });

  it("termine la question en avance quand tout le monde a répondu", async () => {
    const [a, b] = await setup(2);
    await toQuestion();
    const q = (room as unknown as { questions: Question[] }).questions[0];
    for (const p of [a, b]) {
      room.handle(p.id, { t: "mode", mode: "solo" });
      room.handle(p.id, { t: "answer", value: q.correctAnswer });
    }
    await vi.advanceTimersByTimeAsync(1000);
    expect(last.phase).toBe("reveal");
  });

  it("enchaîne 5 questions → classement → roue → nouvelle manche, puis finale", async () => {
    const [a, b, c] = await setup(3);
    await toQuestion();
    const questions = (room as unknown as { questions: Question[] }).questions;
    for (let i = 0; i < 5; i++) {
      expect(last.phase).toBe("question");
      expect(last.question!.inRound).toBe(i);
      // Sarah gagne la manche en SOLO à chaque fois
      room.handle(b.id, { t: "mode", mode: "solo" });
      room.handle(b.id, { t: "answer", value: questions[i].correctAnswer });
      room.handle(a.id, { t: "mode", mode: "4" });
      room.handle(a.id, { t: "answer", value: priv.get(a.id)!.options[0] });
      await vi.advanceTimersByTimeAsync(TIMINGS.questionMs + TIMINGS.networkGraceMs + 10);
      expect(last.phase).toBe("reveal");
      await vi.advanceTimersByTimeAsync(TIMINGS.revealMs + (i < 4 ? TIMINGS.questionAnnounceMs : 0) + 10);
    }
    expect(last.phase).toBe("leaderboard");
    expect(last.ranking[0].playerId).toBe(b.id);
    expect(last.players.find((p) => p.id === b.id)!.roundScore).toBe(1000);
    await vi.advanceTimersByTimeAsync(TIMINGS.leaderboardMs + 10);
    expect(last.phase).toBe("wheel");
    expect(last.wheel!.spinnerId).toBe(b.id);
    await vi.advanceTimersByTimeAsync(TIMINGS.wheelIntroMs + 10);
    expect(last.wheel!.stage).toBe("waiting_spin");
    expect(() => room.handle(a.id, { t: "spin" })).toThrow(); // seul le gagnant lance
    room.handle(b.id, { t: "spin" });
    expect(last.wheel!.stage).toBe("spinning");
    expect(last.wheel!.resultIndex).not.toBeNull();
    await vi.advanceTimersByTimeAsync(TIMINGS.wheelSpinMs + 600);
    const seg = WHEEL_SEGMENTS[last.wheel!.resultIndex!];
    if (seg.needsTarget) {
      expect(last.wheel!.stage).toBe("choose_target");
      expect(() => room.handle(b.id, { t: "target", playerId: b.id })).toThrow(); // pas soi-même
      room.handle(b.id, { t: "target", playerId: c.id });
    }
    expect(last.wheel!.stage).toBe("result");
    expect(last.wheel!.outcome!.text.length).toBeGreaterThan(3);
    await vi.advanceTimersByTimeAsync(TIMINGS.wheelResultMs + 10);
    expect(last.phase).toBe("round_intro");
    expect(last.round).toBe(2);
    expect(last.players).toHaveLength(3); // personne n'est éliminé

    // Manche 2 sans réponse → finale
    await vi.advanceTimersByTimeAsync(TIMINGS.roundIntroMs + TIMINGS.questionAnnounceMs + 10);
    for (let i = 0; i < 5; i++) {
      await vi.advanceTimersByTimeAsync(TIMINGS.questionMs + TIMINGS.networkGraceMs + 10);
      await vi.advanceTimersByTimeAsync(TIMINGS.revealMs + (i < 4 ? TIMINGS.questionAnnounceMs : 0) + 10);
    }
    expect(last.phase).toBe("final");
    expect(last.ranking[0].playerId).toBe(b.id);
    room.handle(a.id, { t: "restart" });
    expect(last.phase).toBe("lobby");
    expect(last.players.every((p) => p.score === 0)).toBe(true);
  });
});

describe("Roue — effets et équilibrage", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  async function roomOnSegment(segmentId: string, scores: number[]) {
    const idx = WHEEL_SEGMENTS.findIndex((s) => s.id === segmentId);
    const room = new Room("BQ-9999", makeSource().source, TIMINGS, () => (idx + 0.5) / WHEEL_SEGMENTS.length);
    let last!: PublicRoomState;
    room.onState = (s) => (last = s);
    const players = scores.map((_, i) => room.addPlayer(`P${i}`, "nova"));
    const internals = room as unknown as { wheel: unknown; startWheel: () => void; doSpin: () => void };
    players.forEach((p, i) => {
      const sp = room.debugPlayer(p.id)!;
      sp.score = scores[i];
      sp.roundScore = i === 0 ? 999 : 0; // P0 gagne la manche
    });
    (room as unknown as { phase: string }).phase = "leaderboard";
    internals.startWheel();
    await vi.advanceTimersByTimeAsync(TIMINGS.wheelIntroMs + 10);
    room.handle(players[0].id, { t: "spin" });
    await vi.advanceTimersByTimeAsync(TIMINGS.wheelSpinMs + 600);
    return { room, players, get last() { return last; } };
  }

  it("-300 ne descend jamais sous zéro", async () => {
    const t = await roomOnSegment("malus300", [1000, 200]);
    t.room.handle(t.players[0].id, { t: "target", playerId: t.players[1].id });
    expect(t.last.players[1].score).toBe(0);
    t.room.dispose();
  });

  it("le vol transfère au plus le score de la cible", async () => {
    const t = await roomOnSegment("steal300", [500, 120]);
    t.room.handle(t.players[0].id, { t: "target", playerId: t.players[1].id });
    expect(t.last.players.map((p) => p.score)).toEqual([620, 0]);
    t.room.dispose();
  });

  it("le bouclier bloque un malus puis disparaît", async () => {
    const t = await roomOnSegment("malus300", [1000, 800]);
    t.room.debugPlayer(t.players[1].id)!.modifiers.shield = true;
    t.room.handle(t.players[0].id, { t: "target", playerId: t.players[1].id });
    expect(t.last.players[1].score).toBe(800);
    expect(t.last.wheel!.outcome!.blockedByShield).toBe(true);
    expect(t.last.players[1].modifiers.shield).toBe(false);
    t.room.dispose();
  });

  it("points x2 et -3 s s'appliquent à la manche suivante", async () => {
    const t = await roomOnSegment("double", [1000, 800]);
    expect(t.last.players[0].modifiers.pending.pointsMultiplier).toBe(2);
    expect(t.last.players[0].modifiers.pointsMultiplier).toBe(1);
    await vi.advanceTimersByTimeAsync(TIMINGS.wheelResultMs + 10);
    expect(t.last.players[0].modifiers.pointsMultiplier).toBe(2);
    t.room.dispose();
  });

  it("le coup de pouce profite au dernier", async () => {
    const t = await roomOnSegment("underdog", [1000, 800, 300]);
    expect(t.last.players.map((p) => p.score)).toEqual([1000, 800, 700]);
    t.room.dispose();
  });

  it("sans choix de cible, le serveur en tire une au sort", async () => {
    const t = await roomOnSegment("timeMinus3", [1000, 800]);
    expect(t.last.wheel!.stage).toBe("choose_target");
    await vi.advanceTimersByTimeAsync(TIMINGS.wheelTargetMs + 10);
    expect(t.last.wheel!.stage).toBe("result");
    expect(t.last.players[1].modifiers.pending.timeDeltaSec).toBe(-3);
    t.room.dispose();
  });
});

describe("Partie maximale — 30 questions", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("enchaîne 6 manches, 5 roues, puis la finale, sans éliminer personne", async () => {
    const room = new Room("BQ-3030", makeSource().source, TIMINGS, seeded([0.05, 0.35, 0.65, 0.95, 0.2, 0.5, 0.8]));
    let last!: PublicRoomState;
    const priv = new Map<string, PrivateState>();
    room.onState = (s) => (last = s);
    room.onPrivate = (id, p) => priv.set(id, p);
    const players = ["Alex", "Sarah", "Lucas", "Emma"].map((n) => room.addPlayer(n, "nova"));
    room.handle(players[0].id, { t: "settings", rounds: 6 });
    await room.start(players[0].id);
    const questions = (room as unknown as { questions: Question[] }).questions;
    expect(questions).toHaveLength(30);
    expect(new Set(questions.map((q) => q.id)).size).toBe(30); // aucune question répétée

    let wheels = 0;
    const seenQuestions = new Set<number>();
    for (let guard = 0; guard < 6000 && last.phase !== "final"; guard++) {
      if (last.phase === "question" && last.question?.text && !seenQuestions.has(last.question.index)) {
        const qi = last.question.index;
        seenQuestions.add(qi);
        // chaque joueur joue un mode différent ; Emma ne répond jamais
        players.slice(0, 3).forEach((p, i) => {
          const mode = (["2", "4", "solo"] as const)[(i + qi) % 3];
          room.handle(p.id, { t: "mode", mode });
          const value = mode === "solo" ? questions[qi].correctAnswer : priv.get(p.id)!.options[qi % priv.get(p.id)!.options.length];
          room.handle(p.id, { t: "answer", value });
        });
      }
      if (last.phase === "wheel" && last.wheel?.stage === "waiting_spin") {
        wheels++;
        room.handle(last.wheel.spinnerId, { t: "spin" });
      }
      if (last.phase === "wheel" && last.wheel?.stage === "choose_target") {
        const target = last.players.find((p) => p.id !== last.wheel!.spinnerId)!;
        room.handle(last.wheel.spinnerId, { t: "target", playerId: target.id });
      }
      await vi.advanceTimersByTimeAsync(250);
    }
    expect(last.phase).toBe("final");
    expect(seenQuestions.size).toBe(30);
    expect(last.questionNumber).toBe(30);
    expect(wheels).toBe(5); // une roue après chaque manche sauf la dernière
    expect(last.players).toHaveLength(4);
    expect(last.players.every((p) => p.score >= 0)).toBe(true);
    expect(last.ranking[0].score).toBe(Math.max(...last.players.map((p) => p.score)));
    room.dispose();
  });
});

describe("Partie de démonstration — candidats simulés", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("les simulés et le pilote automatique jouent une manche complète, roue comprise", async () => {
    const room = new Room("BQ-7777", makeSource().source, TIMINGS);
    let last!: PublicRoomState;
    room.onState = (s) => (last = s);
    const alex = room.addPlayer("Alex", "hugo");
    room.handle(alex.id, { t: "settings", rounds: 2 });
    room.handle(alex.id, { t: "addBots", count: 3 });
    expect(last.players.map((p) => p.name)).toEqual(["Alex", "Sarah", "Lucas", "Emma"]);
    expect(last.players.filter((p) => p.bot)).toHaveLength(3);
    expect(last.players.find((p) => p.isHost)?.name).toBe("Alex"); // un simulé n'est jamais hôte
    room.handle(alex.id, { t: "autopilot", on: true });
    await room.start(alex.id);
    const modes = new Set<string>();
    let answers = 0;
    let wheelDone = false;
    for (let i = 0; i < 4000 && last.phase !== "final"; i++) {
      await vi.advanceTimersByTimeAsync(100);
      if (last.phase === "reveal" && last.reveal) {
        for (const r of Object.values(last.reveal.results)) {
          if (r.mode) modes.add(r.mode);
          if (r.answer) answers++;
        }
      }
      if (last.phase === "wheel" && last.wheel?.stage === "result") wheelDone = true;
    }
    expect(last.phase).toBe("final");
    expect(modes).toEqual(new Set(["2", "4", "solo"])); // les trois niveaux d'aide ont été joués
    expect(answers).toBeGreaterThan(20);
    expect(wheelDone).toBe(true); // la roue a été lancée et l'effet appliqué sans intervention humaine
    expect(last.players.some((p) => p.score > 0)).toBe(true);
    room.dispose();
  });
});
