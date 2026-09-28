"use client";

import { useEffect, useState } from "react";
import { serverNow, useGame } from "@/lib/net";
import { formatScore } from "@/lib/draw";

export function FinalControls() {
  const state = useGame((s) => s.state)!;
  const playerId = useGame((s) => s.playerId);
  const restart = useGame((s) => s.restart);
  const leave = useGame((s) => s.leave);
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((x) => x + 1), 500);
    return () => clearInterval(id);
  }, []);
  if (serverNow() - state.phaseStartedAt < 4200) return null;
  const me = state.players.find((p) => p.id === playerId);
  const rank = state.ranking.find((r) => r.playerId === playerId);
  return (
    <div className="center-cta">
      <div className="final-panel glass">
        {rank && (
          <div style={{ textAlign: "center" }}>
            <div className="display" style={{ fontSize: 30, color: rank.rank === 1 ? "var(--amber)" : "#fff" }}>
              {rank.rank === 1 ? "🏆 Victoire !" : `${rank.rank}e place`}
            </div>
            <div className="muted" style={{ fontWeight: 700 }}>
              {formatScore(rank.score)} points
            </div>
          </div>
        )}
        {me?.isHost ? (
          <button className="btn primary" style={{ fontSize: 18 }} onClick={restart}>
            🔁 Rejouer une émission
          </button>
        ) : (
          <span className="muted" style={{ fontWeight: 700 }}>
            L&apos;hôte peut relancer une partie
          </span>
        )}
        <button className="btn ghost" onClick={leave}>
          Quitter
        </button>
      </div>
    </div>
  );
}
