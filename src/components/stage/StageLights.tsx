"use client";

// Projecteurs asservis du plateau : faisceaux qui balaient la scène et taches de lumière au sol.
// Couleurs, vitesse et intensité suivent le déroulé du jeu (question, fin du chrono, révélation, roue, finale).
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { REVEAL_LOCK_MS } from "@shared/config";
import type { PublicRoomState } from "@shared/types";
import { serverNow } from "@/lib/net";

const BEAM_LEN = 15;

const beamVertex = /* glsl */ `
  varying float vAlong;
  varying float vFacing;
  void main() {
    vAlong = uv.y;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vec3 n = normalize(normalMatrix * normal);
    vFacing = abs(dot(n, normalize(-mv.xyz)));
    gl_Position = projectionMatrix * mv;
  }
`;
const beamFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uIntensity;
  varying float vAlong;
  varying float vFacing;
  void main() {
    float a = pow(vAlong, 1.7) * pow(vFacing, 1.3) * uIntensity;
    gl_FragColor = vec4(uColor * a, 1.0);
  }
`;

function spotTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.35, "rgba(255,255,255,0.55)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

interface Rig {
  x: number;
  y: number;
  z: number;
  /** décalage de phase du balayage */
  phase: number;
  /** projecteur de face (vise le fond du plateau) */
  front?: boolean;
}

// projecteurs de part et d'autre du grand écran (jamais devant lui) et deux en façade
const RIGS_HIGH: Rig[] = [
  { x: -15, y: 12.5, z: -6, phase: 0 },
  { x: -9.5, y: 13.5, z: -7.5, phase: 1.3 },
  { x: 9.5, y: 13.5, z: -7.5, phase: 4.2 },
  { x: 15, y: 12.5, z: -6, phase: 5.1 },
  { x: -10, y: 12, z: 9, phase: 0.7, front: true },
  { x: 10, y: 12, z: 9, phase: 2.9, front: true },
];
const RIGS_LOW = RIGS_HIGH;

interface Look {
  colors: [string, string];
  intensity: number;
  speed: number;
  /** amplitude du balayage (radians) */
  sweep: number;
  /** clignotement (0 = aucun) */
  strobe: number;
}

function lookFor(s: PublicRoomState | null, now: number): Look {
  const base: Look = { colors: ["#ffc94a", "#3a7bff"], intensity: 0.55, speed: 0.35, sweep: 0.42, strobe: 0 };
  if (!s) return base;
  const t = now - s.phaseStartedAt;
  switch (s.phase) {
    case "lobby":
    case "intro":
      return { ...base, speed: 0.5, intensity: 0.65 };
    case "round_intro":
      return { colors: ["#ffc94a", "#ffffff"], intensity: 0.9, speed: 1.1, sweep: 0.55, strobe: t < 1500 ? 6 : 0 };
    case "question": {
      const q = s.question;
      if (!q?.text) return { colors: ["#29e7ff", "#3a7bff"], intensity: 0.55, speed: 0.6, sweep: 0.4, strobe: 0 };
      const left = q.endsAt - now;
      if (left < 4000 && left > 0) return { colors: ["#ff2e4d", "#ff7a1c"], intensity: 0.75, speed: 0.9, sweep: 0.3, strobe: 2 };
      return { colors: ["#29e7ff", "#3a7bff"], intensity: 0.4, speed: 0.3, sweep: 0.3, strobe: 0 };
    }
    case "reveal":
      if (t < REVEAL_LOCK_MS) return { colors: ["#ff2e4d", "#a66cff"], intensity: 0.6, speed: 0.2, sweep: 0.12, strobe: 0 };
      return { colors: ["#2ee59d", "#ffc94a"], intensity: t < REVEAL_LOCK_MS + 1200 ? 1.1 : 0.7, speed: 0.8, sweep: 0.5, strobe: t < REVEAL_LOCK_MS + 900 ? 8 : 0 };
    case "leaderboard":
      return { colors: ["#ffc94a", "#a66cff"], intensity: 0.7, speed: 0.55, sweep: 0.5, strobe: 0 };
    case "wheel":
      if (s.wheel?.stage === "spinning") return { colors: ["#ff66c4", "#a66cff"], intensity: 0.9, speed: 2.2, sweep: 0.6, strobe: 0 };
      if (s.wheel?.stage === "result") return { colors: ["#ffc94a", "#ff66c4"], intensity: 1, speed: 1, sweep: 0.5, strobe: t < 1200 ? 6 : 0 };
      return { colors: ["#a66cff", "#ff66c4"], intensity: 0.7, speed: 0.6, sweep: 0.5, strobe: 0 };
    case "final":
      return { colors: ["#ffc94a", "#ffffff"], intensity: 1, speed: 1.3, sweep: 0.65, strobe: t > 2800 && t < 4200 ? 7 : 0 };
  }
  return base;
}

export function StageLights({ state, quality }: { state: PublicRoomState | null; quality: "high" | "low" }) {
  const rigs = quality === "high" ? RIGS_HIGH : RIGS_LOW;
  const geo = useMemo(() => {
    const g = new THREE.ConeGeometry(2.3, BEAM_LEN, 28, 1, true);
    // sommet du cône au niveau du projecteur, faisceau vers le bas
    g.translate(0, -BEAM_LEN / 2, 0);
    return g;
  }, []);
  const mats = useMemo(
    () =>
      rigs.map(
        () =>
          new THREE.ShaderMaterial({
            vertexShader: beamVertex,
            fragmentShader: beamFragment,
            uniforms: { uColor: { value: new THREE.Color() }, uIntensity: { value: 0 } },
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide,
            toneMapped: false,
          }),
      ),
    [rigs],
  );
  const spotTex = useMemo(() => spotTexture(), []);
  const spotMats = useMemo(
    () => rigs.map(() => new THREE.MeshBasicMaterial({ map: spotTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })),
    [rigs, spotTex],
  );
  const beams = useRef<(THREE.Group | null)[]>([]);
  const spots = useRef<(THREE.Mesh | null)[]>([]);
  const colA = useMemo(() => new THREE.Color(), []);
  const colB = useMemo(() => new THREE.Color(), []);
  const clock = useRef(0);
  const cur = useRef({ intensity: 0.5, speed: 0.35, sweep: 0.42 });
  const stateRef = useRef(state);
  stateRef.current = state;
  const dirV = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, dt) => {
    const look = lookFor(stateRef.current, serverNow());
    const k = 1 - Math.exp(-dt * 3);
    cur.current.intensity += (look.intensity - cur.current.intensity) * k;
    cur.current.speed += (look.speed - cur.current.speed) * k;
    cur.current.sweep += (look.sweep - cur.current.sweep) * k;
    clock.current += dt * cur.current.speed;
    const tt = clock.current;
    const flash = look.strobe ? (Math.sin(performance.now() * 0.001 * look.strobe * Math.PI * 2) > 0 ? 1.35 : 0.45) : 1;
    colA.set(look.colors[0]);
    colB.set(look.colors[1]);
    rigs.forEach((r, i) => {
      const g = beams.current[i];
      const spot = spots.current[i];
      if (!g || !spot) return;
      // balayage : panoramique et inclinaison en figures de Lissajous, orientés vers le cœur du plateau
      const aimX = -r.x * 0.04 + Math.sin(tt * 1.3 + r.phase) * cur.current.sweep;
      const aimZ = (r.front ? 0.5 : -0.42) + Math.sin(tt * 0.9 + r.phase * 1.7) * cur.current.sweep * 0.6;
      g.rotation.set(aimZ, 0, aimX);
      const m = mats[i];
      (m.uniforms.uColor.value as THREE.Color).copy(i % 2 ? colB : colA);
      m.uniforms.uIntensity.value = cur.current.intensity * flash * (r.front ? 0.55 : 0.8);
      // tache au sol là où le faisceau touche
      dirV.set(0, -1, 0).applyEuler(g.rotation);
      if (dirV.y < -0.2) {
        const d = r.y / -dirV.y;
        spot.position.set(r.x + dirV.x * d, 0.04, r.z + dirV.z * d);
        const size = 2.3 * (d / BEAM_LEN) * 2.2;
        spot.scale.set(size, size / Math.max(0.35, -dirV.y), 1);
        spot.rotation.set(-Math.PI / 2, 0, Math.atan2(dirV.x, dirV.z));
        spot.visible = true;
        spotMats[i].color.copy(i % 2 ? colB : colA).multiplyScalar(Math.min(1.2, cur.current.intensity * flash));
      } else spot.visible = false;
    });
  });

  return (
    <group>
      {rigs.map((r, i) => (
        <group key={i}>
          <group position={[r.x, r.y, r.z]} ref={(el) => void (beams.current[i] = el)}>
            <mesh geometry={geo} material={mats[i]} renderOrder={5} frustumCulled={false} />
            {/* lentille du projecteur */}
            <mesh position={[0, 0.05, 0]}>
              <sphereGeometry args={[0.28, 16, 12]} />
              <meshBasicMaterial color="#fff6dc" toneMapped={false} />
            </mesh>
          </group>
          <mesh ref={(el) => void (spots.current[i] = el)} material={spotMats[i]} renderOrder={4}>
            <planeGeometry args={[1, 1]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
