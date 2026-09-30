"use client";

import { RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { getCharacter } from "@shared/characters";
import type { PrivateState, PublicPlayer, PublicRoomState } from "@shared/types";
import { drawPodiumFront, drawPodiumTop, podiumFrontSig, podiumTopSig } from "@/lib/screens";
import { candidateMood } from "@/lib/mood";
import { SEATS, type Seat } from "@/lib/layout";
import { serverNow } from "@/lib/net";
import { Character } from "./Character";
import { SCREEN_TINT, useCanvasTexture } from "./useCanvasTexture";

// pupitres noir laqué à liseré doré, façon grand plateau TV
const BODY_MAT = new THREE.MeshPhysicalMaterial({ color: "#080b18", roughness: 0.18, metalness: 0.35, clearcoat: 1, clearcoatRoughness: 0.1 });
const TRIM_MAT = new THREE.MeshStandardMaterial({ color: "#d9a93c", roughness: 0.22, metalness: 1, emissive: "#6b4608", emissiveIntensity: 0.5 });
const CASE_MAT = new THREE.MeshStandardMaterial({ color: "#10131f", roughness: 0.4, metalness: 0.6 });

interface Props {
  seat: number;
  /** Emplacement sur le plateau (par défaut : place fixe du siège). */
  place?: Seat;
  player: PublicPlayer | null;
  state: PublicRoomState | null;
  priv: PrivateState | null;
  color: string;
  isMe: boolean;
  selectable: boolean;
  onSelect?: (playerId: string) => void;
}

/** Un emplacement de candidat : pupitre 3D + écrans intégrés + personnage installé derrière. */
export function CandidateSeat({ seat, place, player, state, priv, color, isMe, selectable, onSelect }: Props) {
  const s = place ?? SEATS[seat];
  const frontTex = useCanvasTexture(
    1024,
    512,
    (now) => podiumFrontSig(player, state, now, color) + (isMe ? "m" : ""),
    (ctx, now) => drawPodiumFront(ctx, 1024, 512, player, state, now, color, isMe),
  );
  const topTex = useCanvasTexture(
    896,
    526,
    (now) => podiumTopSig(player, state, isMe ? priv : null, now),
    (ctx, now) => drawPodiumTop(ctx, 896, 526, player, state, isMe ? priv : null, now),
  );
  const ledMat = useMemo(() => new THREE.MeshBasicMaterial({ color, toneMapped: false }), [color]);
  const ring = useRef<THREE.Mesh>(null);
  const hover = useRef(false);

  useFrame((st) => {
    const t = st.clock.elapsedTime;
    let c = color;
    if (state?.phase === "reveal" && player?.lastResult && player.lastResult.questionIndex === state.reveal?.questionIndex) {
      c = player.lastResult.correct ? "#2ee59d" : "#ff3b5c";
    }
    const pulse = state?.phase === "question" && player && !player.answered && player.mode ? 0.6 + Math.sin(t * 8) * 0.4 : 1;
    ledMat.color.set(c).multiplyScalar(player ? (player.connected ? 1.6 * pulse : 0.3) : 0.15);
    if (ring.current) {
      ring.current.visible = selectable;
      const sc = 1 + Math.sin(t * 6) * 0.05 + (hover.current ? 0.12 : 0);
      ring.current.scale.set(sc, sc, sc);
    }
  });

  const now = serverNow();
  const { mood, look } = player && state ? candidateMood(player, state, now) : { mood: "idle" as const, look: null };

  return (
    <group position={s.position} rotation={[0, s.rotationY, 0]}>
      {/* socle lumineux au sol */}
      <mesh position={[0, 0.015, -0.1]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.25, 48]} />
        <meshStandardMaterial color="#0a0f2a" roughness={0.2} metalness={0.6} />
      </mesh>
      <mesh position={[0, 0.02, -0.1]} rotation={[-Math.PI / 2, 0, 0]} material={ledMat}>
        <ringGeometry args={[1.22, 1.3, 64]} />
      </mesh>
      {/* anneau de sélection (choix de la cible après la roue) */}
      <mesh ref={ring} position={[0, 0.05, -0.1]} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <torusGeometry args={[1.45, 0.06, 12, 64]} />
        <meshBasicMaterial color="#ff2e63" toneMapped={false} />
      </mesh>

      {/* personnage installé derrière son pupitre */}
      {player && (
        <group position={[0, 0, -0.62]}>
          <Character preset={getCharacter(player.character)} mood={mood} lookAt={look} seed={seat * 1.37} />
        </group>
      )}

      {/* pupitre */}
      <group position={[0, 0, 0.18]}>
        <RoundedBox args={[1.75, 1.12, 0.78]} radius={0.08} smoothness={3} position={[0, 0.58, 0]} material={BODY_MAT} />
        <RoundedBox args={[1.86, 0.08, 0.9]} radius={0.03} smoothness={2} position={[0, 1.16, 0]} material={TRIM_MAT} />
        <mesh position={[0, 0.05, 0.4]} material={ledMat}>
          <boxGeometry args={[1.7, 0.04, 0.02]} />
        </mesh>
        <mesh position={[0, 1.205, 0.45]} material={ledMat}>
          <boxGeometry args={[1.84, 0.025, 0.02]} />
        </mesh>
        {/* écran avant : PSEUDO + SCORE, intégré dans la façade */}
        <mesh position={[0, 0.62, 0.395]}>
          <planeGeometry args={[1.56, 0.78]} />
          <meshBasicMaterial map={frontTex} color={SCREEN_TINT} toneMapped={false} />
        </mesh>
        {/* écran incliné du candidat, orienté vers lui */}
        <group position={[0, 1.2, -0.05]} rotation={[0, Math.PI, 0]}>
          <group rotation={[-0.93, 0, 0]} position={[0, 0.2, 0]}>
            <mesh position={[0, 0, -0.035]} material={CASE_MAT}>
              <boxGeometry args={[1.0, 0.62, 0.06]} />
            </mesh>
            <mesh>
              <planeGeometry args={[0.92, 0.54]} />
              <meshBasicMaterial map={topTex} color={SCREEN_TINT} toneMapped={false} />
            </mesh>
          </group>
          <mesh position={[0, 0.08, 0.05]} material={CASE_MAT}>
            <boxGeometry args={[0.2, 0.16, 0.08]} />
          </mesh>
        </group>
      </group>

      {/* zone cliquable pour choisir la cible */}
      {selectable && player && (
        <mesh
          position={[0, 1.4, -0.2]}
          onClick={(e) => {
            e.stopPropagation();
            onSelect?.(player.id);
          }}
          onPointerOver={() => {
            hover.current = true;
            document.body.style.cursor = "pointer";
          }}
          onPointerOut={() => {
            hover.current = false;
            document.body.style.cursor = "";
          }}
        >
          <cylinderGeometry args={[1.2, 1.2, 2.9, 16]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}
