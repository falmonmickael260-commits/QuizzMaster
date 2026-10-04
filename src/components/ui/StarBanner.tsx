"use client";

import { useEffect, useState } from "react";
import { starFocus } from "@/lib/focus";
import { serverNow, useGame } from "@/lib/net";
import { Avatar } from "./Avatar";

/** Bandeau doré du « moment star » : affiché pendant le gros plan sur un SOLO réussi. */
export function StarBanner() {
  const state = useGame((s) => s.state);
  const playerId = useGame((s) => s.playerId);
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((x) => x + 1), 150);
    return () => clearInterval(id);
  }, []);
  const star = starFocus(state, serverNow());
  if (!star || !state?.reveal) return null;
  const pts = state.reveal.results[star.player.id]?.points ?? 200;
  const me = star.player.id === playerId;
  return (
    <div className="star-banner" key={star.player.id} role="status">
      <div className="star-rays" aria-hidden />
      <Avatar character={star.player.character} size={64} ring="#ffd76a" />
      <div className="star-text">
        <div className="star-kicker display">★ SOLO RÉUSSI ★</div>
        <div className="star-name display">{me ? "BRAVO, C'EST VOUS !" : star.player.name.toUpperCase()}</div>
      </div>
      <div className="star-pts display">+{pts}</div>
    </div>
  );
}
