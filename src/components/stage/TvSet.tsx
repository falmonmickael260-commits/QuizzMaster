"use client";

// Plateau « QUIZZ MASTER » : décor fixe façon grand jeu télévisé (sol noir brillant, scène ronde cerclée d'or,
// dalles de catégories, logo couronné, colonnes LED, rampes dorées, public en gradins).
// Rien ne bouge dans le décor : seuls les candidats sont animés.

import { MeshReflectorMaterial } from "@react-three/drei";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { fontsVersion, FONTS } from "@/lib/draw";
import { SCREEN_POS, SCREEN_SIZE } from "@/lib/layout";
import { useCanvasTexture } from "./useCanvasTexture";

/** Centre de la scène ronde (devant les pupitres, entre les deux candidats du centre). */
export const TV_STAGE_CENTER = new THREE.Vector3(0, 0, -1.2);

// ─── Matériaux communs ───────────────────────────────────────────────────────

const glowColor = (hex: string, k: number) => new THREE.Color(hex).multiplyScalar(k);
const MAT = {
  black: new THREE.MeshPhysicalMaterial({ color: "#080b18", roughness: 0.16, metalness: 0.35, clearcoat: 1, clearcoatRoughness: 0.08 }),
  navy: new THREE.MeshPhysicalMaterial({ color: "#0d1638", roughness: 0.3, metalness: 0.5, clearcoat: 0.6 }),
  gold: new THREE.MeshStandardMaterial({ color: "#d9a93c", metalness: 1, roughness: 0.22, emissive: "#6b4608", emissiveIntensity: 0.5 }),
  goldLight: new THREE.MeshBasicMaterial({ color: glowColor("#ffc14a", 1.6), toneMapped: false }),
  warmLight: new THREE.MeshBasicMaterial({ color: glowColor("#ffe7b0", 1.3), toneMapped: false }),
  blueLight: new THREE.MeshBasicMaterial({ color: glowColor("#5aa8ff", 2.4), toneMapped: false }),
  blueSoft: new THREE.MeshBasicMaterial({ color: glowColor("#2f6bff", 1.2), toneMapped: false }),
  wall: new THREE.MeshStandardMaterial({ color: "#070b22", roughness: 0.55, metalness: 0.4, side: THREE.BackSide }),
  wallPanel: new THREE.MeshStandardMaterial({ color: "#0f1a4a", roughness: 0.35, metalness: 0.6 }),
  crowd: new THREE.MeshStandardMaterial({ color: "#0b0e1e", roughness: 0.7, metalness: 0.2 }),
  riser: new THREE.MeshStandardMaterial({ color: "#0a0e22", roughness: 0.5, metalness: 0.4 }),
};

// ─── Logo couronné (texture dessinée) ────────────────────────────────────────

function drawCrown(ctx: CanvasRenderingContext2D, cx: number, baseY: number, w: number, h: number) {
  const g = ctx.createLinearGradient(0, baseY - h, 0, baseY);
  g.addColorStop(0, "#fff4c2");
  g.addColorStop(0.45, "#f5c542");
  g.addColorStop(1, "#a86b12");
  ctx.beginPath();
  const x0 = cx - w / 2;
  ctx.moveTo(x0, baseY);
  ctx.lineTo(x0 - w * 0.02, baseY - h * 0.72);
  ctx.lineTo(x0 + w * 0.22, baseY - h * 0.38);
  ctx.lineTo(cx, baseY - h);
  ctx.lineTo(x0 + w * 0.78, baseY - h * 0.38);
  ctx.lineTo(x0 + w * 1.02, baseY - h * 0.72);
  ctx.lineTo(x0 + w, baseY);
  ctx.closePath();
  ctx.fillStyle = g;
  ctx.shadowColor = "rgba(255,190,60,0.9)";
  ctx.shadowBlur = 30;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineWidth = w * 0.02;
  ctx.strokeStyle = "#7a4a08";
  ctx.stroke();
  // bandeau et joyaux
  ctx.fillStyle = "#c98d1c";
  ctx.fillRect(x0 + w * 0.04, baseY - h * 0.16, w * 0.92, h * 0.12);
  for (const [px, py, r, col] of [
    [cx, baseY - h, h * 0.09, "#ffffff"],
    [x0 - w * 0.02, baseY - h * 0.72, h * 0.07, "#ffffff"],
    [x0 + w * 1.02, baseY - h * 0.72, h * 0.07, "#ffffff"],
    [cx, baseY - h * 0.1, h * 0.07, "#3a86ff"],
    [cx - w * 0.28, baseY - h * 0.1, h * 0.05, "#ff2e63"],
    [cx + w * 0.28, baseY - h * 0.1, h * 0.05, "#2ee59d"],
  ] as const) {
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fillStyle = col;
    ctx.fill();
  }
}

function drawTitle(ctx: CanvasRenderingContext2D, text: string, cx: number, cy: number, size: number, maxW: number) {
  ctx.font = `italic 900 ${size}px ${FONTS.display}`;
  const w = ctx.measureText(text).width;
  const s = Math.min(1, maxW / w);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s, 1);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  // relief
  for (let i = 10; i > 0; i -= 2) {
    ctx.fillStyle = i > 4 ? "#0a1238" : "#1b2a78";
    ctx.fillText(text, 0, i * size * 0.012);
  }
  const g = ctx.createLinearGradient(0, -size / 2, 0, size / 2);
  g.addColorStop(0, "#ffffff");
  g.addColorStop(0.55, "#e9eeff");
  g.addColorStop(1, "#aebcf0");
  ctx.lineJoin = "round";
  ctx.lineWidth = size * 0.09;
  ctx.strokeStyle = "#c98d1c";
  ctx.strokeText(text, 0, 0);
  ctx.lineWidth = size * 0.035;
  ctx.strokeStyle = "#ffe08a";
  ctx.strokeText(text, 0, 0);
  ctx.fillStyle = g;
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

export function drawQuizzMasterLogo(ctx: CanvasRenderingContext2D, size: number, badge = true) {
  const c = size / 2;
  ctx.clearRect(0, 0, size, size);
  if (badge) {
    // halo bleu
    ctx.save();
    ctx.shadowColor = "rgba(60,140,255,0.95)";
    ctx.shadowBlur = size * 0.05;
    ctx.beginPath();
    ctx.arc(c, c * 1.04, size * 0.445, 0, Math.PI * 2);
    ctx.strokeStyle = "#5aa8ff";
    ctx.lineWidth = size * 0.012;
    ctx.stroke();
    ctx.restore();
    // disque
    const rg = ctx.createRadialGradient(c, c * 0.95, size * 0.05, c, c * 1.04, size * 0.43);
    rg.addColorStop(0, "#1f3596");
    rg.addColorStop(0.6, "#0d1a5a");
    rg.addColorStop(1, "#050a26");
    ctx.beginPath();
    ctx.arc(c, c * 1.04, size * 0.42, 0, Math.PI * 2);
    ctx.fillStyle = rg;
    ctx.fill();
    // anneau doré
    const gg = ctx.createLinearGradient(0, size * 0.1, 0, size * 0.95);
    gg.addColorStop(0, "#fff1b0");
    gg.addColorStop(0.35, "#e0a52a");
    gg.addColorStop(0.6, "#8a5a10");
    gg.addColorStop(1, "#ffd970");
    ctx.save();
    ctx.shadowColor = "rgba(255,190,60,0.8)";
    ctx.shadowBlur = size * 0.03;
    ctx.beginPath();
    ctx.arc(c, c * 1.04, size * 0.42, 0, Math.PI * 2);
    ctx.strokeStyle = gg;
    ctx.lineWidth = size * 0.028;
    ctx.stroke();
    ctx.restore();
  }
  drawCrown(ctx, c, size * 0.31, size * 0.34, size * 0.2);
  drawTitle(ctx, "QUIZZ", c, size * 0.5, size * 0.21, size * 0.74);
  drawTitle(ctx, "MASTER", c, size * 0.7, size * 0.19, size * 0.8);
}

function LogoSign({ position, rotationY = 0, scale = 1 }: { position: THREE.Vector3; rotationY?: number; scale?: number }) {
  const tex = useCanvasTexture(
    1024,
    1024,
    () => `logo|${fontsVersion}`,
    (ctx) => drawQuizzMasterLogo(ctx, 1024),
  );
  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={scale}>
      <mesh>
        <planeGeometry args={[7.4, 7.4]} />
        <meshBasicMaterial map={tex} transparent alphaTest={0.02} toneMapped={false} />
      </mesh>
      {/* anneaux lumineux autour du médaillon */}
      <mesh position={[0, -0.15, -0.05]}>
        <torusGeometry args={[3.35, 0.05, 10, 128]} />
        <primitive object={MAT.goldLight} attach="material" />
      </mesh>
      <mesh position={[0, -0.15, -0.1]}>
        <torusGeometry args={[3.75, 0.035, 8, 128]} />
        <primitive object={MAT.blueLight} attach="material" />
      </mesh>
    </group>
  );
}

// ─── Dalles de catégories au sol ─────────────────────────────────────────────

const TILES = [
  { color: "#2f7bff", icon: "🌍" },
  { color: "#ff3d7f", icon: "🔬" },
  { color: "#22c55e", icon: "🌿" },
  { color: "#f59e0b", icon: "🏛️" },
  { color: "#e11d48", icon: "🎬" },
  { color: "#8b5cf6", icon: "🎵" },
  { color: "#1f2937", icon: "⚽" },
];

function Tile({ color, icon, angle }: { color: string; icon: string; angle: number }) {
  const tex = useCanvasTexture(
    256,
    192,
    () => `tile|${icon}|${fontsVersion}`,
    (ctx) => {
      const g = ctx.createLinearGradient(0, 0, 0, 192);
      g.addColorStop(0, new THREE.Color(color).offsetHSL(0, 0, 0.12).getStyle());
      g.addColorStop(1, color);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.roundRect(4, 4, 248, 184, 26);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.55)";
      ctx.lineWidth = 6;
      ctx.stroke();
      ctx.font = `92px ${FONTS.text}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(icon, 128, 102);
    },
  );
  const r = 3.35;
  const x = TV_STAGE_CENTER.x + Math.sin(angle) * r;
  const z = TV_STAGE_CENTER.z + Math.cos(angle) * r;
  return (
    <group position={[x, 0, z]} rotation={[0, angle, 0]}>
      <mesh position={[0, 0.05, 0]} material={MAT.black}>
        <boxGeometry args={[1.35, 0.1, 0.95]} />
      </mesh>
      <mesh position={[0, 0.105, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.28, 0.9]} />
        <meshBasicMaterial map={tex} color={[0.78, 0.78, 0.78]} toneMapped={false} />
      </mesh>
    </group>
  );
}

// ─── Public en gradins (silhouettes immobiles) ───────────────────────────────

function Crowd() {
  const bodies = useRef<THREE.InstancedMesh>(null);
  const heads = useRef<THREE.InstancedMesh>(null);
  const seats = useMemo(() => {
    const list: { x: number; y: number; z: number; ry: number; s: number }[] = [];
    const rows = [
      { r: 13.2, y: 0.5 },
      { r: 14.6, y: 1.2 },
      { r: 16.0, y: 1.9 },
      { r: 17.4, y: 2.6 },
    ];
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (const side of [-1, 1]) {
      rows.forEach((row) => {
        for (let a = 34; a <= 100; a += 100 / row.r) {
          const rad = THREE.MathUtils.degToRad(a) * side;
          list.push({ x: Math.sin(rad) * row.r, y: row.y, z: -Math.cos(rad) * row.r + 1, ry: Math.atan2(-Math.sin(rad), Math.cos(rad)), s: 0.9 + rand() * 0.2 });
        }
      });
    }
    return list;
  }, []);
  useLayoutEffect(() => {
    const d = new THREE.Object3D();
    seats.forEach((p, i) => {
      d.position.set(p.x, p.y + 0.55 * p.s, p.z);
      d.rotation.set(0, p.ry, 0);
      d.scale.setScalar(p.s);
      d.updateMatrix();
      bodies.current?.setMatrixAt(i, d.matrix);
      d.position.y = p.y + 1.12 * p.s;
      d.updateMatrix();
      heads.current?.setMatrixAt(i, d.matrix);
    });
    if (bodies.current) bodies.current.instanceMatrix.needsUpdate = true;
    if (heads.current) heads.current.instanceMatrix.needsUpdate = true;
  }, [seats]);
  return (
    <group>
      <instancedMesh ref={bodies} args={[undefined, undefined, seats.length]} material={MAT.crowd}>
        <capsuleGeometry args={[0.24, 0.5, 4, 10]} />
      </instancedMesh>
      <instancedMesh ref={heads} args={[undefined, undefined, seats.length]} material={MAT.crowd}>
        <sphereGeometry args={[0.17, 12, 10]} />
      </instancedMesh>
      {/* gradins */}
      {[-1, 1].map((side) =>
        [13.2, 14.6, 16.0, 17.4].map((r, i) => (
          <group key={`${side}${r}`}>
            <mesh position={[0, 0.25 + i * 0.35, 1]} rotation={[0, 0, 0]}>
              <cylinderGeometry args={[r + 0.7, r + 0.7, 0.5 + i * 0.7, 64, 1, true, side > 0 ? THREE.MathUtils.degToRad(80) : THREE.MathUtils.degToRad(180), THREE.MathUtils.degToRad(100)]} />
              <primitive object={MAT.riser} attach="material" />
            </mesh>
            <mesh position={[0, 0.5 + i * 0.7, 1]} rotation={[Math.PI / 2, 0, side > 0 ? -THREE.MathUtils.degToRad(80) : -THREE.MathUtils.degToRad(180)]}>
              <torusGeometry args={[r + 0.7, 0.025, 6, 64, -THREE.MathUtils.degToRad(100)]} />
              <primitive object={MAT.blueSoft} attach="material" />
            </mesh>
          </group>
        )),
      )}
    </group>
  );
}

// ─── Décor complet ───────────────────────────────────────────────────────────

export function TvSet({ quality }: { quality: "high" | "low" }) {
  const wallBars = useMemo(() => {
    const list: { x: number; z: number; ry: number; bright: boolean }[] = [];
    for (let a = -84; a <= 84; a += 7) {
      if (Math.abs(a) < 22) continue; // derrière le grand écran
      const rad = THREE.MathUtils.degToRad(a);
      list.push({ x: Math.sin(rad) * 19.4, z: -Math.cos(rad) * 19.4 + 1, ry: -rad, bright: Math.round(a / 7) % 3 === 0 });
    }
    return list;
  }, []);
  const spots = useMemo(() => {
    const list: THREE.Vector3[] = [];
    for (let a = -70; a <= 70; a += 7) {
      const rad = THREE.MathUtils.degToRad(a);
      list.push(new THREE.Vector3(Math.sin(rad) * 17.5, 12.6, -Math.cos(rad) * 17.5 + 1));
    }
    return list;
  }, []);

  return (
    <group>
      {/* éclairage : clé chaude de face, contre-jour bleu, douches dorées sur la scène */}
      <ambientLight intensity={0.5} />
      <hemisphereLight args={["#7f9bff", "#140f08", 0.7]} />
      <directionalLight position={[0, 12, 18]} intensity={2.4} color="#fff1dc" />
      <pointLight position={[-7, 3.5, 3]} intensity={45} distance={16} color="#ffb84a" />
      <pointLight position={[7, 3.5, 3]} intensity={45} distance={16} color="#ffb84a" />
      <spotLight position={[0, 14, 6]} angle={0.55} penumbra={0.7} intensity={260} distance={40} color="#ffd89a" target-position={[0, 0, 0]} />
      <spotLight position={[-9, 12, 4]} angle={0.5} penumbra={0.8} intensity={140} distance={34} color="#ffe2b0" />
      <spotLight position={[9, 12, 4]} angle={0.5} penumbra={0.8} intensity={140} distance={34} color="#ffe2b0" />
      <pointLight position={[0, 5, -12]} intensity={70} distance={26} color="#3a7bff" />
      <pointLight position={[-14, 6, -4]} intensity={50} distance={24} color="#3a7bff" />
      <pointLight position={[14, 6, -4]} intensity={50} distance={24} color="#3a7bff" />

      {/* sol noir brillant */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[32, 96]} />
        {quality === "high" ? (
          <MeshReflectorMaterial resolution={512} blur={[260, 60]} mixBlur={0.8} mixStrength={3.2} roughness={0.55} depthScale={0.6} minDepthThreshold={0.4} maxDepthThreshold={1.4} color="#05070f" metalness={0.65} mirror={0.55} />
        ) : (
          <meshStandardMaterial color="#070910" roughness={0.25} metalness={0.6} />
        )}
      </mesh>
      {/* anneaux lumineux au sol */}
      {[
        { r: 4.25, w: 0.07, m: MAT.goldLight },
        { r: 5.1, w: 0.04, m: MAT.blueLight },
        { r: 7.2, w: 0.05, m: MAT.goldLight },
        { r: 9.6, w: 0.035, m: MAT.blueSoft },
        { r: 12.2, w: 0.05, m: MAT.blueLight },
      ].map((ring) => (
        <mesh key={ring.r} position={[TV_STAGE_CENTER.x, 0.012, TV_STAGE_CENTER.z]} rotation={[-Math.PI / 2, 0, 0]} material={ring.m}>
          <ringGeometry args={[ring.r, ring.r + ring.w, 160]} />
        </mesh>
      ))}

      {/* scène ronde centrale à gradins */}
      <group position={TV_STAGE_CENTER}>
        {[
          { r: 2.25, h: 0.14, y: 0.07 },
          { r: 1.85, h: 0.14, y: 0.21 },
          { r: 1.45, h: 0.14, y: 0.35 },
        ].map((t) => (
          <group key={t.r}>
            <mesh position={[0, t.y, 0]} material={MAT.black}>
              <cylinderGeometry args={[t.r, t.r, t.h, 72]} />
            </mesh>
            <mesh position={[0, t.y + t.h / 2, 0]} rotation={[Math.PI / 2, 0, 0]} material={MAT.goldLight}>
              <torusGeometry args={[t.r, 0.022, 8, 96]} />
            </mesh>
          </group>
        ))}
        <CrownEmblem />
      </group>

      {TILES.map((t, i) => (
        <Tile key={t.icon} color={t.color} icon={t.icon} angle={THREE.MathUtils.degToRad(-72 + i * 24)} />
      ))}

      {/* cadre doré et halo bleu autour du grand écran des questions */}
      <group position={[SCREEN_POS.x, SCREEN_POS.y, SCREEN_POS.z - 0.2]}>
        <mesh material={MAT.black}>
          <boxGeometry args={[SCREEN_SIZE.w + 0.7, SCREEN_SIZE.h + 0.7, 0.2]} />
        </mesh>
        {[
          [0, SCREEN_SIZE.h / 2 + 0.22, SCREEN_SIZE.w + 0.6, 0.1],
          [0, -SCREEN_SIZE.h / 2 - 0.22, SCREEN_SIZE.w + 0.6, 0.1],
          [SCREEN_SIZE.w / 2 + 0.22, 0, 0.1, SCREEN_SIZE.h + 0.54],
          [-SCREEN_SIZE.w / 2 - 0.22, 0, 0.1, SCREEN_SIZE.h + 0.54],
        ].map(([x, y, w, h], i) => (
          <mesh key={i} position={[x, y, 0.12]} material={MAT.goldLight}>
            <boxGeometry args={[w, h, 0.05]} />
          </mesh>
        ))}
        {[
          [0, SCREEN_SIZE.h / 2 + 0.36, SCREEN_SIZE.w + 0.9, 0.04],
          [0, -SCREEN_SIZE.h / 2 - 0.36, SCREEN_SIZE.w + 0.9, 0.04],
        ].map(([x, y, w, h], i) => (
          <mesh key={`b${i}`} position={[x, y, 0.1]} material={MAT.blueLight}>
            <boxGeometry args={[w, h, 0.03]} />
          </mesh>
        ))}
      </group>
      {/* estrade sous l'écran */}
      <group position={[0, 0, SCREEN_POS.z + 0.6]}>
        {[
          { w: 12.5, d: 2.2, h: 0.3, y: 0.15 },
          { w: 11.5, d: 1.6, h: 0.3, y: 0.45 },
        ].map((t) => (
          <group key={t.w}>
            <mesh position={[0, t.y, 0]} material={MAT.navy}>
              <boxGeometry args={[t.w, t.h, t.d]} />
            </mesh>
            <mesh position={[0, t.y + t.h / 2, t.d / 2]} material={MAT.goldLight}>
              <boxGeometry args={[t.w, 0.03, 0.03]} />
            </mesh>
          </group>
        ))}
      </group>
      <LogoSign position={new THREE.Vector3(0, SCREEN_POS.y + SCREEN_SIZE.h / 2 + 1.25, SCREEN_POS.z - 0.3)} scale={0.36} />
      <LogoSign position={new THREE.Vector3(-12.8, 6.4, -10.6)} rotationY={0.75} scale={0.55} />
      <LogoSign position={new THREE.Vector3(12.8, 6.4, -10.6)} rotationY={-0.75} scale={0.55} />

      {/* mur de fond incurvé, colonnes LED et rampes dorées */}
      <mesh position={[0, 7, 1]} material={MAT.wall}>
        <cylinderGeometry args={[20, 20, 16, 96, 1, true, THREE.MathUtils.degToRad(90), THREE.MathUtils.degToRad(180)]} />
      </mesh>
      {wallBars.map((b, i) => (
        <group key={i} position={[b.x, 0, b.z]} rotation={[0, b.ry, 0]}>
          <mesh position={[0, 6.2, 0]} material={MAT.wallPanel}>
            <boxGeometry args={[1.1, 11.5, 0.2]} />
          </mesh>
          <mesh position={[0, 6.2, 0.12]} material={b.bright ? MAT.blueLight : MAT.blueSoft}>
            <boxGeometry args={[b.bright ? 0.16 : 0.08, 11, 0.04]} />
          </mesh>
        </group>
      ))}
      {[1.1, 12.2].map((y) => (
        <mesh key={y} position={[0, y, 1]} rotation={[-Math.PI / 2, 0, 0]} material={MAT.goldLight}>
          <torusGeometry args={[19.1, 0.05, 8, 160, Math.PI]} />
        </mesh>
      ))}
      {/* projecteurs au plafond */}
      {spots.map((p, i) => (
        <group key={i} position={p}>
          <mesh material={MAT.navy}>
            <cylinderGeometry args={[0.28, 0.34, 0.4, 16]} />
          </mesh>
          <mesh position={[0, -0.21, 0]} rotation={[Math.PI / 2, 0, 0]} material={MAT.warmLight}>
            <circleGeometry args={[0.24, 20]} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 12.95, 1]} rotation={[-Math.PI / 2, 0, 0]} material={MAT.gold}>
        <torusGeometry args={[17.5, 0.12, 8, 160, Math.PI]} />
      </mesh>

      <Crowd />
    </group>
  );
}

function CrownEmblem() {
  const tex = useCanvasTexture(
    512,
    512,
    () => `crown|${fontsVersion}`,
    (ctx) => {
      ctx.clearRect(0, 0, 512, 512);
      const rg = ctx.createRadialGradient(256, 256, 20, 256, 256, 250);
      rg.addColorStop(0, "#1a2560");
      rg.addColorStop(1, "#070a1c");
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.arc(256, 256, 250, 0, Math.PI * 2);
      ctx.fill();
      for (const [r, col, lw] of [
        [236, "#e0a52a", 10],
        [180, "#5aa8ff", 4],
      ] as const) {
        ctx.beginPath();
        ctx.arc(256, 256, r, 0, Math.PI * 2);
        ctx.strokeStyle = col;
        ctx.lineWidth = lw;
        ctx.stroke();
      }
      drawCrown(ctx, 256, 330, 250, 170);
    },
  );
  return (
    <mesh position={[0, 0.425, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[1.42, 72]} />
      <meshBasicMaterial map={tex} color={[0.85, 0.85, 0.85]} toneMapped={false} />
    </mesh>
  );
}
