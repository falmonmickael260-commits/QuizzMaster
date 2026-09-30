"use client";

import dynamic from "next/dynamic";

// Le plateau 3D n'existe que dans le navigateur (WebGL) : pas de rendu serveur.
const Game = dynamic(() => import("./Game"), {
  ssr: false,
  loading: () => (
    <div style={{ position: "fixed", inset: 0, display: "grid", placeItems: "center", background: "#03040b" }}>
      <div className="display" style={{ fontSize: 42, letterSpacing: "0.04em" }}>
        <span className="logo-blind">QUIZZ</span>
        <span className="logo-quizz">MASTER</span>
      </div>
    </div>
  ),
});

export default function GameLoader() {
  return <Game />;
}
