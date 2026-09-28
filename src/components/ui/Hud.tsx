"use client";

import { useEffect, useState } from "react";
import { serverNow, useGame } from "@/lib/net";
import { audio } from "@/lib/audio";
import type { Quality } from "../stage/Stage";

const PHASE_LABEL: Record<string, string> = {
  lobby: "PLATEAU OUVERT",
  intro: "GÉNÉRIQUE",
  round_intro: "NOUVELLE MANCHE",
  question: "QUESTION",
  reveal: "RÉPONSE",
  leaderboard: "CLASSEMENT",
  wheel: "ROUE BONUS / MALUS",
  final: "GRANDE FINALE",
};

/** « Habillage antenne » : logo, direct, progression, réglages. */
export function Hud({ quality, onQuality }: { quality: Quality; onQuality: (q: Quality) => void }) {
  const state = useGame((s) => s.state);
  const leave = useGame((s) => s.leave);
  const [muted, setMuted] = useState(audio.muted);
  if (!state) return null;
  const info =
    state.phase === "lobby"
      ? `${state.code} · ${state.players.length}/8 CANDIDATS`
      : state.phase === "final"
        ? PHASE_LABEL.final
        : `MANCHE ${state.round}/${state.totalRounds} · Q${Math.max(1, state.questionNumber)}/${state.totalQuestions} · ${PHASE_LABEL[state.phase]}`;
  return (
    <div className="hud-top">
      <div className="bug glass">
        <span className="live-dot">DIRECT</span>
        <span className="bug-logo display">
          <span style={{ color: "#fff" }}>BLIND</span> <span style={{ color: "var(--coral)" }}>QUIZZ</span>
        </span>
        <span className="bug-info">{info}</span>
      </div>
      <div className="hud-actions">
        <button
          className="btn ghost icon-btn"
          title={muted ? "Activer le son" : "Couper le son"}
          aria-label={muted ? "Activer le son" : "Couper le son"}
          onClick={() => {
            audio.unlock();
            audio.setMuted(!muted);
            setMuted(!muted);
          }}
        >
          {muted ? "🔇" : "🔊"}
        </button>
        <button className="btn ghost icon-btn" title={`Qualité graphique : ${quality === "high" ? "haute" : "économie"}`} aria-label="Qualité graphique" onClick={() => onQuality(quality === "high" ? "low" : "high")}>
          {quality === "high" ? "✨" : "⚡"}
        </button>
        <button
          className="btn ghost icon-btn"
          title="Quitter le plateau"
          aria-label="Quitter le plateau"
          onClick={() => {
            if (confirm("Quitter le plateau ?")) leave();
          }}
        >
          ⏏
        </button>
      </div>
    </div>
  );
}

/** Chrono géant façon habillage TV, synchronisé sur l'échéance personnelle du joueur. */
export function BroadcastTimer() {
  const state = useGame((s) => s.state);
  const priv = useGame((s) => s.priv);
  const [now, setNow] = useState(serverNow());
  const q = state?.phase === "question" ? state.question : null;
  const active = !!q?.text;
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
  if (!q || !q.text) return null;
  const deadline = priv?.deadline ?? q.endsAt;
  const total = deadline - q.startsAt;
  const remaining = Math.max(0, deadline - now);
  const secs = Math.ceil(remaining / 1000);
  const ratio = remaining / total;
  const urgent = secs <= 3;
  const r = 44;
  const c = 2 * Math.PI * r;
  const beat = 1 + Math.pow((remaining % 1000) / 1000, 6) * (urgent ? 0.18 : 0.07);
  return (
    <div className={`bc-timer ${urgent ? "urgent" : ""} ${secs === 0 ? "done" : ""}`} aria-live="off" aria-label={`${secs} secondes`}>
      <svg viewBox="0 0 100 100" style={{ transform: `scale(${beat})` }}>
        <circle cx="50" cy="50" r={r} className="track" />
        <circle cx="50" cy="50" r={r} className="bar" strokeDasharray={c} strokeDashoffset={c * (1 - ratio)} />
      </svg>
      <span className="display">{secs}</span>
      {secs === 0 && <em>VERROUILLÉ</em>}
    </div>
  );
}

export function Toasts() {
  const toasts = useGame((s) => s.toasts);
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast glass ${t.tone}`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}
