"use client";

import { REVEAL_LOCK_MS } from "@shared/config";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { PublicRoomState } from "@shared/types";
import { HOST_POS, SCREEN_POS, WHEEL_CENTER_Y, WHEEL_POS, seatCamera } from "@/lib/layout";
import { serverNow } from "@/lib/net";

interface Shot {
  pos: THREE.Vector3;
  target: THREE.Vector3;
  fov: number;
  /** vitesse de transition (plus grand = plus rapide) */
  speed?: number;
}

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

// ─── Caméras du plateau ──────────────────────────────────────────────────────
export const CAMERAS = {
  plateau: (): Shot => ({ pos: V(0, 7.2, 20.5), target: V(0, 2.9, -1.2), fov: 42 }),
  // pendant la question : grand écran + candidats + animateur dans le même plan
  plateauClose: (t: number): Shot => ({ pos: V(Math.sin(t * 0.00012) * 1.4, 6.4, 17.5), target: V(0, 3.6, -2.2), fov: 44 }),
  animateur: (): Shot => ({ pos: V(0.5, 2.85, 4.6), target: V(HOST_POS.x, 2.3, HOST_POS.z), fov: 36, speed: 2.2 }),
  question: (): Shot => ({ pos: V(0, 5.6, 5.2), target: V(SCREEN_POS.x, SCREEN_POS.y - 0.25, SCREEN_POS.z), fov: 52, speed: 2.4 }),
  roue: (close: boolean): Shot => {
    const c = V(WHEEL_POS.x, WHEEL_CENTER_Y, WHEEL_POS.z);
    const dir = V(2 - WHEEL_POS.x, 0, 12 - WHEEL_POS.z).normalize();
    return { pos: c.clone().addScaledVector(dir, close ? 6.8 : 9.5).add(V(0, close ? 0.4 : 1.4, 0)), target: c.clone().add(V(close ? 0 : 2.5, close ? 0 : -0.6, 0)), fov: 45, speed: 2 };
  },
  // plan bas sur la rangée de candidats, grand écran visible au-dessus d'eux
  candidats: (t: number, side: number): Shot => ({
    pos: V(side * 4.2 + Math.sin(t * 0.0002) * 0.8, 3.1, 11.5),
    target: V(-side * 1.5, 3.4, -3.5),
    fov: 50,
    speed: 1.4,
  }),
  classement: (): Shot => ({ pos: V(0, 6.6, 9.5), target: V(SCREEN_POS.x, SCREEN_POS.y - 0.6, SCREEN_POS.z), fov: 52 }),
  joueur: (seat: number): Shot => {
    const c = seatCamera(seat);
    return { pos: c.pos, target: c.target, fov: 40, speed: 2.4 };
  },
  // mouvements de grue limités à l'avant du plateau (jamais derrière le décor)
  crane: (t: number): Shot => {
    const a = Math.sin(t * 0.00016) * 1.05;
    return { pos: V(Math.sin(a) * 19, 8.5 + Math.sin(t * 0.00013) * 1.8, 1.2 + Math.cos(a) * 19), target: V(0, 2.8, -1.5), fov: 45, speed: 1 };
  },
  finale: (t: number): Shot => {
    const a = Math.sin(t * 0.00014) * 0.6;
    return { pos: V(Math.sin(a) * 16, 5.8 + Math.sin(t * 0.0003) * 1.5, 1.2 + Math.cos(a) * 16), target: V(0, 3, -1.5), fov: 48, speed: 1.2 };
  },
};

function directShot(s: PublicRoomState | null, now: number, mySeat: number | null): Shot {
  if (!s) return CAMERAS.crane(now);
  const t = now - s.phaseStartedAt;
  const seatOf = (id: string | null | undefined) => s.players.find((p) => p.id === id)?.seat ?? null;
  switch (s.phase) {
    case "lobby":
      return Math.floor(now / 9000) % 2 ? CAMERAS.plateau() : CAMERAS.crane(now);
    case "intro":
      if (t < 2600) return { ...CAMERAS.crane(now), speed: 0.8 };
      if (t < 4600) return CAMERAS.animateur();
      return CAMERAS.question();
    case "round_intro":
      return t < 1800 ? CAMERAS.animateur() : CAMERAS.question();
    case "question": {
      if (!s.question?.text) return CAMERAS.animateur();
      const sinceStart = now - s.question.startsAt;
      if (sinceStart < 2600) return CAMERAS.question();
      // alternance plateau / candidats, jamais plus de ~4 s sur le même plan
      const cut = Math.floor((sinceStart - 2600) / 4200);
      if (cut % 3 === 1) return CAMERAS.candidats(now, cut % 2 ? 1 : -1);
      return CAMERAS.plateauClose(now);
    }
    case "reveal": {
      if (t < REVEAL_LOCK_MS + 2600) return CAMERAS.question();
      // plan rapproché sur le meilleur coup (SOLO réussi), sinon sur soi
      const r = s.reveal?.results ?? {};
      const star = s.players.find((p) => r[p.id]?.correct && r[p.id]?.mode === "solo") ?? s.players.find((p) => r[p.id]?.correct);
      const focus = star?.seat ?? mySeat;
      if (t < REVEAL_LOCK_MS + 5600 && focus !== null && focus !== undefined) return CAMERAS.joueur(focus);
      return CAMERAS.plateau();
    }
    case "leaderboard": {
      if (t < 4300) return CAMERAS.classement();
      const lead = seatOf(s.ranking[0]?.playerId);
      return lead !== null ? CAMERAS.joueur(lead) : CAMERAS.plateau();
    }
    case "wheel": {
      const w = s.wheel;
      if (!w) return CAMERAS.plateau();
      if (w.stage === "intro") return t < 1600 ? CAMERAS.joueur(seatOf(w.spinnerId) ?? 0) : CAMERAS.roue(false);
      if (w.stage === "waiting_spin") return CAMERAS.roue(false);
      if (w.stage === "spinning") return CAMERAS.roue(true);
      if (w.stage === "choose_target") return CAMERAS.plateau();
      if (w.stage === "result") {
        const target = w.outcome?.affectedIds[0];
        const seat = seatOf(target ?? w.spinnerId);
        return seat !== null ? CAMERAS.joueur(seat) : CAMERAS.plateau();
      }
      return CAMERAS.plateau();
    }
    case "final": {
      if (t < 3200) return CAMERAS.classement();
      const winner = seatOf(s.ranking[0]?.playerId);
      const cycle = (t - 3200) % 16000;
      if (cycle < 5000 && winner !== null) return CAMERAS.joueur(winner);
      return CAMERAS.finale(now);
    }
  }
  return CAMERAS.plateau();
}

/** Réalisateur : choisit automatiquement la caméra selon la phase et adapte le cadrage à l'écran (mobile). */
export function CameraDirector({ state, mySeat, override }: { state: PublicRoomState | null; mySeat: number | null; override?: Shot | null }) {
  const { camera, size } = useThree();
  const curPos = useRef(new THREE.Vector3(0, 9, 26));
  const curTarget = useRef(new THREE.Vector3(0, 3, -2));
  const curFov = useRef(45);
  const stateRef = useRef(state);
  stateRef.current = state;
  useEffect(() => {
    camera.layers.enable(1); // effets (confettis) rendus hors réflexion du sol
  }, [camera]);

  useFrame((_, dt) => {
    const shot = override ?? directShot(stateRef.current, serverNow(), mySeat);
    const aspect = size.width / size.height;
    let pos = shot.pos.clone();
    let fov = shot.fov;
    let target = shot.target;
    // Écrans étroits (smartphone portrait) : on recule et on élargit pour garder le plateau lisible,
    // et on vise plus bas pour que la scène reste au-dessus de l'écran du pupitre (console en bas).
    if (aspect < 1.5) {
      const f = Math.min(2.1, 1.5 / aspect);
      const off = pos.clone().sub(shot.target);
      pos = shot.target.clone().add(off.multiplyScalar(0.55 + 0.45 * f));
      fov = Math.min(70, fov * (0.85 + 0.25 * f));
      if (aspect < 0.9) target = shot.target.clone().add(V(0, -Math.min(4.5, off.length() * 0.14) * (0.9 - aspect) * 2.4, 0));
    }
    const k = 1 - Math.exp(-dt * (shot.speed ?? 1.6));
    curPos.current.lerp(pos, k);
    curTarget.current.lerp(target, k);
    curFov.current += (fov - curFov.current) * k;
    // légère respiration « caméra à l'épaule »
    const tt = performance.now() / 1000;
    camera.position.set(curPos.current.x + Math.sin(tt * 0.7) * 0.04, curPos.current.y + Math.sin(tt * 0.9) * 0.03, curPos.current.z);
    camera.lookAt(curTarget.current);
    const cam = camera as THREE.PerspectiveCamera;
    if (Math.abs(cam.fov - curFov.current) > 0.01) {
      cam.fov = curFov.current;
      cam.updateProjectionMatrix();
    }
  });
  return null;
}
