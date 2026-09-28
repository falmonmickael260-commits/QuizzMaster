"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { CharacterPreset } from "@shared/characters";

// ─── Géométries partagées (créées une seule fois pour tous les personnages) ───

const G = {
  sphere: new THREE.SphereGeometry(1, 32, 24),
  sphereLow: new THREE.SphereGeometry(1, 16, 12),
  hemi: new THREE.SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2),
  capsuleTorso: new THREE.CapsuleGeometry(0.34, 0.42, 8, 24),
  capsuleArm: new THREE.CapsuleGeometry(0.1, 0.5, 6, 12),
  capsuleLeg: new THREE.CapsuleGeometry(0.13, 0.7, 6, 12),
  cylinder: new THREE.CylinderGeometry(1, 1, 1, 20),
  cone: new THREE.ConeGeometry(1, 1, 12),
  box: new THREE.BoxGeometry(1, 1, 1),
  torusSmile: new THREE.TorusGeometry(0.075, 0.017, 8, 20, Math.PI),
  torusFull: new THREE.TorusGeometry(1, 0.08, 10, 32),
  halfDisc: new THREE.CircleGeometry(0.085, 24, Math.PI, Math.PI),
  brow: new THREE.CapsuleGeometry(0.022, 0.1, 4, 8),
  ring: new THREE.TorusGeometry(0.075, 0.012, 8, 24),
};

export type Mood =
  | "idle"
  | "thinking"
  | "focused"
  | "confident"
  | "happy"
  | "ecstatic"
  | "sad"
  | "shocked"
  | "shrug"
  | "clap"
  | "victory"
  | "wave"
  | "excited"
  | "talk"
  | "present"
  | "point";

type Mouth = "smile" | "grin" | "o" | "frown" | "flat";

interface Pose {
  armLx: number;
  armLz: number;
  armRx: number;
  armRz: number;
  lean: number;
  headTilt: number;
  browY: number;
  browRot: number;
  bounce: number;
  mouth: Mouth;
}

const REST: Pose = { armLx: -0.82, armLz: 0.18, armRx: -0.82, armRz: -0.18, lean: 0, headTilt: 0, browY: 0, browRot: 0, bounce: 0, mouth: "smile" };

function targetPose(mood: Mood, t: number, seed: number): Pose {
  const s = Math.sin;
  switch (mood) {
    case "thinking":
      return { ...REST, armRx: -2.35, armRz: 0.55 + s(t * 2 + seed) * 0.03, headTilt: 0.12, browY: 0.02, browRot: 0.15, mouth: "flat" };
    case "focused":
      return { ...REST, lean: 0.12, browY: -0.015, browRot: -0.12, mouth: "flat" };
    case "confident":
      return { ...REST, lean: -0.04, mouth: "smile", headTilt: s(t * 1.5 + seed) * 0.05 };
    case "happy":
      return { ...REST, armRx: -2.9 + s(t * 10) * 0.2, armRz: -0.35, bounce: 0.06, mouth: "grin", browY: 0.03 };
    case "ecstatic":
    case "victory":
      return { ...REST, armLx: -3.0 + s(t * 9) * 0.15, armLz: 0.45, armRx: -3.0 + s(t * 9 + 1) * 0.15, armRz: -0.45, bounce: mood === "victory" ? 0.28 : 0.18, mouth: "grin", browY: 0.05, lean: -0.08 };
    case "sad":
      return { ...REST, armLx: -0.35, armLz: 0.1, armRx: -0.35, armRz: -0.1, lean: 0.22, headTilt: s(t * 3 + seed) * 0.12, browY: 0.0, browRot: 0.35, mouth: "frown" };
    case "shocked":
      return { ...REST, armLx: -2.1, armLz: -0.5, armRx: -2.1, armRz: 0.5, lean: -0.15, browY: 0.07, mouth: "o" };
    case "shrug":
      return { ...REST, armLx: -1.0, armLz: 0.9, armRx: -1.0, armRz: -0.9, browY: 0.05, mouth: "flat", headTilt: 0.15 };
    case "clap": {
      const c = Math.abs(s(t * 11 + seed));
      return { ...REST, armLx: -1.45, armLz: -0.25 - c * 0.35, armRx: -1.45, armRz: 0.25 + c * 0.35, mouth: "grin", bounce: 0.02 };
    }
    case "wave":
      return { ...REST, armRx: -2.8, armRz: -0.4 + s(t * 9) * 0.35, mouth: "grin", browY: 0.03 };
    case "excited":
      return { ...REST, armLx: -1.5, armLz: -0.35 + s(t * 14) * 0.08, armRx: -1.5, armRz: 0.35 - s(t * 14) * 0.08, bounce: 0.05, mouth: "grin", browY: 0.03 };
    case "talk":
      return { ...REST, armRx: -1.6 + s(t * 2.2) * 0.25, armRz: -0.5 + s(t * 1.7) * 0.2, mouth: Math.floor(t * 7.5) % 2 ? "o" : "smile", browY: s(t * 3) * 0.015 };
    case "present":
      return { ...REST, armLx: -1.7, armLz: 1.05, armRx: -1.7, armRz: -1.05, mouth: Math.floor(t * 7) % 2 ? "grin" : "o", browY: 0.03 };
    case "point":
      return { ...REST, armRx: -2.2, armRz: -0.9, mouth: Math.floor(t * 7) % 2 ? "o" : "grin", browY: 0.03 };
    default:
      return { ...REST, mouth: "smile" };
  }
}

export interface CharacterProps {
  preset: CharacterPreset;
  mood: Mood;
  /** Point regardé (coordonnées monde). */
  lookAt?: THREE.Vector3 | null;
  suit?: boolean;
  seed?: number;
  holdCard?: boolean;
}

export function Character({ preset, mood, lookAt, suit = false, seed = 0, holdCard = false }: CharacterProps) {
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const torso = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const eyes = useRef<THREE.Group>(null);
  const browL = useRef<THREE.Mesh>(null);
  const browR = useRef<THREE.Mesh>(null);
  const pupils = useRef<THREE.Group[]>([]);
  const mouths = useRef<Record<Mouth, THREE.Object3D | null>>({ smile: null, grin: null, o: null, frown: null, flat: null });
  const pose = useRef<Pose>({ ...REST });
  const blinkAt = useRef(2 + seed);
  const tmp = useMemo(() => ({ v: new THREE.Vector3(), m: new THREE.Matrix4(), q: new THREE.Quaternion() }), []);

  const mats = useMemo(() => {
    const std = (color: string, roughness = 0.55, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
    return {
      skin: std(preset.skin, 0.62),
      skinDark: std(new THREE.Color(preset.skin).multiplyScalar(0.8).getStyle(), 0.7),
      hair: std(preset.hair, 0.5),
      outfit: std(suit ? "#1a2240" : preset.outfit, suit ? 0.4 : 0.75),
      accent: std(suit ? "#f4f6ff" : preset.outfitAccent, 0.6),
      pants: std(suit ? "#141a33" : "#232838", 0.8),
      shoe: std("#f2f2f2", 0.5),
      eyeWhite: new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.2 }),
      iris: std(preset.eyes, 0.3),
      pupil: new THREE.MeshStandardMaterial({ color: "#0a0a0a", roughness: 0.2 }),
      shine: new THREE.MeshBasicMaterial({ color: "#ffffff" }),
      mouth: new THREE.MeshStandardMaterial({ color: "#5a1420", roughness: 0.6, side: THREE.DoubleSide }),
      teeth: new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.4 }),
      lip: std("#8c3a3a", 0.5),
      blush: new THREE.MeshBasicMaterial({ color: "#ff7a8a", transparent: true, opacity: 0.25, depthWrite: false }),
      acc: std(preset.accessoryColor, 0.35, 0.2),
      tie: std("#ff2e63", 0.45),
      card: std("#29e7ff", 0.3),
      brow: std(new THREE.Color(preset.hair).multiplyScalar(0.8).getStyle(), 0.6),
    };
  }, [preset, suit]);

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime + seed * 1.7;
    const k = 1 - Math.exp(-dt * 7);
    const target = targetPose(mood, t, seed);
    const p = pose.current;
    (["armLx", "armLz", "armRx", "armRz", "lean", "headTilt", "browY", "browRot", "bounce"] as const).forEach((key) => {
      p[key] += (target[key] - p[key]) * k;
    });
    p.mouth = target.mouth;

    if (body.current) {
      const hop = p.bounce > 0.001 ? Math.abs(Math.sin(t * (mood === "victory" ? 7 : 9))) * p.bounce : 0;
      body.current.position.y = hop;
    }
    if (torso.current) {
      const breathe = 1 + Math.sin(t * 2.1) * 0.018;
      torso.current.scale.set(1.12, breathe, 1);
      torso.current.rotation.x = p.lean + Math.sin(t * 0.7) * 0.015;
      torso.current.rotation.z = Math.sin(t * 0.5 + seed) * 0.02;
    }
    if (armL.current) armL.current.rotation.set(p.armLx, 0, p.armLz);
    if (armR.current) armR.current.rotation.set(p.armRx, 0, p.armRz);

    // tête : regarde la cible (écran, animateur, roue…) avec une amplitude limitée
    if (head.current) {
      let yaw = Math.sin(t * 0.4 + seed) * 0.08;
      let pitch = mood === "sad" ? 0.35 : 0;
      if (lookAt && root.current) {
        tmp.m.copy(root.current.matrixWorld).invert();
        tmp.v.copy(lookAt).applyMatrix4(tmp.m);
        const dx = tmp.v.x;
        const dy = tmp.v.y - 2.3;
        const dz = tmp.v.z;
        yaw = THREE.MathUtils.clamp(Math.atan2(dx, dz), -1.0, 1.0);
        if (mood !== "sad") pitch = THREE.MathUtils.clamp(-Math.atan2(dy, Math.hypot(dx, dz)), -0.45, 0.3);
      }
      if (mood === "confident" || mood === "talk") pitch += Math.sin(t * 4) * 0.04;
      head.current.rotation.y += (yaw - head.current.rotation.y) * k;
      head.current.rotation.x += (pitch - head.current.rotation.x) * k;
      head.current.rotation.z = p.headTilt;
    }
    // clignement des yeux
    if (eyes.current) {
      const since = t - blinkAt.current;
      let sy = 1;
      if (since > 0 && since < 0.14) sy = Math.abs(since - 0.07) / 0.07;
      if (since > 0.14) blinkAt.current = t + 2 + ((seed * 7.3 + t) % 3.5);
      const wide = mood === "shocked" ? 1.25 : mood === "sad" ? 0.8 : 1;
      eyes.current.scale.y = Math.max(0.08, sy) * wide;
    }
    if (browL.current && browR.current) {
      browL.current.position.y = 0.165 + p.browY;
      browR.current.position.y = 0.165 + p.browY;
      browL.current.rotation.z = Math.PI / 2 - p.browRot;
      browR.current.rotation.z = Math.PI / 2 + p.browRot;
    }
    (Object.keys(mouths.current) as Mouth[]).forEach((m) => {
      const o = mouths.current[m];
      if (o) o.visible = m === p.mouth;
    });
  });


  return (
    <group ref={root}>
      <group ref={body}>
        {/* jambes (cachées par le pupitre en vue de face, visibles de côté) */}
        {[-0.16, 0.16].map((x) => (
          <group key={x} position={[x, 0.55, 0]}>
            <mesh geometry={G.capsuleLeg} material={mats.pants} />
            <mesh geometry={G.sphere} material={mats.shoe} position={[0, -0.47, 0.08]} scale={[0.15, 0.1, 0.24]} />
          </group>
        ))}
        {/* bassin */}
        <mesh geometry={G.sphere} material={mats.pants} position={[0, 1.02, 0]} scale={[0.36, 0.2, 0.28]} />
        {/* torse */}
        <group ref={torso} position={[0, 1.05, 0]}>
          <mesh geometry={G.capsuleTorso} material={mats.outfit} position={[0, 0.42, 0]} />
          {suit ? (
            <>
              {/* chemise + cravate */}
              <mesh geometry={G.cone} material={mats.accent} position={[0, 0.66, 0.26]} rotation={[Math.PI + 0.25, 0, 0]} scale={[0.14, 0.34, 0.05]} />
              <mesh geometry={G.box} material={mats.tie} position={[0, 0.56, 0.33]} rotation={[-0.2, 0, 0]} scale={[0.07, 0.3, 0.02]} />
              <mesh geometry={G.box} material={mats.tie} position={[0, 0.72, 0.31]} rotation={[-0.3, 0, Math.PI / 4]} scale={[0.07, 0.07, 0.03]} />
              {/* revers */}
              {[-1, 1].map((sx) => (
                <mesh key={sx} geometry={G.box} material={mats.outfit} position={[sx * 0.12, 0.6, 0.3]} rotation={[-0.25, 0, sx * 0.35]} scale={[0.06, 0.34, 0.03]} />
              ))}
            </>
          ) : (
            <>
              {/* capuche / col du sweat */}
              <mesh geometry={G.torusFull} material={mats.accent} position={[0, 0.8, -0.02]} rotation={[Math.PI / 2 + 0.15, 0, 0]} scale={[0.2, 0.2, 0.9]} />
              <mesh geometry={G.box} material={mats.accent} position={[0, 0.45, 0.33]} rotation={[-0.08, 0, 0]} scale={[0.02, 0.5, 0.02]} />
              {[-0.06, 0.06].map((x) => (
                <mesh key={x} geometry={G.cylinder} material={mats.accent} position={[x, 0.58, 0.33]} scale={[0.012, 0.18, 0.012]} />
              ))}
              <mesh geometry={G.box} material={mats.accent} position={[0, 0.14, 0.31]} rotation={[-0.1, 0, 0]} scale={[0.36, 0.14, 0.04]} />
            </>
          )}
          {/* cou */}
          <mesh geometry={G.cylinder} material={mats.skinDark} position={[0, 0.88, 0]} scale={[0.1, 0.18, 0.1]} />
          {/* bras */}
          <group ref={armL} position={[0.44, 0.7, 0]}>
            <mesh geometry={G.sphere} material={mats.outfit} scale={0.15} />
            <mesh geometry={G.capsuleArm} material={mats.outfit} position={[0, -0.33, 0]} />
            <mesh geometry={G.sphere} material={mats.skin} position={[0, -0.7, 0]} scale={[0.12, 0.13, 0.11]} />
          </group>
          <group ref={armR} position={[-0.44, 0.7, 0]}>
            <mesh geometry={G.sphere} material={mats.outfit} scale={0.15} />
            <mesh geometry={G.capsuleArm} material={mats.outfit} position={[0, -0.33, 0]} />
            <mesh geometry={G.sphere} material={mats.skin} position={[0, -0.7, 0]} scale={[0.12, 0.13, 0.11]} />
            {holdCard && <mesh geometry={G.box} material={mats.card} position={[0, -0.78, 0.08]} rotation={[0.3, 0, 0]} scale={[0.24, 0.02, 0.32]} />}
          </group>
          {/* tête */}
          <group ref={head} position={[0, 1.22, 0]}>
            <Head preset={preset} mats={mats} eyesRef={eyes} browL={browL} browR={browR} pupils={pupils} mouths={mouths} suit={suit} />
          </group>
        </group>
      </group>
    </group>
  );
}

type Mats = Record<string, THREE.Material>;

function Head({
  preset,
  mats,
  eyesRef,
  browL,
  browR,
  pupils,
  mouths,
  suit,
}: {
  preset: CharacterPreset;
  mats: Mats;
  eyesRef: React.RefObject<THREE.Group | null>;
  browL: React.RefObject<THREE.Mesh | null>;
  browR: React.RefObject<THREE.Mesh | null>;
  pupils: React.RefObject<THREE.Group[]>;
  mouths: React.RefObject<Record<Mouth, THREE.Object3D | null>>;
  suit: boolean;
}) {
  return (
    <group>
      {/* crâne */}
      <mesh geometry={G.sphere} material={mats.skin} scale={[0.43, 0.45, 0.41]} />
      {/* menton / joues */}
      <mesh geometry={G.sphere} material={mats.skin} position={[0, -0.14, 0.08]} scale={[0.33, 0.28, 0.3]} />
      {/* oreilles */}
      {[-1, 1].map((sx) => (
        <mesh key={sx} geometry={G.sphere} material={mats.skin} position={[sx * 0.41, -0.02, 0]} scale={[0.07, 0.1, 0.06]} />
      ))}
      {/* yeux */}
      <group ref={eyesRef} position={[0, 0.03, 0]}>
        {[-1, 1].map((sx, i) => (
          <group key={sx} position={[sx * 0.15, 0, 0.33]}>
            <mesh geometry={G.sphere} material={mats.eyeWhite} scale={[0.1, 0.12, 0.07]} />
            <group
              ref={(g) => {
                if (g && pupils.current) pupils.current[i] = g;
              }}
              position={[0, -0.005, 0.05]}
            >
              <mesh geometry={G.sphere} material={mats.iris} scale={[0.065, 0.075, 0.03]} />
              <mesh geometry={G.sphere} material={mats.pupil} position={[0, 0, 0.015]} scale={[0.036, 0.042, 0.02]} />
              <mesh geometry={G.sphereLow} material={mats.shine} position={[0.022, 0.03, 0.03]} scale={0.016} />
            </group>
          </group>
        ))}
      </group>
      {/* sourcils */}
      <mesh ref={browL} geometry={G.brow} material={mats.brow} position={[0.15, 0.165, 0.39]} rotation={[0, 0, Math.PI / 2]} />
      <mesh ref={browR} geometry={G.brow} material={mats.brow} position={[-0.15, 0.165, 0.39]} rotation={[0, 0, Math.PI / 2]} />
      {/* nez */}
      <mesh geometry={G.sphere} material={mats.skinDark} position={[0, -0.06, 0.41]} scale={[0.045, 0.04, 0.04]} />
      {/* joues */}
      {[-1, 1].map((sx) => (
        <mesh key={sx} geometry={G.sphereLow} material={mats.blush} position={[sx * 0.24, -0.1, 0.33]} scale={[0.06, 0.035, 0.02]} />
      ))}
      {/* bouches */}
      <group position={[0, -0.18, 0.395]}>
        <mesh ref={(m) => void (mouths.current && (mouths.current.smile = m))} geometry={G.torusSmile} material={mats.lip} rotation={[0, 0, Math.PI]} />
        <group ref={(g) => void (mouths.current && (mouths.current.grin = g))}>
          <mesh geometry={G.halfDisc} material={mats.mouth} position={[0, 0.02, 0.005]} />
          <mesh geometry={G.box} material={mats.teeth} position={[0, 0.005, 0.008]} scale={[0.13, 0.025, 0.005]} />
        </group>
        <mesh ref={(m) => void (mouths.current && (mouths.current.o = m))} geometry={G.sphere} material={mats.mouth} scale={[0.05, 0.065, 0.02]} />
        <mesh ref={(m) => void (mouths.current && (mouths.current.frown = m))} geometry={G.torusSmile} material={mats.lip} position={[0, -0.04, 0]} />
        <mesh ref={(m) => void (mouths.current && (mouths.current.flat = m))} geometry={G.box} material={mats.lip} scale={[0.1, 0.018, 0.01]} />
      </group>
      <Hair preset={preset} mats={mats} suit={suit} />
      <Accessory preset={preset} mats={mats} />
    </group>
  );
}

function Hair({ preset, mats, suit }: { preset: CharacterPreset; mats: Mats; suit: boolean }) {
  const h = mats.hair;
  const cap = <mesh geometry={G.hemi} material={h} position={[0, 0.05, -0.03]} rotation={[-0.42, 0, 0]} scale={[0.455, 0.47, 0.44]} />;
  if (suit) {
    return (
      <group>
        {cap}
        <mesh geometry={G.sphere} material={h} position={[0.12, 0.33, 0.2]} rotation={[0, 0, -0.5]} scale={[0.26, 0.1, 0.16]} />
        <mesh geometry={G.sphere} material={h} position={[0, 0.05, -0.15]} scale={[0.43, 0.38, 0.32]} />
      </group>
    );
  }
  switch (preset.hairStyle) {
    case "buzz":
      return <mesh geometry={G.hemi} material={h} position={[0, 0.04, -0.01]} rotation={[-0.2, 0, 0]} scale={[0.438, 0.43, 0.425]} />;
    case "short":
      return (
        <group>
          {cap}
          <mesh geometry={G.sphere} material={h} position={[-0.1, 0.32, 0.23]} rotation={[0.2, 0, 0.3]} scale={[0.28, 0.1, 0.14]} />
          <mesh geometry={G.sphere} material={h} position={[0, 0.02, -0.14]} scale={[0.44, 0.36, 0.34]} />
        </group>
      );
    case "spiky":
      return (
        <group>
          {cap}
          {[
            [0, 0.46, 0.05, 0, 0],
            [0.18, 0.42, 0.05, 0, -0.5],
            [-0.18, 0.42, 0.05, 0, 0.5],
            [0.1, 0.4, 0.22, 0.5, -0.3],
            [-0.1, 0.4, 0.22, 0.5, 0.3],
            [0, 0.4, -0.18, -0.5, 0],
          ].map(([x, y, z, rx, rz], i) => (
            <mesh key={i} geometry={G.cone} material={h} position={[x, y, z]} rotation={[rx, 0, rz]} scale={[0.1, 0.24, 0.1]} />
          ))}
        </group>
      );
    case "long":
      return (
        <group>
          {cap}
          <mesh geometry={G.sphere} material={h} position={[0, -0.12, -0.16]} scale={[0.47, 0.55, 0.3]} />
          {[-1, 1].map((sx) => (
            <mesh key={sx} geometry={G.sphere} material={h} position={[sx * 0.36, -0.2, 0.02]} scale={[0.1, 0.4, 0.16]} />
          ))}
          <mesh geometry={G.sphere} material={h} position={[0.08, 0.3, 0.26]} rotation={[0.4, 0, -0.4]} scale={[0.28, 0.08, 0.12]} />
        </group>
      );
    case "ponytail":
      return (
        <group>
          {cap}
          <mesh geometry={G.sphere} material={h} position={[0, 0.2, -0.38]} scale={[0.12, 0.12, 0.12]} />
          <mesh geometry={G.capsuleArm} material={h} position={[0, -0.05, -0.47]} rotation={[0.25, 0, 0]} scale={[1.1, 0.8, 1.1]} />
          <mesh geometry={G.sphere} material={h} position={[-0.08, 0.32, 0.25]} rotation={[0.3, 0, 0.4]} scale={[0.25, 0.08, 0.12]} />
        </group>
      );
    case "curly":
      return (
        <group>
          {cap}
          {Array.from({ length: 14 }, (_, i) => {
            const a = (i / 14) * Math.PI * 2;
            return <mesh key={i} geometry={G.sphereLow} material={h} position={[Math.cos(a) * 0.36, 0.28 + Math.sin(i * 1.7) * 0.05, Math.sin(a) * 0.32 - 0.04]} scale={0.14} />;
          })}
          <mesh geometry={G.sphereLow} material={h} position={[0, 0.42, 0]} scale={0.2} />
        </group>
      );
    case "bun":
      return (
        <group>
          {cap}
          <mesh geometry={G.sphere} material={h} position={[0, 0.5, -0.12]} scale={0.17} />
          <mesh geometry={G.sphere} material={h} position={[0.05, 0.3, 0.26]} rotation={[0.3, 0, -0.3]} scale={[0.3, 0.08, 0.12]} />
        </group>
      );
    case "afro":
      return <mesh geometry={G.sphereLow} material={h} position={[0, 0.2, -0.08]} scale={[0.62, 0.52, 0.55]} />;
    case "bob":
      return (
        <group>
          {cap}
          {[-1, 1].map((sx) => (
            <mesh key={sx} geometry={G.sphere} material={h} position={[sx * 0.37, -0.1, 0]} scale={[0.12, 0.3, 0.28]} />
          ))}
          <mesh geometry={G.sphere} material={h} position={[0, -0.05, -0.15]} scale={[0.45, 0.4, 0.3]} />
          <mesh geometry={G.box} material={h} position={[0, 0.28, 0.3]} rotation={[0.5, 0, 0]} scale={[0.62, 0.1, 0.14]} />
        </group>
      );
  }
}

function Accessory({ preset, mats }: { preset: CharacterPreset; mats: Mats }) {
  const a = mats.acc;
  switch (preset.accessory) {
    case "cap":
      return (
        <group>
          <mesh geometry={G.hemi} material={a} position={[0, 0.1, 0]} rotation={[-0.15, 0, 0]} scale={[0.47, 0.42, 0.47]} />
          <mesh geometry={G.cylinder} material={a} position={[0, 0.16, 0.42]} rotation={[0.25, 0, 0]} scale={[0.3, 0.02, 0.22]} />
        </group>
      );
    case "beanie":
      return (
        <group>
          <mesh geometry={G.hemi} material={a} position={[0, 0.12, -0.01]} rotation={[-0.15, 0, 0]} scale={[0.47, 0.48, 0.46]} />
          <mesh geometry={G.torusFull} material={a} position={[0, 0.13, 0]} rotation={[Math.PI / 2 - 0.15, 0, 0]} scale={[0.46, 0.45, 0.8]} />
          <mesh geometry={G.sphereLow} material={a} position={[0, 0.62, -0.06]} scale={0.1} />
        </group>
      );
    case "glasses":
    case "roundGlasses": {
      const round = preset.accessory === "roundGlasses";
      return (
        <group position={[0, 0.03, 0.42]}>
          {[-1, 1].map((sx) => (
            <mesh key={sx} geometry={G.ring} material={a} position={[sx * 0.15, 0, 0]} scale={round ? [1.35, 1.35, 1] : [1.5, 1.15, 1]} />
          ))}
          <mesh geometry={G.box} material={a} position={[0, 0.01, 0]} scale={[0.1, 0.018, 0.018]} />
        </group>
      );
    }
    case "headphones":
      return (
        <group>
          <mesh geometry={G.torusFull} material={a} position={[0, 0.05, 0]} rotation={[0, 0, 0]} scale={[0.48, 0.5, 0.6]} />
          {[-1, 1].map((sx) => (
            <mesh key={sx} geometry={G.cylinder} material={a} position={[sx * 0.46, -0.02, 0]} rotation={[0, 0, Math.PI / 2]} scale={[0.14, 0.1, 0.14]} />
          ))}
        </group>
      );
    case "headband":
      return <mesh geometry={G.torusFull} material={a} position={[0, 0.2, 0.02]} rotation={[Math.PI / 2 - 0.3, 0, 0]} scale={[0.45, 0.43, 0.9]} />;
    default:
      return null;
  }
}
