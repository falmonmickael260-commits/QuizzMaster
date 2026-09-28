"use client";

import { Environment, Lightformer, PerformanceMonitor } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import { Suspense, useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import type { PrivateState, PublicRoomState } from "@shared/types";
import { PLAYER_COLORS, SEATS } from "@/lib/layout";
import { serverNow } from "@/lib/net";
import { CameraDirector } from "./CameraDirector";
import { CandidateSeat } from "./Podium";
import { Audience, BigScreen, Confetti, Host, LivePanel, Wheel } from "./SetPieces";
import { DEBUG_FX, Studio } from "./Studio";

export type Quality = "high" | "low";

interface StageProps {
  state: PublicRoomState | null;
  priv: PrivateState | null;
  myId: string | null;
  quality: Quality;
  onQuality?: (q: Quality) => void;
  onSelectTarget?: (playerId: string) => void;
}

/** Rafraîchit l'arbre 3D quelques fois par seconde pour les réactions qui dépendent du temps. */
function useTicker(ms: number) {
  const [, set] = useState(0);
  useEffect(() => {
    const id = setInterval(() => set((x) => x + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
}

/** Limiteur de cadence optionnel (?fps=10) : utile pour les tests automatisés et les appareils modestes. */
function FpsLimiter({ fps }: { fps: number }) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    const id = setInterval(() => invalidate(), 1000 / fps);
    return () => clearInterval(id);
  }, [fps, invalidate]);
  return null;
}

const FPS_LIMIT = typeof window !== "undefined" ? Number(new URLSearchParams(location.search).get("fps")) || 0 : 0;

export default function Stage({ state, priv, myId, quality, onQuality, onSelectTarget }: StageProps) {
  useTicker(250);
  const me = state?.players.find((p) => p.id === myId) ?? null;
  const colors = useMemo(() => {
    const out: Record<string, string> = {};
    state?.players.forEach((p) => (out[p.id] = PLAYER_COLORS[p.seat % PLAYER_COLORS.length]));
    return out;
  }, [state?.players]);
  const now = serverNow();
  const phase = state?.phase ?? "none";
  const choosing = state?.phase === "wheel" && state.wheel?.stage === "choose_target" && state.wheel.spinnerId === myId;
  const finalT = state?.phase === "final" ? now - state.phaseStartedAt : 0;
  const excitement = !state ? 0.2 : state.phase === "final" || state.phase === "intro" ? 1 : state.phase === "reveal" && now - state.phaseStartedAt < 3500 ? 0.8 : state.phase === "wheel" && state.wheel?.stage === "result" ? 0.9 : 0.1;

  return (
    <Canvas
      className="stage-canvas"
      dpr={quality === "high" ? [1, 2] : [1, 1.5]}
      // en mode test (?fps=), on conserve le tampon pour que les captures d'écran automatiques soient fiables
      gl={{ antialias: quality === "high", powerPreference: "high-performance", preserveDrawingBuffer: FPS_LIMIT > 0 }}
      camera={{ position: [0, 9, 26], fov: 45, near: 0.1, far: 120 }}
      frameloop={FPS_LIMIT ? "demand" : "always"}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
      }}
    >
      <color attach="background" args={["#03040b"]} />
      <fog attach="fog" args={["#03040b", 24, 55]} />
      {FPS_LIMIT > 0 && <FpsLimiter fps={FPS_LIMIT} />}
      <PerformanceMonitor onDecline={() => onQuality?.("low")} />
      <Suspense fallback={null}>
        <Environment resolution={128} frames={1}>
          <Lightformer form="rect" intensity={2} color="#29e7ff" position={[-8, 5, 0]} scale={[4, 8, 1]} />
          <Lightformer form="rect" intensity={2} color="#ff2e63" position={[8, 5, 0]} scale={[4, 8, 1]} />
          <Lightformer form="ring" intensity={3} color="#ffffff" position={[0, 10, 4]} scale={6} />
        </Environment>
        <Studio phase={phase} quality={quality} />
        <BigScreen state={state} />
        <LivePanel state={state} colors={colors} />
        <Wheel state={state} />
        <Host state={state} />
        <Audience excitement={excitement} count={quality === "high" ? 1 : 1.6} />
        {SEATS.map((seat) => {
          const player = state?.players.find((p) => p.seat === seat.index) ?? null;
          const selectable = !!choosing && !!player && player.id !== myId;
          // pendant l'émission, les places inoccupées disparaissent du plateau (elles ne bougent jamais)
          if (!player && state && state.phase !== "lobby") return null;
          return (
            <CandidateSeat
              key={seat.index}
              seat={seat.index}
              player={player}
              state={state}
              priv={player && player.id === myId ? priv : null}
              color={PLAYER_COLORS[seat.index % PLAYER_COLORS.length]}
              isMe={!!player && player.id === myId}
              selectable={selectable}
              onSelect={onSelectTarget}
            />
          );
        })}
        <Confetti active={state?.phase === "final" && finalT > 2800} />
        <CameraDirector state={state} mySeat={me?.seat ?? null} />
        {/* tampons 8 bits : une valeur invalide isolée (NaN) ne peut plus se propager à tout l'écran via le flou du bloom */}
        {quality === "high" && !DEBUG_FX.includes("nobloom") && (
          <EffectComposer multisampling={0} frameBufferType={THREE.UnsignedByteType}>
            <Bloom mipmapBlur intensity={0.85} luminanceThreshold={0.55} luminanceSmoothing={0.2} radius={0.7} />
            <Vignette eskil={false} offset={0.25} darkness={0.75} />
          </EffectComposer>
        )}
      </Suspense>
    </Canvas>
  );
}
