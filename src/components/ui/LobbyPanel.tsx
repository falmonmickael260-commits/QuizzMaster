"use client";

import { MAX_ROUNDS, QUESTIONS_PER_ROUND } from "@shared/config";
import { useGame } from "@/lib/net";
import { PLAYER_COLORS } from "@/lib/layout";
import { audio } from "@/lib/audio";

export function LobbyPanel() {
  const state = useGame((s) => s.state)!;
  const playerId = useGame((s) => s.playerId);
  const start = useGame((s) => s.start);
  const setRounds = useGame((s) => s.setRounds);
  const toast = useGame((s) => s.toast);
  const addBots = useGame((s) => s.addBots);
  const removeBots = useGame((s) => s.removeBots);
  const setAutopilot = useGame((s) => s.setAutopilot);
  const me = state.players.find((p) => p.id === playerId);
  const isHost = !!me?.isHost;
  const link = typeof location !== "undefined" ? `${location.origin}/?room=${state.code}` : "";

  return (
    <div className="lobby-panel glass">
      <span className="label">Code de la partie</span>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div className="room-code display">{state.code}</div>
        <button
          className="btn ghost small"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(link);
              toast("Lien d'invitation copié !", "success");
            } catch {
              toast(link);
            }
          }}
        >
          🔗 Inviter
        </button>
      </div>
      <div className="players-list">
        {state.players.map((p) => (
          <div key={p.id} className="player-row">
            <span className="swatch" style={{ background: PLAYER_COLORS[p.seat % PLAYER_COLORS.length] }} />
            <span style={{ flex: 1 }}>{p.name}</span>
            {p.isHost && <span className="badge">HÔTE</span>}
            {p.id === playerId && <span className="badge good">VOUS</span>}
            {p.bot && <span className="badge">🤖 SIMULÉ</span>}
            {!p.connected && <span className="badge bad">ABSENT</span>}
          </div>
        ))}
      </div>
      {isHost ? (
        <div className="stack" style={{ gap: 10 }}>
          <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
            <button className="btn ghost small" disabled={state.players.length >= 8} onClick={() => addBots(3)}>
              🤖 Ajouter 3 candidats simulés
            </button>
            {state.players.some((p) => p.bot) && (
              <button className="btn ghost small" onClick={removeBots}>
                Retirer les simulés
              </button>
            )}
            <label className="row" style={{ gap: 6, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              <input type="checkbox" checked={!!me?.autopilot} onChange={(e) => setAutopilot(e.target.checked)} />
              Pilote automatique (je regarde)
            </label>
          </div>
          <div>
            <span className="label">Manches · {state.settings.rounds * QUESTIONS_PER_ROUND} questions</span>
            <div className="rounds">
              {Array.from({ length: MAX_ROUNDS }, (_, i) => i + 1).map((r) => (
                <button key={r} className={r === state.settings.rounds ? "active" : ""} onClick={() => setRounds(r)}>
                  {r}
                </button>
              ))}
            </div>
          </div>
          <button
            className="btn primary"
            style={{ fontSize: 20 }}
            onClick={() => {
              audio.unlock();
              audio.select();
              start();
            }}
          >
            🎬 Lancer l&apos;émission
          </button>
          {state.players.length < 2 && <small className="muted">Astuce : partagez le code pour jouer à plusieurs (jusqu&apos;à 8). Vous pouvez aussi lancer seul.</small>}
        </div>
      ) : (
        <p className="muted" style={{ margin: 0, fontWeight: 700 }}>
          En attente du lancement par l&apos;hôte… ({state.settings.rounds} manche{state.settings.rounds > 1 ? "s" : ""})
        </p>
      )}
    </div>
  );
}
