"use client";

import { useState } from "react";
import { useGame } from "@/lib/net";
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
