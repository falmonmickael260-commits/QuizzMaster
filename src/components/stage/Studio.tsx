"use client";

import { MeshReflectorMaterial, RoundedBox, Sparkles } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { Phase } from "@shared/types";
import { drawFloor } from "@/lib/screens";
import { HOST_POS, SCREEN_POS, SCREEN_SIZE, STAGE_CENTER } from "@/lib/layout";

const CZ = STAGE_CENTER.z;

/** Palette d'ambiance lumineuse par phase de jeu. */
export const PHASE_LIGHTS: Record<Phase | "none", { a: string; b: string; energy: number }> = {
  none: { a: "#29e7ff", b: "#ff2e63", energy: 0.8 },
  lobby: { a: "#29e7ff", b: "#ff2e63", energy: 0.9 },
  intro: { a: "#ffb800", b: "#ff2e63", energy: 1.3 },
  round_intro: { a: "#ff2e63", b: "#29e7ff", energy: 1.2 },
  question: { a: "#1f6bff", b: "#29e7ff", energy: 0.85 },
  reveal: { a: "#2ee59d", b: "#29e7ff", energy: 1.1 },
  leaderboard: { a: "#ffb800", b: "#a66cff", energy: 1.1 },
  wheel: { a: "#ff2e63", b: "#a66cff", energy: 1.3 },
  final: { a: "#ffb800", b: "#ff2e63", energy: 1.5 },
};

export function Studio({ phase, quality }: { phase: Phase | "none"; quality: "high" | "low" }) {
  const floorTex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 2048;
    drawFloor(c.getContext("2d")!, 2048);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  }, []);

  const ledA = useMemo(() => new THREE.MeshBasicMaterial({ color: "#29e7ff", toneMapped: false }), []);
  const ledB = useMemo(() => new THREE.MeshBasicMaterial({ color: "#ff2e63", toneMapped: false }), []);
  const lightA = useRef<THREE.PointLight>(null);
  const lightB = useRef<THREE.PointLight>(null);
  const colA = useRef(new THREE.Color("#29e7ff"));
  const colB = useRef(new THREE.Color("#ff2e63"));
  const ringRefs = useRef<THREE.Mesh[]>([]);

  useFrame((st, dt) => {
    const t = st.clock.elapsedTime;
    const target = PHASE_LIGHTS[phase] ?? PHASE_LIGHTS.none;
    const k = 1 - Math.exp(-dt * 2.5);
    colA.current.lerp(new THREE.Color(target.a), k);
    colB.current.lerp(new THREE.Color(target.b), k);
    const pulse = 0.85 + Math.sin(t * 2) * 0.15;
    ledA.color.copy(colA.current).multiplyScalar(1.4 * pulse * target.energy);
    ledB.color.copy(colB.current).multiplyScalar(1.4 * (1.7 - pulse) * target.energy);
    if (lightA.current) {
      lightA.current.color.copy(colA.current);
      lightA.current.intensity = 60 * target.energy;
    }
    if (lightB.current) {
      lightB.current.color.copy(colB.current);
      lightB.current.intensity = 60 * target.energy;
    }
    ringRefs.current.forEach((m, i) => {
      if (m) m.rotation.z = t * (i % 2 ? -0.15 : 0.1);
    });
  });

  return (
    <group>
      {/* sol principal réfléchissant */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <circleGeometry args={[30, 96]} />
        {quality === "high" ? (
          <MeshReflectorMaterial resolution={1024} blur={[400, 100]} mixBlur={1} mixStrength={3} roughness={0.75} depthScale={0.8} minDepthThreshold={0.4} maxDepthThreshold={1.4} color="#070a1c" metalness={0.6} mirror={0.6} />
        ) : (
          <meshStandardMaterial color="#070a1c" roughness={0.35} metalness={0.7} />
        )}
      </mesh>
      {/* disque central au logo BLIND QUIZZ */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 3.6]}>
        <circleGeometry args={[4.6, 96]} />
        <meshStandardMaterial map={floorTex} transparent opacity={0.92} roughness={0.25} metalness={0.3} emissive="#ffffff" emissiveMap={floorTex} emissiveIntensity={0.35} />
      </mesh>
      {/* anneaux LED au sol */}
      {[4.7, 10.2, 11.6].map((r, i) => (
        <mesh key={r} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012 + i * 0.001, i === 0 ? 3.6 : CZ]} material={i === 1 ? ledB : ledA}>
          <ringGeometry args={[r, r + (i === 0 ? 0.06 : 0.1), 128]} />
        </mesh>
      ))}
      {/* estrade de l'animateur */}
      <group position={[HOST_POS.x, 0, HOST_POS.z]}>
        <mesh position={[0, 0.12, 0]}>
          <cylinderGeometry args={[1.75, 1.9, 0.24, 64]} />
          <meshStandardMaterial color="#0d1438" roughness={0.3} metalness={0.6} />
        </mesh>
        <mesh position={[0, 0.245, 0]} rotation={[-Math.PI / 2, 0, 0]} material={ledA}>
          <ringGeometry args={[1.62, 1.75, 64]} />
        </mesh>
      </group>

      {/* mur de fond et grand écran */}
      <BackWall ledA={ledA} ledB={ledB} />

      {/* ossature lumineuse suspendue */}
      <group position={[0, 10.5, CZ]}>
        {[11, 7.5].map((r, i) => (
          <mesh
            key={r}
            ref={(m) => {
              if (m) ringRefs.current[i] = m;
            }}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <torusGeometry args={[r, 0.12, 8, 96]} />
            <meshStandardMaterial color="#1a1f3a" metalness={0.9} roughness={0.3} />
          </mesh>
        ))}
        <mesh rotation={[-Math.PI / 2, 0, 0]} material={ledB}>
          <torusGeometry args={[11, 0.04, 6, 128]} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} material={ledA}>
          <torusGeometry args={[7.5, 0.04, 6, 128]} />
        </mesh>
      </group>
      <Beams phase={phase} />

      {/* éclairage */}
      <ambientLight intensity={0.35} color="#8090ff" />
      <hemisphereLight args={["#5a6bff", "#12001a", 0.5]} />
      <directionalLight position={[2, 12, 14]} intensity={1.6} color="#fff4e8" />
      <directionalLight position={[-8, 6, 6]} intensity={0.5} color="#9fb4ff" />
      <pointLight ref={lightA} position={[-9, 6, 2]} intensity={60} distance={30} decay={1.6} color="#29e7ff" />
      <pointLight ref={lightB} position={[9, 6, 2]} intensity={60} distance={30} decay={1.6} color="#ff2e63" />
      <spotLight position={[0, 11, 4]} angle={0.5} penumbra={0.7} intensity={140} distance={30} decay={1.5} color="#ffffff" />
      <pointLight position={[0, 3, 4]} intensity={18} distance={14} decay={1.5} color="#ffe8d0" />

      {/* poussières lumineuses dans les faisceaux */}
      <Sparkles count={quality === "high" ? 90 : 40} scale={[22, 9, 16]} position={[0, 5, -1]} size={3} speed={0.25} opacity={0.5} color="#bfe9ff" />
    </group>
  );
}

function BackWall({ ledA, ledB }: { ledA: THREE.Material; ledB: THREE.Material }) {
  const wallMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#060818", roughness: 0.6, metalness: 0.4, side: THREE.BackSide }), []);
  const stripes = useMemo(() => {
    const out: { x: number; z: number; ry: number; h: number; mat: THREE.Material }[] = [];
    for (let i = 0; i < 26; i++) {
      const a = -Math.PI * 0.85 + (i / 25) * Math.PI * 0.7;
      const r = 21;
      // on laisse libre la zone du grand écran
      if (Math.abs(Math.sin(a) * r) < 8.5 && Math.cos(a) < 0) continue;
      out.push({ x: Math.sin(a) * r, z: CZ + Math.cos(a) * r, ry: a + Math.PI, h: 6 + (i % 3) * 2, mat: i % 2 ? ledA : ledB });
    }
    return out;
  }, [ledA, ledB]);
  return (
    <group>
      {/* studio cylindrique */}
      <mesh position={[0, 8, CZ]} material={wallMat}>
        <cylinderGeometry args={[22, 22, 16, 64, 1, true]} />
      </mesh>
      {stripes.map((s, i) => (
        <mesh key={i} position={[s.x, s.h / 2 + 0.5, s.z]} rotation={[0, s.ry, 0]} material={s.mat}>
          <boxGeometry args={[0.12, s.h, 0.05]} />
        </mesh>
      ))}
      {/* structure du grand écran */}
      <group position={[SCREEN_POS.x, SCREEN_POS.y, SCREEN_POS.z - 0.25]}>
        <RoundedBox args={[SCREEN_SIZE.w + 0.9, SCREEN_SIZE.h + 0.9, 0.4]} radius={0.2} smoothness={3}>
          <meshStandardMaterial color="#0b0f26" metalness={0.8} roughness={0.25} />
        </RoundedBox>
        <mesh position={[0, 0, 0.21]} material={ledA}>
          <boxGeometry args={[SCREEN_SIZE.w + 0.55, SCREEN_SIZE.h + 0.55, 0.01]} />
        </mesh>
        <mesh position={[0, 0, 0.215]}>
          <boxGeometry args={[SCREEN_SIZE.w + 0.3, SCREEN_SIZE.h + 0.3, 0.01]} />
          <meshBasicMaterial color="#02030a" />
        </mesh>
        {/* piliers latéraux */}
        {[-1, 1].map((sx) => (
          <group key={sx} position={[sx * (SCREEN_SIZE.w / 2 + 1.3), -SCREEN_SIZE.h / 2 + 2.2, 0.4]}>
            <RoundedBox args={[0.9, 9.5, 0.9]} radius={0.12} smoothness={2} position={[0, 0.2, 0]}>
              <meshStandardMaterial color="#0d1234" metalness={0.8} roughness={0.3} />
            </RoundedBox>
            {[0.47, -0.47].map((ox) => (
              <mesh key={ox} position={[ox, 0.2, 0]} material={sx < 0 ? ledB : ledA}>
                <boxGeometry args={[0.04, 9.2, 0.6]} />
              </mesh>
            ))}
          </group>
        ))}
      </group>
      {/* marches menant au fond du plateau */}
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[0, 0.1 + i * 0.2, -6.4 - i * 0.55]}>
          <boxGeometry args={[9 - i * 0.6, 0.2 + i * 0.4, 0.6]} />
          <meshStandardMaterial color="#0b1030" metalness={0.5} roughness={0.35} />
        </mesh>
      ))}
      {[0, 1, 2].map((i) => (
        <mesh key={`l${i}`} position={[0, 0.205 + i * 0.4, -6.1 - i * 0.55]} material={i % 2 ? ledA : ledB}>
          <boxGeometry args={[9 - i * 0.6, 0.02, 0.02]} />
        </mesh>
      ))}
    </group>
  );
}

/** Faisceaux de projecteurs en mouvement (effet volumétrique léger). */
function Beams({ phase }: { phase: Phase | "none" }) {
  const group = useRef<THREE.Group>(null);
  const beams = useMemo(
    () =>
      Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2;
        return { x: Math.cos(a) * 9.5, z: CZ + Math.sin(a) * 9.5, phase: i * 0.8, color: i % 2 ? "#29e7ff" : "#ff2e63" };
      }),
    [],
  );
  const mats = useMemo(
    () =>
      beams.map(
        (b) =>
          new THREE.MeshBasicMaterial({
            color: b.color,
            transparent: true,
            opacity: 0.07,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide,
            toneMapped: false,
          }),
      ),
    [beams],
  );
  const geo = useMemo(() => {
    const g = new THREE.ConeGeometry(1.1, 11, 24, 1, true);
    g.translate(0, -5.5, 0);
    return g;
  }, []);
  useFrame((st) => {
    const t = st.clock.elapsedTime;
    const speed = phase === "wheel" || phase === "final" || phase === "intro" ? 2.2 : phase === "question" ? 0.4 : 0.8;
    group.current?.children.forEach((c, i) => {
      const b = beams[i];
      c.rotation.x = Math.sin(t * 0.5 * speed + b.phase) * 0.45;
      c.rotation.z = Math.cos(t * 0.4 * speed + b.phase) * 0.45;
      mats[i].opacity = (phase === "question" ? 0.022 : 0.04) * (0.7 + Math.sin(t * 1.3 + b.phase) * 0.3);
    });
  });
  return (
    <group ref={group}>
      {beams.map((b, i) => (
        <mesh key={i} position={[b.x, 10.4, b.z]} geometry={geo} material={mats[i]} />
      ))}
    </group>
  );
}
