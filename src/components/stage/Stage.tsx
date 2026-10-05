"use client";

import { Environment, Lightformer, PerformanceMonitor } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { Bloom, EffectComposer, SMAA, Vignette } from "@react-three/postprocessing";
import { Suspense, useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import type { PrivateState, PublicRoomState } from "@shared/types";
import { PLAYER_COLORS, tvSeat } from "@/lib/layout";
import { serverNow } from "@/lib/net";
import { CameraDirector } from "./CameraDirector";
import { CandidateSeat } from "./Podium";
import { BigScreen, Confetti, Wheel } from "./SetPieces";
import { Marquee } from "./Marquee";
import { StageLights } from "./StageLights";
import { preloadCharacters } from "./ModelCharacter";
import { TV_STAGE_CENTER, TvSet } from "./TvSet";
import { DEBUG_FX } from "./Studio";

const WHEEL_ON_STAGE = new THREE.Vector3(TV_STAGE_CENTER.x, 0.42, TV_STAGE_CENTER.z - 0.4);

export type Quality = "high" | "low";

interface StageProps {
  state: PublicRoomState | null;
  /** Vraie partie en cours (et non plateau vitrine) : caméra fixe. */
  live?: boolean;
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

/** Exposition : sans le halo lumineux (qualité légère), la scène est éclaircie pour garder l'ambiance du plateau. */
function Exposure({ value }: { value: number }) {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    gl.toneMappingExposure = value;
  }, [gl, value]);
  return null;
}

const FPS_LIMIT = typeof window !== "undefined" ? Number(new URLSearchParams(location.search).get("fps")) || 0 : 0;

// Netteté : résolution native de l'écran (jusqu'à 2x sur Retina) tant que l'appareil suit,
// abaissée par paliers si la fluidité baisse, puis passage en qualité légère en dernier recours.
const MAX_DPR = typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, 2) : 1;
/** Qualité légère (téléphones) : sans effets, mais assez de pixels pour des contours nets. */
const LOW_DPR = 1.75;

export default function Stage({ state, live = false, priv, myId, quality, onQuality, onSelectTarget }: StageProps) {
  useTicker(250);
  const [dpr, setDpr] = useState(() => (quality === "high" ? MAX_DPR : Math.min(MAX_DPR, LOW_DPR)));
  useEffect(() => setDpr(quality === "high" ? MAX_DPR : Math.min(MAX_DPR, LOW_DPR)), [quality]);
  const me = state?.players.find((p) => p.id === myId) ?? null;
  // personnages 3D chargés dès qu'un candidat arrive (pas d'à-coup pendant la partie)
  const charactersKey = state?.players.map((p) => p.character).join(",") ?? "";
  useEffect(() => {
    if (charactersKey) preloadCharacters(charactersKey.split(","));
  }, [charactersKey]);
  const now = serverNow();
  const choosing = state?.phase === "wheel" && state.wheel?.stage === "choose_target" && state.wheel.spinnerId === myId;
  const finalT = state?.phase === "final" ? now - state.phaseStartedAt : 0;

  return (
    <Canvas
      className="stage-canvas"
      dpr={dpr}
      // en mode test (?fps=), on conserve le tampon pour que les captures d'écran automatiques soient fiables
      gl={{ antialias: true, powerPreference: "high-performance", preserveDrawingBuffer: FPS_LIMIT > 0 }}
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
      <Exposure value={quality === "high" ? 1.05 : 1.3} />
      <PerformanceMonitor
        flipflops={4}
        onIncline={() => setDpr((d) => Math.min(quality === "high" ? MAX_DPR : LOW_DPR, d + 0.25))}
        onDecline={() => {
          if (dpr > 1) setDpr((d) => Math.max(1, d - 0.25));
          else onQuality?.("low");
        }}
      />
      <Suspense fallback={null}>
        <Environment resolution={128} frames={1}>
          <Lightformer form="rect" intensity={2} color="#29e7ff" position={[-8, 5, 0]} scale={[4, 8, 1]} />
          <Lightformer form="rect" intensity={2} color="#ff2e63" position={[8, 5, 0]} scale={[4, 8, 1]} />
          <Lightformer form="ring" intensity={3} color="#ffffff" position={[0, 10, 4]} scale={6} />
        </Environment>
        <TvSet quality={quality} />
        <StageLights state={state} quality={quality} />
        <Marquee state={state} />
        <BigScreen state={state} />
        {/* la roue bonus / malus s'installe sur la scène centrale le temps de sa phase */}
        {state?.phase === "wheel" && <Wheel state={state} position={WHEEL_ON_STAGE} rotationY={0} />}
        {/* uniquement les candidats présents, répartis sur toute la largeur du plateau */}
        {[...(state?.players ?? [])]
          .sort((x, y) => x.seat - y.seat)
          .map((player, order, list) => {
            const selectable = !!choosing && player.id !== myId;
            return (
              <CandidateSeat
                key={player.id}
                seat={player.seat}
                place={tvSeat(order, list.length)}
                player={player}
                state={state}
                priv={player.id === myId ? priv : null}
                color={PLAYER_COLORS[player.seat % PLAYER_COLORS.length]}
                isMe={player.id === myId}
                selectable={selectable}
                onSelect={onSelectTarget}
              />
            );
          })}
        <Confetti active={state?.phase === "final" && finalT > 2800} />
        <CameraDirector state={state} mySeat={me?.seat ?? null} fixed={live} />
        {/* tampons 8 bits : une valeur invalide isolée (NaN) ne peut plus se propager à tout l'écran via le flou du bloom */}
        {quality === "high" && !DEBUG_FX.includes("nobloom") && (
          <EffectComposer multisampling={2} frameBufferType={THREE.UnsignedByteType}>
            {/* seuil au-dessus de la luminosité des écrans : le halo reste sur les néons, pas sur les textes */}
            <Bloom mipmapBlur intensity={1} luminanceThreshold={0.78} luminanceSmoothing={0.12} radius={0.7} />
            <Vignette eskil={false} offset={0.25} darkness={0.7} />
            {/* anti-crénelage : le passage par les effets désactive celui du navigateur */}
            <SMAA />
          </EffectComposer>
        )}
      </Suspense>
    </Canvas>
  );
}
