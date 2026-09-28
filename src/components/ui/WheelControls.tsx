"use client";

import { WHEEL_SEGMENTS } from "@shared/wheel";
import { useGame } from "@/lib/net";
import { PLAYER_COLORS } from "@/lib/layout";
import { audio } from "@/lib/audio";

/** Commandes du gagnant de la manche : lancer la roue puis, si besoin, désigner sa cible. */
export function WheelControls() {
  const state = useGame((s) => s.state)!;
  const playerId = useGame((s) => s.playerId);
  const spin = useGame((s) => s.spin);
  const target = useGame((s) => s.target);
  const w = state.wheel;
  if (!w || w.spinnerId !== playerId) return null;
  if (w.stage === "waiting_spin") {
    return (
      <div className="center-cta">
        <div className="glass" style={{ padding: "10px 16px", fontWeight: 800 }}>
          🏆 Vous avez remporté la manche !
        </div>
        <button
          className="btn primary spin-btn display"
          onClick={() => {
            audio.unlock();
            audio.whoosh();
            spin();
          }}
        >
          🎡 Lancer la roue
        </button>
      </div>
    );
  }
  if (w.stage === "choose_target" && w.resultIndex !== null) {
    const seg = WHEEL_SEGMENTS[w.resultIndex];
    return (
      <div className="center-cta">
        <div className="glass" style={{ padding: "14px 18px", textAlign: "center" }}>
          <div className="display" style={{ fontSize: 30, color: "var(--coral)" }}>
            Choisissez votre cible
          </div>
          <div className="muted" style={{ fontWeight: 700, marginBottom: 10 }}>
            {seg.label} {seg.line2} — cliquez sur un candidat du plateau ou ci-dessous
          </div>
          <div className="targets">
            {state.players
              .filter((p) => p.id !== playerId)
              .map((p) => (
                <button key={p.id} className="btn small" style={{ borderColor: PLAYER_COLORS[p.seat % 8], fontSize: 15 }} onClick={() => target(p.id)}>
                  {p.name} · {p.score} {p.modifiers.shield ? "🛡" : ""}
                </button>
              ))}
          </div>
        </div>
      </div>
    );
  }
  return null;
}
