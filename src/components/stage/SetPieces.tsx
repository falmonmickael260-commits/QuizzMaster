"use client";

import { RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { PublicRoomState } from "@shared/types";
import { CHARACTERS } from "@shared/characters";
import { WHEEL_SEGMENTS } from "@shared/wheel";
import { bigScreenSig, drawBigScreen, drawLivePanel, drawWheelFace, livePanelSig } from "@/lib/screens";
import { HOST_POS, PANEL_POS, SCREEN_POS, SCREEN_SIZE, STAGE_CENTER, WHEEL_CENTER_Y, WHEEL_POS, WHEEL_RADIUS } from "@/lib/layout";
import { serverNow } from "@/lib/net";
import { audio } from "@/lib/audio";
import { hostMood } from "@/lib/mood";
import { Character } from "./Character";
import { SCREEN_TINT, useCanvasTexture } from "./useCanvasTexture";

// ─── Grand écran ─────────────────────────────────────────────────────────────

export function BigScreen({ state }: { state: PublicRoomState | null }) {
  const W = 1920;
  const H = Math.round((W * SCREEN_SIZE.h) / SCREEN_SIZE.w);
  const stateRef = useRef(state);
  stateRef.current = state;
  const tex = useCanvasTexture(
    W,
    H,
    (now) => bigScreenSig(stateRef.current, now),
    (ctx, now) => drawBigScreen(ctx, W, H, stateRef.current, now),
  );
  return (
    <mesh position={[SCREEN_POS.x, SCREEN_POS.y, SCREEN_POS.z]}>
      <planeGeometry args={[SCREEN_SIZE.w, SCREEN_SIZE.h]} />
      <meshBasicMaterial map={tex} color={SCREEN_TINT} toneMapped={false} />
    </mesh>
  );
}

// ─── Panneau LED du classement en direct ─────────────────────────────────────

export function LivePanel({ state, colors }: { state: PublicRoomState | null; colors: Record<string, string> }) {
  const stateRef = useRef(state);
  stateRef.current = state;
  const tex = useCanvasTexture(
    640,
    760,
    (now) => livePanelSig(stateRef.current, now),
    (ctx, now) => drawLivePanel(ctx, 640, 760, stateRef.current, now, colors),
  );
  const rotY = useMemo(() => Math.atan2(-2 - PANEL_POS.x, 14 - PANEL_POS.z), []);
  return (
    <group position={PANEL_POS} rotation={[0, rotY, 0]}>
      <RoundedBox args={[4.1, 4.8, 0.3]} radius={0.12} smoothness={2} position={[0, 0, -0.17]}>
        <meshStandardMaterial color="#0b0f26" metalness={0.8} roughness={0.3} />
      </RoundedBox>
      <mesh>
        <planeGeometry args={[3.8, 4.5]} />
        <meshBasicMaterial map={tex} color={SCREEN_TINT} toneMapped={false} />
      </mesh>
      <mesh position={[0, -4.3, -0.2]}>
        <cylinderGeometry args={[0.12, 0.2, 4, 12]} />
        <meshStandardMaterial color="#12163a" metalness={0.8} roughness={0.3} />
      </mesh>
    </group>
  );
}

// ─── Roue bonus / malus ──────────────────────────────────────────────────────

const easeOut = (x: number) => 1 - Math.pow(1 - x, 4);

export function Wheel({ state, position, rotationY }: { state: PublicRoomState | null; position?: THREE.Vector3; rotationY?: number }) {
  const disc = useRef<THREE.Group>(null);
  const bulbs = useRef<THREE.InstancedMesh>(null);
  const lastSeg = useRef(0);
  const stateRef = useRef(state);
  stateRef.current = state;
  const faceTex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 1024;
    const draw = () => {
      drawWheelFace(c.getContext("2d")!, 1024);
      tex.needsUpdate = true;
    };
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    draw();
    if (typeof document !== "undefined" && document.fonts) void document.fonts.ready.then(draw);
    return tex;
  }, []);
  const rotY = useMemo(() => rotationY ?? Math.atan2(2 - WHEEL_POS.x, 12 - WHEEL_POS.z), [rotationY]);
  const at = position ?? WHEEL_POS;
  const bulbCount = 40;
  const bulbColor = useMemo(() => new THREE.Color(), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => {
    if (!bulbs.current) return;
    for (let i = 0; i < bulbCount; i++) {
      const a = (i / bulbCount) * Math.PI * 2;
      dummy.position.set(Math.cos(a) * (WHEEL_RADIUS + 0.2), Math.sin(a) * (WHEEL_RADIUS + 0.2), 0.12);
      dummy.updateMatrix();
      bulbs.current.setMatrixAt(i, dummy.matrix);
    }
    bulbs.current.instanceMatrix.needsUpdate = true;
  }, [dummy]);

  useFrame((st) => {
    const s = stateRef.current;
    const w = s?.phase === "wheel" ? s.wheel : null;
    const now = serverNow();
    const seg = (Math.PI * 2) / WHEEL_SEGMENTS.length;
    let angle = Math.sin(st.clock.elapsedTime * 0.3) * 0.05;
    let spinning = false;
    if (w && w.resultIndex !== null && w.spinStartedAt) {
      const p = Math.min(1, Math.max(0, (now - w.spinStartedAt) / w.spinDurationMs));
      const final = (w.resultIndex + 0.5) * seg - Math.PI * 2 * w.spinTurns;
      angle = final * easeOut(p);
      spinning = p > 0 && p < 1;
      const idx = Math.floor(-angle / seg);
      if (spinning && idx !== lastSeg.current) audio.wheelClick();
      lastSeg.current = idx;
    } else if (w && w.stage === "waiting_spin") {
      angle = Math.sin(st.clock.elapsedTime * 3) * 0.06;
    }
    if (disc.current) disc.current.rotation.z = angle;
    if (bulbs.current) {
      const t = st.clock.elapsedTime;
      for (let i = 0; i < bulbCount; i++) {
        const on = spinning ? Math.floor(t * 20 + i) % 4 === 0 : w ? Math.floor(t * 6 + i) % 2 === 0 : Math.floor(t * 2 + i / 5) % 2 === 0;
        bulbColor.set(on ? (w ? "#ffd84a" : "#fff2c0") : "#3a2a10").multiplyScalar(on ? 2.2 : 1);
        bulbs.current.setColorAt(i, bulbColor);
      }
      if (bulbs.current.instanceColor) bulbs.current.instanceColor.needsUpdate = true;
    }
  });

  return (
    <group position={[at.x, at.y, at.z]} rotation={[0, rotY, 0]}>
      {/* socle */}
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[1.5, 1.8, 0.4, 48]} />
        <meshStandardMaterial color="#0c1236" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.41, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.35, 1.5, 48]} />
        <meshBasicMaterial color="#ff2e63" toneMapped={false} />
      </mesh>
      {[-0.5, 0.5].map((x) => (
        <mesh key={x} position={[x, 1.2, -0.25]} rotation={[0, 0, x > 0 ? -0.12 : 0.12]}>
          <boxGeometry args={[0.18, 2.2, 0.18]} />
          <meshStandardMaterial color="#1b2566" metalness={0.8} roughness={0.3} />
        </mesh>
      ))}
      <group position={[0, WHEEL_CENTER_Y, 0]}>
        {/* dos et anneau de la roue */}
        <mesh position={[0, 0, -0.12]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[WHEEL_RADIUS + 0.35, WHEEL_RADIUS + 0.35, 0.22, 64]} />
          <meshStandardMaterial color="#141a45" metalness={0.8} roughness={0.25} />
        </mesh>
        <mesh position={[0, 0, 0.02]}>
          <torusGeometry args={[WHEEL_RADIUS + 0.2, 0.09, 12, 96]} />
          <meshStandardMaterial color="#d9b24a" metalness={0.9} roughness={0.2} />
        </mesh>
        <instancedMesh ref={bulbs} args={[undefined, undefined, bulbCount]}>
          <sphereGeometry args={[0.07, 10, 8]} />
          <meshBasicMaterial toneMapped={false} />
        </instancedMesh>
        {/* disque tournant */}
        <group ref={disc}>
          <mesh position={[0, 0, 0.03]}>
            <circleGeometry args={[WHEEL_RADIUS, 96]} />
            <meshStandardMaterial map={faceTex} emissive="#ffffff" emissiveMap={faceTex} emissiveIntensity={0.55} roughness={0.35} metalness={0.1} />
          </mesh>
          {WHEEL_SEGMENTS.map((_, i) => {
            const a = (i / WHEEL_SEGMENTS.length) * Math.PI * 2 + Math.PI / 2;
            return (
              <mesh key={i} position={[Math.cos(a) * (WHEEL_RADIUS - 0.06), Math.sin(a) * (WHEEL_RADIUS - 0.06), 0.08]}>
                <cylinderGeometry args={[0.045, 0.045, 0.1, 8]} />
                <meshStandardMaterial color="#f5e3a0" metalness={0.9} roughness={0.2} />
              </mesh>
            );
          })}
          <mesh position={[0, 0, 0.1]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.32, 0.32, 0.1, 32]} />
            <meshStandardMaterial color="#e8ecff" metalness={0.8} roughness={0.2} />
          </mesh>
        </group>
        {/* pointeur */}
        <group position={[0, WHEEL_RADIUS + 0.28, 0.2]}>
          <mesh rotation={[0, 0, Math.PI]}>
            <coneGeometry args={[0.22, 0.5, 3]} />
            <meshStandardMaterial color="#ff2e63" emissive="#ff2e63" emissiveIntensity={0.8} metalness={0.3} roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.25, 0]}>
            <sphereGeometry args={[0.14, 16, 12]} />
            <meshBasicMaterial color="#ffffff" toneMapped={false} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

// ─── Animateur ───────────────────────────────────────────────────────────────

export const HOST_PRESET = { ...CHARACTERS[0], id: "host", name: "Animateur", skin: "#e8b995", hair: "#2b1d14", eyes: "#3a2a1a", hairStyle: "short" as const, accessory: "none" as const };

export function Host({ state }: { state: PublicRoomState | null }) {
  const { mood, look } = hostMood(state, serverNow());
  return (
    <group position={[HOST_POS.x, 0.24, HOST_POS.z]} rotation={[0, 0, 0]}>
      <group position={[0, 0, -0.4]}>
        <Character preset={HOST_PRESET} mood={mood} lookAt={look} suit holdCard seed={9.1} />
      </group>
      {/* pupitre de l'animateur */}
      <group position={[0, 0, 0.35]}>
        <mesh position={[0, 0.55, 0]}>
          <cylinderGeometry args={[0.55, 0.7, 1.1, 32, 1, false, -Math.PI * 0.75, Math.PI * 1.5]} />
          <meshStandardMaterial color="#0c1236" metalness={0.6} roughness={0.3} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, 1.12, 0]}>
          <cylinderGeometry args={[0.72, 0.72, 0.06, 32]} />
          <meshStandardMaterial color="#1b2566" metalness={0.8} roughness={0.25} />
        </mesh>
        <mesh position={[0, 1.16, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.66, 0.72, 48]} />
          <meshBasicMaterial color="#ffb800" toneMapped={false} />
        </mesh>
        <mesh position={[0, 0.6, 0.02]}>
          <torusGeometry args={[0.6, 0.02, 8, 48, Math.PI]} />
          <meshBasicMaterial color="#29e7ff" toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}

// ─── Public ──────────────────────────────────────────────────────────────────

export function Audience({ excitement, count = 1 }: { excitement: number; count?: number }) {
  const bodies = useRef<THREE.InstancedMesh>(null);
  const heads = useRef<THREE.InstancedMesh>(null);
  const lights = useRef<THREE.InstancedMesh>(null);
  const seats = useMemo(() => {
    const list: { x: number; y: number; z: number; ry: number; phase: number; tint: number; phone: boolean }[] = [];
    const rows = [
      { r: 14.2, y: 0.45 },
      { r: 15.6, y: 1.15 },
      { r: 17.0, y: 1.85 },
      { r: 18.4, y: 2.55 },
    ];
    for (const side of [-1, 1]) {
      rows.forEach((row, ri) => {
        for (let deg = 52; deg <= 132; deg += 3.3 * count) {
          const a = THREE.MathUtils.degToRad(deg) * side;
          const x = Math.sin(a) * row.r;
          const z = STAGE_CENTER.z + Math.cos(a) * row.r;
          list.push({ x, y: row.y, z, ry: Math.atan2(-x, STAGE_CENTER.z - z), phase: Math.random() * 10, tint: 0.5 + Math.random() * 0.5, phone: Math.random() < 0.06 + ri * 0.01 });
        }
      });
    }
    return list;
  }, [count]);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const col = useMemo(() => new THREE.Color(), []);
  const phones = seats.filter((s) => s.phone);

  useEffect(() => {
    seats.forEach((s, i) => {
      col.setHSL(0.62 + (s.tint - 0.75) * 0.3, 0.3, 0.12 + s.tint * 0.08);
      bodies.current?.setColorAt(i, col);
      heads.current?.setColorAt(i, col.multiplyScalar(1.2));
    });
    if (bodies.current?.instanceColor) bodies.current.instanceColor.needsUpdate = true;
    if (heads.current?.instanceColor) heads.current.instanceColor.needsUpdate = true;
  }, [seats, col]);

  useFrame((st) => {
    const t = st.clock.elapsedTime;
    seats.forEach((s, i) => {
      const hop = excitement > 0.5 ? Math.max(0, Math.sin(t * 9 + s.phase)) * 0.12 * excitement : Math.sin(t * 1.3 + s.phase) * 0.02;
      dummy.position.set(s.x, s.y + 0.55 + hop, s.z);
      dummy.rotation.set(0, s.ry, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      bodies.current?.setMatrixAt(i, dummy.matrix);
      dummy.position.y += 0.55;
      dummy.updateMatrix();
      heads.current?.setMatrixAt(i, dummy.matrix);
    });
    phones.forEach((s, i) => {
      dummy.position.set(s.x, s.y + 1.35 + Math.sin(t * 2 + s.phase) * 0.1, s.z);
      dummy.updateMatrix();
      lights.current?.setMatrixAt(i, dummy.matrix);
    });
    if (bodies.current) bodies.current.instanceMatrix.needsUpdate = true;
    if (heads.current) heads.current.instanceMatrix.needsUpdate = true;
    if (lights.current) lights.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh ref={bodies} args={[undefined, undefined, seats.length]}>
        <capsuleGeometry args={[0.28, 0.5, 4, 8]} />
        <meshStandardMaterial roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={heads} args={[undefined, undefined, seats.length]}>
        <sphereGeometry args={[0.22, 10, 8]} />
        <meshStandardMaterial roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={lights} args={[undefined, undefined, phones.length]}>
        <sphereGeometry args={[0.05, 6, 6]} />
        <meshBasicMaterial color="#e8f4ff" toneMapped={false} />
      </instancedMesh>
      {/* gradins */}
      {[-1, 1].map((side) =>
        [14.2, 15.6, 17.0, 18.4].map((r, ri) => (
          <mesh key={`${side}-${r}`} position={[0, 0.2 + ri * 0.35, STAGE_CENTER.z]} rotation={[0, side > 0 ? 0 : Math.PI, 0]}>
            <cylinderGeometry args={[r + 0.6, r + 0.6, 0.4 + ri * 0.7, 48, 1, true, THREE.MathUtils.degToRad(50), THREE.MathUtils.degToRad(84)]} />
            <meshStandardMaterial color="#080a1a" roughness={0.8} side={THREE.DoubleSide} />
          </mesh>
        )),
      )}
    </group>
  );
}

// ─── Confettis ───────────────────────────────────────────────────────────────

export function Confetti({ active, origin = new THREE.Vector3(0, 9, -1), count = 260 }: { active: boolean; origin?: THREE.Vector3; count?: number }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const parts = useMemo(
    () =>
      Array.from({ length: count }, () => ({
        p: new THREE.Vector3(),
        v: new THREE.Vector3(),
        r: new THREE.Euler(),
        w: new THREE.Vector3(Math.random() * 6, Math.random() * 6, Math.random() * 6),
        color: new THREE.Color().setHSL(Math.random(), 0.9, 0.6),
      })),
    [count],
  );
  const started = useRef(-1);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => {
    // Calque 1 : visibles par la caméra principale mais pas par la caméra de réflexion du sol
    // (le sol réfléchissant produisait des valeurs invalides avec ces particules).
    mesh.current?.layers.set(1);
    parts.forEach((pt, i) => mesh.current?.setColorAt(i, pt.color));
    if (mesh.current?.instanceColor) mesh.current.instanceColor.needsUpdate = true;
  }, [parts]);

  useFrame((st, dt) => {
    if (!mesh.current) return;
    if (active && started.current < 0) {
      started.current = st.clock.elapsedTime;
      parts.forEach((pt) => {
        pt.p.copy(origin).add(new THREE.Vector3((Math.random() - 0.5) * 16, Math.random() * 2, (Math.random() - 0.5) * 10));
        pt.v.set((Math.random() - 0.5) * 2, -1 - Math.random() * 2, (Math.random() - 0.5) * 2);
      });
    }
    if (!active) started.current = -1;
    mesh.current.visible = started.current >= 0;
    if (!mesh.current.visible) return;
    parts.forEach((pt, i) => {
      pt.v.y = Math.max(-2.2, pt.v.y - dt * 0.6);
      pt.p.addScaledVector(pt.v, dt);
      pt.p.x += Math.sin(st.clock.elapsedTime * 2 + i) * dt * 0.6;
      if (pt.p.y < 0.05) pt.p.set(origin.x + (Math.random() - 0.5) * 16, origin.y, origin.z + (Math.random() - 0.5) * 10);
      pt.r.x += pt.w.x * dt;
      pt.r.y += pt.w.y * dt;
      dummy.position.copy(pt.p);
      dummy.rotation.copy(pt.r);
      dummy.updateMatrix();
      mesh.current!.setMatrixAt(i, dummy.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]} visible={false}>
      <planeGeometry args={[0.12, 0.2]} />
      <meshBasicMaterial side={THREE.DoubleSide} toneMapped={false} />
    </instancedMesh>
  );
}
