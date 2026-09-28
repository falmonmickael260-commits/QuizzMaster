"use client";

import { useEffect, useState } from "react";
import { serverNow, useGame } from "@/lib/net";

/** Bandeau d'antenne : annonce les choix audacieux et les rebondissements. */
export function LowerThird() {
  const state = useGame((s) => s.state);
  const playerId = useGame((s) => s.playerId);
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((x) => x + 1), 400);
    return () => clearInterval(id);
  }, []);
  if (!state) return null;
  const now = serverNow();
  let tag = "";
  let text = "";
  if (state.phase === "wheel" && state.wheel?.stage === "result" && state.wheel.outcome) {
    tag = "ROUE";
    text = state.wheel.outcome.text;
  } else if (state.phase === "question") {
    const ev = [...state.events].reverse().find((e) => e.type === "mode" && e.data?.mode === "solo" && e.playerId !== playerId && now - e.at < 2600);
    if (ev) {
      const p = state.players.find((x) => x.id === ev.playerId);
      tag = "AUDACE";
      text = `🔥 ${p?.name ?? "Un candidat"} tente le SOLO à 200 points !`;
    }
  } else if (state.phase === "leaderboard") {
    const ev = [...state.events].reverse().find((e) => e.type === "round_winner");
    const p = state.players.find((x) => x.id === ev?.playerId);
    if (p) {
      tag = "MANCHE";
      text = `🏆 ${p.name} remporte la manche et va tourner la roue !`;
    }
  }
  if (!text) return null;
  return (
    <div className="lower-third" key={text}>
      <span className="tag">{tag}</span>
      <span className="txt">{text}</span>
    </div>
  );
}
