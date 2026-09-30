"use client";

// Plateau « QUIZZ MASTER » dessiné à partir du décor fourni (public/decor/plateau.webp).
// Le décor est une image fixe ; par-dessus : lumières animées, écran central des questions,
// nom et score des candidats sur leurs fauteuils, animateur 3D animé et roue bonus / malus.
// Toutes les positions sont exprimées dans le repère de l'image (1671 × 941 px).

import { Canvas } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import * as THREE from "three";
import type { PrivateState, PublicRoomState } from "@shared/types";
import { WHEEL_SEGMENTS, WHEEL_TONE_COLORS } from "@shared/wheel";
import { REVEAL_LOCK_MS } from "@shared/config";
import { centerScreenSig, drawCenterScreen } from "@/lib/centerScreen";
import { formatScore } from "@/lib/draw";
import { hostMood } from "@/lib/mood";
import { PLAYER_COLORS } from "@/lib/layout";
import { serverNow } from "@/lib/net";
import { audio } from "@/lib/audio";
import { Character } from "./Character";
import { HOST_PRESET } from "./SetPieces";
import { Avatar } from "../ui/Avatar";

export const DECOR = { src: "/decor/plateau.webp", w: 1671, h: 941 };

/** Écrans des fauteuils (centre, en px image), dans l'ordre de remplissage : du centre vers l'extérieur. */
const CHAIRS = [
  { x: 613, y: 254 },
  { x: 1060, y: 254 },
  { x: 491, y: 266 },
  { x: 1181, y: 266 },
  { x: 322, y: 286 },
  { x: 1324, y: 286 },
  { x: 192, y: 313 },
  { x: 1476, y: 313 },
];
/** Écran central des questions (devant le portail couronné). */
const SCREEN = { x: 835, y: 136, w: 420, h: 236 };
/** Devant la scène ronde, au centre du plateau : là où se tient l'animateur. */
const HOST = { x: 835, y: 376, h: 150 };

const pct = (v: number, of: number) => `${(v / of) * 100}%`;
const box = (x: number, y: number, w: number, h: number): CSSProperties => ({
  left: pct(x - w / 2, DECOR.w),
  top: pct(y - h / 2, DECOR.h),
  width: pct(w, DECOR.w),
  height: pct(h, DECOR.h),
});

/** Cadre du décor : couvre l'écran comme une image de fond, en gardant le haut du plateau visible sur mobile. */
function useDecorFrame() {
  const [size, setSize] = useState({ w: 1440, h: 900 });
  useEffect(() => {
    const on = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    on();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  const portrait = size.w / size.h < 1;
  if (portrait) {
    // écran vertical : le plateau occupe la moitié haute, sous la carte de manche ; on garde le centre
    const top = 58;
    const scale = Math.max(size.w / DECOR.w, (size.h * 0.5) / DECOR.h);
    const w = DECOR.w * scale;
    return { left: (size.w - w) / 2, top, w, h: DECOR.h * scale, scale };
  }
  const scale = Math.max(size.w / DECOR.w, size.h / DECOR.h);
  const w = DECOR.w * scale;
  const h = DECOR.h * scale;
  return { left: (size.w - w) / 2, top: (size.h - h) / 2, w, h, scale };
}

// ─── Écran central ───────────────────────────────────────────────────────────

function CenterScreen({ state }: { state: PublicRoomState | null }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  useEffect(() => {
    let raf = 0;
    let last = "";
    const loop = () => {
      const c = canvas.current;
      const now = serverNow();
      const sig = centerScreenSig(stateRef.current, now);
      if (c && sig !== last) {
        last = sig;
        const ctx = c.getContext("2d");
        if (ctx) drawCenterScreen(ctx, c.width, c.height, stateRef.current, now);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div className="dec-screen" style={box(SCREEN.x, SCREEN.y, SCREEN.w, SCREEN.h)}>
      <canvas ref={canvas} width={1280} height={720} />
    </div>
  );
}

// ─── Candidats sur leurs fauteuils ───────────────────────────────────────────

function ChairTags({ state, myId, onSelect }: { state: PublicRoomState | null; myId: string | null; onSelect?: (id: string) => void }) {
  const [now, setNow] = useState(serverNow());
  useEffect(() => {
    const id = setInterval(() => setNow(serverNow()), 250);
    return () => clearInterval(id);
  }, []);
  if (!state) return null;
  const choosing = state.phase === "wheel" && state.wheel?.stage === "choose_target" && state.wheel.spinnerId === myId;
  const locked = state.phase === "reveal" && now - state.phaseStartedAt < REVEAL_LOCK_MS;
  const players = [...state.players].sort((a, b) => a.seat - b.seat).slice(0, CHAIRS.length);
  return (
    <>
      {players.map((p, i) => {
        const c = CHAIRS[i];
        const color = PLAYER_COLORS[p.seat % PLAYER_COLORS.length];
        const res = state.phase === "reveal" && !locked ? state.reveal?.results[p.id] : null;
        const shown = locked ? p.score - (state.reveal?.results[p.id]?.points ?? 0) : p.score;
        const status = res ? (res.correct ? "good" : "bad") : state.phase === "question" && p.answered ? "answered" : "";
        const selectable = choosing && p.id !== myId;
        return (
          <button
            key={p.id}
            className={`dec-tag ${status} ${p.id === myId ? "me" : ""} ${selectable ? "selectable" : ""} ${p.connected ? "" : "offline"}`}
            style={{ ...box(c.x, c.y, 118, 50), ["--pc" as string]: color }}
            disabled={!selectable}
            onClick={() => selectable && onSelect?.(p.id)}
          >
            <Avatar character={p.character} size={40} ring={color} />
            <span className="dec-tag-name">{p.name}</span>
            <span className="dec-tag-score">{formatScore(shown)}</span>
          </button>
        );
      })}
    </>
  );
}

// ─── Animateur 3D (seul personnage animé) ────────────────────────────────────

const LOOK_CAMERA = new THREE.Vector3(0, 1.6, 8);
const LOOK_SCREEN = new THREE.Vector3(1.6, 3.2, -4);

function HostFigure({ state }: { state: PublicRoomState | null }) {
  const { mood } = hostMood(state, serverNow());
  const look = mood === "point" ? LOOK_SCREEN : LOOK_CAMERA;
  return <Character preset={HOST_PRESET} mood={mood} lookAt={look} suit holdCard seed={9.1} />;
}

function HostOverlay({ state }: { state: PublicRoomState | null }) {
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((x) => x + 1), 250);
    return () => clearInterval(id);
  }, []);
  const w = HOST.h * 0.8;
  return (
    <div className="dec-host" style={{ left: pct(HOST.x - w / 2, DECOR.w), top: pct(HOST.y - HOST.h, DECOR.h), width: pct(w, DECOR.w), height: pct(HOST.h * 1.02, DECOR.h) }}>
      <Canvas dpr={[1, 2]} gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }} camera={{ position: [0, 1.25, 6.2], fov: 24 }} onCreated={({ gl, camera }) => {
        gl.setClearColor(0x000000, 0);
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        camera.lookAt(0, 1.15, 0);
      }}>
        <ambientLight intensity={0.8} />
        <hemisphereLight args={["#9fb5ff", "#2a1a08", 0.8]} />
        <directionalLight position={[2, 5, 6]} intensity={2.4} color="#fff0d8" />
        <pointLight position={[-3, 2.5, -2]} intensity={25} distance={10} color="#4f8bff" />
        <pointLight position={[3, 2.5, -2]} intensity={20} distance={10} color="#ffb84a" />
        <HostFigure state={state} />
      </Canvas>
    </div>
  );
}

// ─── Roue bonus / malus (2D) ─────────────────────────────────────────────────

const easeOut = (p: number) => 1 - Math.pow(1 - p, 4);

function WheelOverlay({ state }: { state: PublicRoomState }) {
  const disc = useRef<SVGGElement>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const segs = WHEEL_SEGMENTS.length;
  const segDeg = 360 / segs;
  useEffect(() => {
    let raf = 0;
    let lastSeg = -1;
    const loop = () => {
      const w = stateRef.current.wheel;
      let deg = Math.sin(performance.now() / 900) * 2;
      if (w && w.resultIndex !== null && w.spinStartedAt) {
        const p = Math.min(1, Math.max(0, (serverNow() - w.spinStartedAt) / w.spinDurationMs));
        // même trajectoire que le serveur : la case gagnante finit sous le pointeur
        const final = -(w.resultIndex + 0.5) * segDeg - 360 * w.spinTurns;
        deg = final * easeOut(p);
        const idx = Math.floor(-deg / segDeg);
        if (p > 0 && p < 1 && idx !== lastSeg) audio.wheelClick();
        lastSeg = idx;
      }
      disc.current?.setAttribute("transform", `rotate(${deg} 200 200)`);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [segDeg]);

  const arc = (i: number) => {
    const a0 = ((i * segDeg - 90) * Math.PI) / 180;
    const a1 = (((i + 1) * segDeg - 90) * Math.PI) / 180;
    const r = 180;
    return `M200 200 L${200 + r * Math.cos(a0)} ${200 + r * Math.sin(a0)} A${r} ${r} 0 0 1 ${200 + r * Math.cos(a1)} ${200 + r * Math.sin(a1)} Z`;
  };
  return (
    <div className="dec-wheel">
      <svg viewBox="0 0 400 430">
        <defs>
          <radialGradient id="wh-rim" cx="50%" cy="50%" r="50%">
            <stop offset="0.9" stopColor="#8a5a10" />
            <stop offset="1" stopColor="#ffe08a" />
          </radialGradient>
        </defs>
        <circle cx="200" cy="200" r="196" fill="url(#wh-rim)" />
        <circle cx="200" cy="200" r="186" fill="#0a0e24" />
        <g ref={disc}>
          {WHEEL_SEGMENTS.map((s, i) => {
            const col = WHEEL_TONE_COLORS[s.tone];
            const mid = ((i + 0.5) * segDeg - 90) * (Math.PI / 180);
            return (
              <g key={s.id}>
                <path d={arc(i)} fill={i % 2 ? col.bg2 : col.bg} stroke="#ffe08a" strokeWidth="1.5" />
                <g transform={`translate(${200 + Math.cos(mid) * 118} ${200 + Math.sin(mid) * 118}) rotate(${(i + 0.5) * segDeg})`}>
                  <text textAnchor="middle" y="-2" fill={col.text} fontSize="17" fontWeight="900" fontFamily="Anton, Impact, sans-serif">
                    {s.label}
                  </text>
                  <text textAnchor="middle" y="15" fill={col.text} fontSize="9" fontWeight="800" opacity="0.85">
                    {s.line2}
                  </text>
                </g>
              </g>
            );
          })}
          <circle cx="200" cy="200" r="30" fill="#0a0e24" stroke="#ffe08a" strokeWidth="5" />
        </g>
        {Array.from({ length: 30 }, (_, i) => {
          const a = (i / 30) * Math.PI * 2;
          return <circle key={i} className="dec-bulb" style={{ animationDelay: `${(i % 3) * 0.2}s` }} cx={200 + Math.cos(a) * 191} cy={200 + Math.sin(a) * 191} r="3.4" />;
        })}
        <path d="M200 48 L184 14 L216 14 Z" fill="#ff2e63" stroke="#fff" strokeWidth="3" />
      </svg>
    </div>
  );
}

// ─── Plateau complet ─────────────────────────────────────────────────────────

export default function ImageStage({ state, myId, onSelectTarget }: { state: PublicRoomState | null; priv?: PrivateState | null; myId: string | null; onSelectTarget?: (playerId: string) => void }) {
  const f = useDecorFrame();
  const spots = useMemo(() => [140, 330, 512, 632, 760, 910, 1040, 1160, 1340, 1530].map((x, i) => ({ x, y: i % 2 ? 22 : 8, d: (i * 0.37) % 2.2 })), []);
  return (
    <div className="dec-root" aria-hidden={false} style={{ ["--decor" as string]: `url(${DECOR.src})` }}>
      <div className="dec-backdrop" />
      <div className="dec-frame" style={{ left: f.left, top: f.top, width: f.w, height: f.h, ["--k" as string]: f.scale }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="dec-bg" src={DECOR.src} alt="" draggable={false} />
        {/* lumières animées */}
        <div className="dec-fx dec-sweep" />
        <div className="dec-fx dec-beam left" />
        <div className="dec-fx dec-beam right" />
        <div className="dec-fx dec-ring" style={box(835, 140, 300, 300)} />
        <div className="dec-fx dec-floor" style={box(835, 520, 1200, 420)} />
        {spots.map((s, i) => (
          <div key={i} className="dec-fx dec-spot" style={{ ...box(s.x, s.y, 90, 90), animationDelay: `${s.d}s` }} />
        ))}
        <CenterScreen state={state} />
        <HostOverlay state={state} />
        <ChairTags state={state} myId={myId} onSelect={onSelectTarget} />
      </div>
      {state?.phase === "wheel" && <WheelOverlay state={state} />}
    </div>
  );
}
