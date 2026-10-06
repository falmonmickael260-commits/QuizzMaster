"use client";

// Habillage « plateau TV » : carte de manche (haut gauche), panneau de question central,
// choix de l'aide 2 / 4 / SOLO (droite), barre des candidats et bilan personnel (bas).
// Les règles sont inchangées : ce fichier ne fait qu'afficher l'état du serveur et envoyer les mêmes actions.

import { useCallback, useEffect, useRef, useState } from "react";
import { MODE_LABELS, MODE_ORDER, MODE_POINTS, QUESTIONS_PER_ROUND, REVEAL_LOCK_MS, type AnswerMode } from "@shared/config";
import { CATEGORY_BY_ID } from "@shared/categories";
import type { PlayerResult, PublicRoomState } from "@shared/types";
import { serverNow, useGame } from "@/lib/net";
import { formatScore } from "@/lib/draw";
import { PLAYER_COLORS } from "@/lib/layout";
import { audio } from "@/lib/audio";
import { Avatar } from "./Avatar";

// ─── Outils ───────────────────────────────────────────────────────────────────

function useFrameNow(active: boolean) {
  const [now, setNow] = useState(serverNow());
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    const loop = () => {
      setNow(serverNow());
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [active]);
  return now;
}

function useRolling(value: number) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const step = () => {
      const p = Math.min(1, (performance.now() - start) / 1100);
      const v = a + (value - a) * (1 - Math.pow(1 - p, 3));
      setShown(v);
      from.current = v;
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return shown;
}

/** Historique des résultats par question, reconstitué côté client à chaque révélation. */
const history = new Map<string, Map<number, Record<string, PlayerResult>>>();
function useResultsHistory(state: PublicRoomState) {
  const byQ = history.get(state.code) ?? new Map<number, Record<string, PlayerResult>>();
  if (!history.has(state.code)) history.set(state.code, byQ);
  if (state.reveal && !byQ.has(state.reveal.questionIndex)) byQ.set(state.reveal.questionIndex, state.reveal.results);
  if (state.phase === "lobby") byQ.clear();
  return byQ;
}

/** Le verdict n'est montré qu'après l'écran « réponses verrouillées ». */
function revealVisible(state: PublicRoomState, now: number) {
  return state.phase !== "reveal" || now - state.phaseStartedAt >= REVEAL_LOCK_MS;
}

// ─── Carte de manche (haut gauche) ───────────────────────────────────────────

export function RoundCard() {
  const state = useGame((s) => s.state)!;
  const hist = useResultsHistory(state);
  const q = state.question;
  const cat = q ? CATEGORY_BY_ID[q.category] : null;
  const inRound = q ? q.inRound : state.questionNumber > 0 ? (state.questionNumber - 1) % QUESTIONS_PER_ROUND : -1;
  const roundStart = (state.round - 1) * QUESTIONS_PER_ROUND;
  const title = state.phase === "lobby" ? `Salon ${state.code}` : state.phase === "final" ? "Grande finale" : `Manche ${state.round}/${state.totalRounds}`;
  const sub = state.phase === "lobby" ? `${state.players.length}/8 candidats` : state.phase === "final" ? `${state.totalQuestions} questions jouées` : cat ? `${cat.emoji} ${cat.label}` : `Question ${Math.max(1, state.questionNumber)}/${state.totalQuestions}`;
  return (
    <div className="tv-round tv-glass">
      <div className="tv-round-title">{title}</div>
      <div className="tv-round-sub">{sub}</div>
      {state.phase !== "lobby" && state.phase !== "final" && (
        <div className="tv-round-steps" aria-label={`Question ${inRound + 1} sur ${QUESTIONS_PER_ROUND}`}>
          {Array.from({ length: QUESTIONS_PER_ROUND }, (_, i) => {
            const done = hist.has(roundStart + i) && !(state.phase === "question" && i === inRound);
            const current = i === inRound && (state.phase === "question" || state.phase === "reveal");
            return <i key={i} className={current ? "current" : done ? "done" : ""} />;
          })}
        </div>
      )}
    </div>
  );
}

// ─── Actions partagées par le panneau central et le panneau d'aide ───────────

function useAnswering() {
  const state = useGame((s) => s.state)!;
  const priv = useGame((s) => s.priv);
  const chooseMode = useGame((s) => s.chooseMode);
  const answer = useGame((s) => s.answer);
  const q = state.question;
  const inQuestion = state.phase === "question" && !!q?.text;
  const inLock = state.phase === "reveal" && serverNow() - state.phaseStartedAt < REVEAL_LOCK_MS + 100;
  const now = useFrameNow(inQuestion || inLock);
  const deadline = priv?.deadline ?? q?.endsAt ?? 0;
  const total = q ? deadline - q.startsAt : 12000;
  const remaining = q ? Math.max(0, deadline - Math.max(now, q.startsAt)) : 0;
  const expired = inQuestion && remaining <= 0;
  const canAct = inQuestion && !expired && !priv?.answered;
  return { state, priv, chooseMode, answer, q, now, total, remaining, expired, canAct, inQuestion };
}

// l'état « en cours d'envoi » est partagé entre les deux panneaux
const pendingStore = { value: null as string | null, listeners: new Set<() => void>() };
function usePending(resetKey: string) {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((x) => x + 1);
    pendingStore.listeners.add(l);
    return () => void pendingStore.listeners.delete(l);
  }, []);
  const set = useCallback((v: string | null) => {
    pendingStore.value = v;
    pendingStore.listeners.forEach((l) => l());
  }, []);
  useEffect(() => set(null), [resetKey, set]);
  // filet de sécurité si le serveur ne confirme pas (refus, coupure réseau)
  const current = pendingStore.value;
  useEffect(() => {
    if (!current) return;
    const t = setTimeout(() => set(null), 2500);
    return () => clearTimeout(t);
  }, [current, set]);
  return [pendingStore.value, set] as const;
}

// ─── Panneau d'aide 2 / 4 / SOLO (droite) ────────────────────────────────────

function ModeButtons({ variant, only }: { variant: "side" | "inline"; only?: AnswerMode[] }) {
  const { priv, chooseMode, canAct, q } = useAnswering();
  const [pending, setPending] = usePending(`${q?.index}|${priv?.mode}|${priv?.answered}`);
  const chosen = priv?.mode ?? (pending?.startsWith("mode:") ? (pending.slice(5) as AnswerMode) : null);
  const selectable = canAct && !priv?.mode && !pending;
  return (
    <div className={`tv-modes ${variant}`}>
      {MODE_ORDER.filter((m) => !only || only.includes(m)).map((m, i) => {
        const info = MODE_LABELS[m];
        const state = chosen === m ? "chosen" : chosen ? "off" : selectable ? "ready" : "idle";
        return (
          <button
            key={m}
            className={`tv-mode ${state}`}
            style={{ ["--mode" as string]: info.color }}
            disabled={!selectable}
            onClick={() => {
              audio.unlock();
              setPending(`mode:${m}`);
              chooseMode(m);
            }}
          >
            <span className="tv-mode-badge display">{m === "solo" ? "✍" : m}</span>
            <span className="tv-mode-text">
              <b>{info.name}</b>
              <small>{info.subtitle}</small>
            </span>
            <span className="tv-mode-pts display">{MODE_POINTS[m]}</span>
            {variant === "side" && <kbd>{i + 1}</kbd>}
          </button>
        );
      })}
    </div>
  );
}

export function ModePanel() {
  const state = useGame((s) => s.state)!;
  if (state.phase !== "question" && state.phase !== "reveal") return null;
  return (
    <div className="tv-side tv-glass">
      <div className="tv-side-title">Votre aide</div>
      <ModeButtons variant="side" />
    </div>
  );
}

// ─── Panneau central : question, réponses, chrono ────────────────────────────

function TimerRing({ remaining, total }: { remaining: number; total: number }) {
  const secs = Math.ceil(remaining / 1000);
  const ratio = total > 0 ? remaining / total : 0;
  const r = 42;
  const c = 2 * Math.PI * r;
  const urgent = secs <= 3;
  return (
    <div className={`tv-timer ${urgent ? "urgent" : ""} ${secs === 0 ? "done" : ""}`} aria-label={`${secs} secondes`}>
      <svg viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={r} className="track" />
        <circle cx="50" cy="50" r={r} className="bar" strokeDasharray={c} strokeDashoffset={c * (1 - ratio)} />
      </svg>
      <span className="display">{secs}</span>
    </div>
  );
}

const PHASE_TEXT: Record<string, string> = {
  intro: "Bienvenue sur le plateau !",
  round_intro: "Nouvelle manche",
  leaderboard: "Classement de la manche",
  wheel: "La roue bonus / malus",
};

export function QuestionPanel() {
  const { state, priv, chooseMode, answer, q, now, total, remaining, expired, canAct } = useAnswering();
  const playerId = useGame((s) => s.playerId);
  const setAutopilot = useGame((s) => s.setAutopilot);
  const me = state.players.find((p) => p.id === playerId);
  const [pending, setPending] = usePending(`${q?.index}|${priv?.mode}|${priv?.answered}`);
  const [solo, setSolo] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => setSolo(""), [q?.index]);
  useEffect(() => {
    if (priv?.mode === "solo" && !priv.answered) inputRef.current?.focus();
  }, [priv?.mode, priv?.answered]);

  const pickAnswer = useCallback(
    (v: string, solo = false) => {
      if (pendingStore.value) return;
      setPending(`answer:${v}`);
      answer(v, solo);
    },
    [answer, setPending],
  );

  // raccourcis clavier : 1/2/3 pour l'aide, A-D pour les propositions
  useEffect(() => {
    if (!canAct) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT" || pendingStore.value) return;
      if (!priv?.mode) {
        const m = MODE_ORDER[Number(e.key) - 1];
        if (m) {
          setPending(`mode:${m}`);
          chooseMode(m);
        }
      } else if (priv.options.length) {
        const i = "abcd".indexOf(e.key.toLowerCase());
        if (i >= 0 && priv.options[i]) pickAnswer(priv.options[i]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canAct, priv, chooseMode, pickAnswer, setPending]);

  if (!me) return null;
  const reveal = state.phase === "reveal" ? state.reveal : null;
  const verdict = reveal && revealVisible(state, now);
  const locked = (state.phase === "reveal" && !verdict) || (expired && !priv?.answered);
  const r = reveal?.results[me.id];
  const options = priv && q && priv.questionIndex === q.index ? priv.options : [];

  const badges: React.ReactNode[] = [];
  if (me.autopilot)
    badges.push(
      <button key="auto" className="tv-badge" onClick={() => setAutopilot(false)} title="Reprendre la main">
        🤖 Pilote auto
      </button>,
    );
  if (me.modifiers.shield) badges.push(<span key="s" className="tv-badge good">🛡 Bouclier</span>);
  if (me.modifiers.pointsMultiplier === 2) badges.push(<span key="x2" className="tv-badge good">Points x2</span>);
  if (me.modifiers.pointsMultiplier === 0.5) badges.push(<span key="h" className="tv-badge bad">Demi-points</span>);
  if (me.modifiers.timeDeltaSec > 0) badges.push(<span key="t" className="tv-badge good">+{me.modifiers.timeDeltaSec} s</span>);
  if (me.modifiers.timeDeltaSec < 0) badges.push(<span key="t" className="tv-badge bad">{me.modifiers.timeDeltaSec} s</span>);

  // ── contenu de la zone de réponse
  let area: React.ReactNode = null;
  let status: React.ReactNode = null;
  const optionClass = (o: string) => {
    if (verdict && reveal) {
      if (o === reveal.correctAnswer) return "correct";
      if (r?.answer === o) return "wrong";
      return "faded";
    }
    if (priv?.answer === o || pending === `answer:${o}`) return "selected";
    if (priv?.answered || pending) return "faded";
    return "";
  };
  const optionGrid = (list: string[]) => (
    <div className={`tv-answers ${list.length === 2 ? "two" : ""}`}>
      {list.map((o, i) => (
        <button key={o} className={`tv-answer ${optionClass(o)}`} disabled={!canAct || !!pending} onClick={() => pickAnswer(o)}>
          <span className="tv-letter display">{"ABCD"[i]}</span>
          <span className="tv-answer-text">{o}</span>
        </button>
      ))}
    </div>
  );

  const soloForm = (direct: boolean) => (
    <form
      className="tv-solo"
      onSubmit={(e) => {
        e.preventDefault();
        if (solo.trim()) pickAnswer(solo.trim(), direct);
      }}
    >
      <input ref={inputRef} placeholder={direct ? "SOLO : écrivez directement votre réponse…" : "Écrivez votre réponse…"} value={solo} onChange={(e) => setSolo(e.target.value)} maxLength={60} autoComplete="off" autoCorrect="off" enterKeyHint="send" disabled={!canAct} />
      <button type="submit" disabled={!canAct || !solo.trim() || !!pending}>
        {pending ? "Envoi…" : `SOLO · ${MODE_POINTS.solo}`}
      </button>
    </form>
  );

  if (state.phase === "question" && q && !q.text) {
    status = <div className="tv-status">Question {q.inRound + 1} · préparez-vous…</div>;
  } else if (state.phase === "question" && q) {
    if (!priv?.mode && !expired) {
      area = (
        <>
          <div className="tv-hint">Écrivez votre réponse (SOLO) ou demandez 2 ou 4 propositions</div>
          {soloForm(true)}
          <ModeButtons variant="inline" only={["2", "4"]} />
        </>
      );
    } else if (priv?.mode === "solo") {
      area = priv.answered ? (
        <div className="tv-answers single">
          <div className="tv-answer selected">
            <span className="tv-letter display">✍</span>
            <span className="tv-answer-text">{priv.answer}</span>
          </div>
        </div>
      ) : (
        soloForm(false)
      );
    } else if (options.length) {
      area = optionGrid(options);
    }
    if (priv?.answered) status = <div className="tv-status good">✓ Réponse verrouillée — verdict à la fin du chrono</div>;
    else if (expired) status = <div className="tv-status bad">🔒 Les réponses sont verrouillées</div>;
  } else if (reveal && q) {
    if (options.length) area = optionGrid(options);
    else if (r?.answer)
      area = (
        <div className="tv-answers single">
          <div className={`tv-answer ${verdict ? (r.correct ? "correct" : "wrong") : "selected"}`}>
            <span className="tv-letter display">✍</span>
            <span className="tv-answer-text">{r.answer}</span>
          </div>
        </div>
      );
    if (!verdict) status = <div className="tv-status">🔒 Les réponses sont verrouillées</div>;
    else if (r?.correct)
      status = (
        <div className="tv-status good">
          +{r.points} points · bonne réponse en {r.mode === "solo" ? "SOLO" : `${r.mode} réponses`}
          {r.multiplier !== 1 ? ` (x${r.multiplier})` : ""}
        </div>
      );
    else
      status = (
        <div className="tv-status bad">
          {r?.timedOut || !r?.answer ? "Temps écoulé" : "Raté"} · la bonne réponse était « {reveal.correctAnswer} »
        </div>
      );
  } else {
    status = <div className="tv-status">{PHASE_TEXT[state.phase] ?? ""}</div>;
  }

  const questionText = q?.text && (state.phase === "question" || state.phase === "reveal") ? q.text : null;
  return (
    <div className={`tv-panel tv-glass ${locked ? "locked" : ""}`} aria-label="Question">
      <div className="tv-panel-main">
        {badges.length > 0 && <div className="tv-badges">{badges}</div>}
        {questionText ? <div className="tv-question">{questionText}</div> : state.phase === "question" ? null : <div className="tv-question dim">{PHASE_TEXT[state.phase] ?? ""}</div>}
        {area}
        {status}
        {verdict && reveal?.explanation && <div className="tv-explain">{reveal.explanation}</div>}
      </div>
      {state.phase === "question" && q?.text && <TimerRing remaining={remaining} total={total} />}
    </div>
  );
}

// ─── Barre des candidats + bilan (bas) ───────────────────────────────────────

export function PlayersBar() {
  const state = useGame((s) => s.state)!;
  const playerId = useGame((s) => s.playerId);
  const now = useFrameNow(state.phase === "reveal" && serverNow() - state.phaseStartedAt < REVEAL_LOCK_MS + 100);
  const hist = useResultsHistory(state);
  const verdict = revealVisible(state, now);
  const roundStart = (state.round - 1) * QUESTIONS_PER_ROUND;
  const leaderScore = Math.max(...state.players.map((p) => p.score));
  const me = state.players.find((p) => p.id === playerId);
  const played = [...hist.keys()].filter((k) => verdict || k !== state.reveal?.questionIndex);
  const myCorrect = me ? played.filter((k) => hist.get(k)?.[me.id]?.correct).length : 0;

  return (
    <div className="tv-bottom">
      <div className="tv-players">
        {[...state.players]
          .sort((a, b) => a.seat - b.seat)
          .map((p) => (
            <PlayerCard key={p.id} character={p.character} name={p.name} color={PLAYER_COLORS[p.seat % PLAYER_COLORS.length]} score={p.score - (!verdict ? (state.reveal?.results[p.id]?.points ?? 0) : 0)} me={p.id === playerId} leader={p.score === leaderScore && leaderScore > 0} answered={state.phase === "question" && p.answered} offline={!p.connected} dots={Array.from({ length: QUESTIONS_PER_ROUND }, (_, i) => {
              const res = hist.get(roundStart + i)?.[p.id];
              if (!res || (!verdict && roundStart + i === state.reveal?.questionIndex)) return "";
              return res.correct ? "good" : "bad";
            })} />
          ))}
      </div>
      {me && state.phase !== "lobby" && (
        <div className="tv-tally tv-glass">
          <div className="tv-tally-title">
            Réponses correctes : <b>{myCorrect}/{played.length}</b>
          </div>
          <div className="tv-tally-bar">
            {Array.from({ length: Math.max(played.length, 1) }, (_, i) => (
              <i key={i} className={i < myCorrect ? "on" : ""} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PlayerCard({ character, name, color, score, me, leader, answered, offline, dots }: { character: string; name: string; color: string; score: number; me: boolean; leader: boolean; answered: boolean; offline: boolean; dots: string[] }) {
  const shown = useRolling(score);
  return (
    <div className={`tv-player tv-glass ${me ? "me" : ""} ${offline ? "offline" : ""}`} style={{ ["--pc" as string]: color }}>
      <Avatar character={character} size={46} ring={color} />
      <div className="tv-player-info">
        <div className="tv-player-name">
          {name}
          {leader && <span className="tv-crown">👑</span>}
          {answered && <span className="tv-answered" title="A répondu">✓</span>}
        </div>
        <div className="tv-player-score display">{formatScore(shown)} pts</div>
        <div className="tv-dots">
          {dots.map((d, i) => (
            <i key={i} className={d} />
          ))}
        </div>
      </div>
    </div>
  );
}
