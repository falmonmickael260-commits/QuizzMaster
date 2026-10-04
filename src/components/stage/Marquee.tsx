"use client";

// Ampoules « music-hall » qui courent autour du grand écran et de la scène centrale.
// Leur couleur et leur vitesse suivent l'ambiance lumineuse du jeu (comme les projecteurs).
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { PublicRoomState } from "@shared/types";
import { starFocus } from "@/lib/focus";
import { SCREEN_POS, SCREEN_SIZE } from "@/lib/layout";
import { serverNow } from "@/lib/net";
import { lookFor } from "./StageLights";
import { TV_STAGE_CENTER } from "./TvSet";

function screenFramePoints(): THREE.Vector3[] {
  const w = SCREEN_SIZE.w + 1.15;
  const h = SCREEN_SIZE.h + 1.15;
  const per = 2 * (w + h);
  const n = 72;
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i < n; i++) {
    let d = (i / n) * per;
    let x: number, y: number;
    if (d < w) [x, y] = [-w / 2 + d, h / 2];
    else if ((d -= w) < h) [x, y] = [w / 2, h / 2 - d];
    else if ((d -= h) < w) [x, y] = [w / 2 - d, -h / 2];
    else [x, y] = [-w / 2, -h / 2 + (d - w)];
    pts.push(new THREE.Vector3(SCREEN_POS.x + x, SCREEN_POS.y + y, SCREEN_POS.z + 0.08));
  }
  return pts;
}

function stageRingPoints(): THREE.Vector3[] {
  const n = 64;
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return new THREE.Vector3(TV_STAGE_CENTER.x + Math.sin(a) * 4.65, 0.05, TV_STAGE_CENTER.z + Math.cos(a) * 4.65);
  });
}

export function Marquee({ state }: { state: PublicRoomState | null }) {
  const pts = useMemo(() => [...screenFramePoints(), ...stageRingPoints()], []);
  const mesh = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => new THREE.SphereGeometry(0.075, 12, 8), []);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ toneMapped: false }), []);
  const stateRef = useRef(state);
  stateRef.current = state;
  const phase = useRef(0);
  const ca = useMemo(() => new THREE.Color(), []);
  const cb = useMemo(() => new THREE.Color(), []);
  const c = useMemo(() => new THREE.Color(), []);

  useEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const d = new THREE.Object3D();
    pts.forEach((p, i) => {
      d.position.copy(p);
      d.updateMatrix();
      m.setMatrixAt(i, d.matrix);
      m.setColorAt(i, new THREE.Color("#ffc94a"));
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [pts]);

  useFrame((_, dt) => {
    const m = mesh.current;
    if (!m) return;
    const now = serverNow();
    const star = starFocus(stateRef.current, now);
    const look = star ? { colors: ["#ffd76a", "#ffffff"], speed: 2.2, strobe: 0 } : lookFor(stateRef.current, now);
    phase.current += dt * (6 + look.speed * 10);
    ca.set(look.colors[0]);
    cb.set(look.colors[1]);
    const blink = look.strobe ? (Math.sin(performance.now() * 0.001 * look.strobe * Math.PI * 2) > 0 ? 1 : 0.35) : 1;
    for (let i = 0; i < pts.length; i++) {
      // vague lumineuse qui court le long de la guirlande ; une ampoule sur trois en couleur secondaire
      const wave = 0.5 + 0.5 * Math.sin(i * 0.55 - phase.current);
      const k = (0.35 + 1.35 * wave * wave) * blink;
      c.copy(i % 3 === 0 ? cb : ca).multiplyScalar(k);
      m.setColorAt(i, c);
    }
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });

  return <instancedMesh ref={mesh} args={[geo, mat, pts.length]} frustumCulled={false} />;
}
