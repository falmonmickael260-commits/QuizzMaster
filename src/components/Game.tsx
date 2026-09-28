"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Phase } from "@shared/types";
import { REVEAL_LOCK_MS } from "@shared/config";
import { demoState } from "@/lib/demo";
import { WHEEL_SEGMENTS } from "@shared/wheel";
import { useGame } from "@/lib/net";
import { audio } from "@/lib/audio";
import { markFontsLoaded, setFonts } from "@/lib/draw";
import Stage, { type Quality } from "./stage/Stage";
import { Home } from "./ui/Home";
import { BroadcastTimer, Hud, Toasts } from "./ui/Hud";
import { LobbyPanel } from "./ui/LobbyPanel";
import { Console } from "./ui/Console";
import { WheelControls } from "./ui/WheelControls";
import { FinalControls } from "./ui/FinalControls";
import { LowerThird } from "./ui/LowerThird";

function initialQuality(): Quality {
  if (typeof window === "undefined") return "high";
  const forced = new URLSearchParams(location.search).get("quality");
  if (forced === "high" || forced === "low") return forced;
  try {
    const saved = localStorage.getItem("bq-quality");
    if (saved === "high" || saved === "low") return saved;
  } catch {
    /* ignore */
  }
  const coarse = window.matchMedia?.("(pointer: coarse)").matches;
  return coarse || window.innerWidth < 800 ? "low" : "high";
}

export default function Game() {
  const state = useGame((s) => s.state);
  const priv = useGame((s) => s.priv);
  const playerId = useGame((s) => s.playerId);
  const status = useGame((s) => s.status);
  const connect = useGame((s) => s.connect);
  const target = useGame((s) => s.target);
  const [quality, setQuality] = useState<Quality>(initialQuality);
  const [forcedQuality] = useState(() => typeof window !== "undefined" && !!new URLSearchParams(location.search).get("quality"));

  useEffect(() => {
    const f = (window as unknown as { __BQ_FONTS?: { display: string; text: string } }).__BQ_FONTS;
    if (f) setFonts(f.display, f.text);
    document.fonts?.ready.then(() => markFontsLoaded());
    connect();
  }, [connect]);

  useEffect(() => {
    try {
      localStorage.setItem("bq-quality", quality);
    } catch {
      /* ignore */
    }
  }, [quality]);

  useSoundDesign();

  const me = state?.players.find((p) => p.id === playerId) ?? null;
  const demoPhase = useMemo(() => new URLSearchParams(location.search).get("demo") as Phase | null, []);
  const vitrine = useVitrine(!state ? (demoPhase ?? "attract") : null);

  return (
    <div className="stage-root" onPointerDown={() => audio.unlock()}>
      <Stage state={state ?? vitrine} priv={priv} myId={playerId} quality={quality} onQuality={forcedQuality ? undefined : setQuality} onSelectTarget={target} />
      {!state && !demoPhase && <Home />}
      {state && (
        <>
          <Hud quality={quality} onQuality={setQuality} />
          <BroadcastTimer />
          {state.phase === "lobby" && <LobbyPanel />}
          {me && state.phase !== "lobby" && state.phase !== "final" && !(state.phase === "wheel" && state.wheel?.spinnerId === playerId && (state.wheel.stage === "waiting_spin" || state.wheel.stage === "choose_target")) && <Console />}
          {state.phase === "wheel" && <WheelControls />}
          {state.phase === "final" && <FinalControls />}
          <LowerThird />
        </>
      )}
      <Toasts />
      {status === "closed" && <div className="conn-banner">Connexion au plateau perdue — reconnexion…</div>}
    </div>
  );
}

/** Plateau « vitrine » peuplé de candidats fictifs quand on n'est pas encore dans une partie. */
function useVitrine(phase: Phase | "attract" | null) {
  const [start] = useState(() => Date.now());
  const [now, setNow] = useState(start);
  useEffect(() => {
    if (!phase) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [phase]);
  return phase ? demoState(phase, start, now) : null;
}

/** Habillage sonore piloté par l'état de la partie. */
function useSoundDesign() {
  const state = useGame((s) => s.state);
  const priv = useGame((s) => s.priv);
  const playerId = useGame((s) => s.playerId);
  const prev = useRef<{ phase?: string; stage?: string; qText?: boolean; mode?: string | null; answered?: boolean }>({});
  const lastTick = useRef(-1);

  useEffect(() => {
    if (!state) {
      audio.music("none");
      audio.ambience(0);
      prev.current = {};
      return;
    }
    const p = prev.current;
    const phase = state.phase;
    const stage = state.wheel?.stage;
    const me = state.players.find((x) => x.id === playerId);
    if (phase !== p.phase) {
      // rumeur du public : forte entre les questions, presque éteinte pendant la réflexion
      audio.ambience(phase === "question" ? 0.15 : phase === "final" || phase === "intro" ? 1 : 0.6);
      if (phase === "lobby") audio.music("lobby");
      if (phase === "intro") {
        audio.music("intro");
        audio.whoosh();
        audio.applause(2.5);
      }
      if (phase === "round_intro") {
        audio.music("intro");
        audio.whoosh();
      }
      if (phase === "question") audio.music("suspense");
      if (phase === "reveal") {
        audio.music("none");
        audio.lock();
        // la bonne réponse apparaît après l'écran « réponses verrouillées »
        const r = state.reveal?.results[playerId ?? ""];
        const anyCorrect = Object.values(state.reveal?.results ?? {}).some((x) => x.correct);
        setTimeout(() => {
          if (r?.correct) {
            audio.correct(r.mode === "solo");
            setTimeout(() => audio.points(), 500);
          } else if (r) audio.wrong();
          if (anyCorrect) setTimeout(() => audio.applause(1.5), 300);
        }, REVEAL_LOCK_MS);
      }
      if (phase === "leaderboard") {
        audio.music("lobby");
        audio.whoosh();
      }
      if (phase === "wheel") {
        audio.music("suspense");
        audio.whoosh();
      }
      if (phase === "final") {
        audio.music("none");
        audio.drumroll(2.4);
        setTimeout(() => {
          audio.fanfare();
          audio.applause(4);
          audio.music("final");
        }, 2600);
      }
    }
    if (phase === "question" && state.question?.text && !p.qText) {
      audio.music("think");
      audio.whoosh();
    }
    if (phase === "wheel" && stage !== p.stage) {
      if (stage === "spinning") audio.drumroll(state.wheel!.spinDurationMs / 1000);
      if (stage === "result" && state.wheel?.outcome) {
        const seg = WHEEL_SEGMENTS.find((x) => x.id === state.wheel!.outcome!.segmentId);
        if (seg?.tone === "malus" || seg?.tone === "steal") audio.malus();
        else audio.bonus();
      }
    }
    if (me && me.mode && me.mode !== p.mode) audio.modePick(me.mode);
    if (me && me.answered && !p.answered) audio.lock();
    prev.current = { phase, stage, qText: !!state.question?.text, mode: me?.mode ?? null, answered: me?.answered ?? false };
  }, [state, playerId]);

  // tic-tac du chrono personnel
  useEffect(() => {
    if (state?.phase !== "question" || !priv?.deadline || priv.answered) return;
    const id = setInterval(() => {
      const offset = useGame.getState().clockOffset;
      const remain = Math.ceil((priv.deadline! - (Date.now() + offset)) / 1000);
      if (remain !== lastTick.current && remain >= 0 && remain <= 12) {
        lastTick.current = remain;
        if (remain > 0) audio.tick(remain <= 3, 1 - (remain - 1) / 11);
      }
    }, 100);
    return () => clearInterval(id);
  }, [state?.phase, priv?.deadline, priv?.answered]);
}
