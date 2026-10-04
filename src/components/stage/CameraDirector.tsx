"use client";

import { REVEAL_LOCK_MS } from "@shared/config";

import { useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useRef } from "react";
import * as THREE from "three";
import type { PublicRoomState } from "@shared/types";
import { HOST_POS, SCREEN_POS, SCREEN_SIZE, WHEEL_CENTER_Y, WHEEL_POS, seatCamera, tvSeat } from "@/lib/layout";
import { placeHead, placeLocal, starFocus, type StarFocus } from "@/lib/focus";
import { serverNow } from "@/lib/net";
import { TV_STAGE_CENTER } from "./TvSet";

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
  // gros plan animateur (générique) : cadré à hauteur d'homme, l'écran n'est qu'un fond lumineux
  animateur: (): Shot => ({ pos: V(0.7, 2.45, 4.4), target: V(HOST_POS.x, 2.2, HOST_POS.z), fov: 30, speed: 2.2 }),
  // plan d'annonce : l'animateur au premier plan ET le grand écran entier derrière lui
  annonce: (): Shot => ({ pos: V(0.8, 3.0, 8.2), target: V(0, 4.1, -3), fov: 48, speed: 2 }),
  question: (): Shot => ({ pos: V(0, 5.6, 5.2), target: V(SCREEN_POS.x, SCREEN_POS.y - 0.25, SCREEN_POS.z), fov: 52, speed: 2.4 }),
  roue: (close: boolean): Shot => {
    const c = V(WHEEL_POS.x, WHEEL_CENTER_Y, WHEEL_POS.z);
    const dir = V(2 - WHEEL_POS.x, 0, 12 - WHEEL_POS.z).normalize();
    // roue centrée (pointeur compris) ; en plan large, on aperçoit aussi le plateau à droite
    const right = V(dir.z, 0, -dir.x);
    return {
      pos: c.clone().addScaledVector(dir, close ? 8 : 11).addScaledVector(right, close ? 0 : 1.4).add(V(0, close ? 0.3 : 0.9, 0)),
      target: c.clone().addScaledVector(right, close ? 0 : 1.6).add(V(0, 0.15, 0)),
      fov: 42,
      speed: 2,
    };
  },
  // plan bas sur la rangée de candidats, grand écran visible au-dessus d'eux
  candidats: (t: number, side: number): Shot => ({
    pos: V(side * 3 + Math.sin(t * 0.0002) * 0.8, 3.1, 12),
    target: V(-side * 1.5, 3.4, -3.5),
    fov: 50,
    speed: 1.4,
  }),
  classement: (): Shot => ({ pos: V(0, 6.6, 9.5), target: V(SCREEN_POS.x, SCREEN_POS.y - 0.6, SCREEN_POS.z), fov: 52 }),
  joueur: (seat: number): Shot => {
    const c = seatCamera(seat);
    return { pos: c.pos, target: c.target, fov: 39, speed: 2.4 };
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
      return t < 1800 ? CAMERAS.annonce() : CAMERAS.question();
    case "question": {
      if (!s.question?.text) return CAMERAS.annonce();
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

// ─── Plan de la partie : cadrage calculé pour que tous les pupitres restent visibles ─────
/** Points à garder dans l'image : chaque pupitre (candidat compris), le grand écran et l'avant de la scène. */
function framePoints(count: number): THREE.Vector3[] {
  const n = Math.max(2, count);
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i < n; i++) {
    const p = tvSeat(i, n).position;
    for (const dx of [-1, 1]) pts.push(p.clone().add(V(dx * 1.1, 0, 1)), p.clone().add(V(dx * 0.9, 3.1, -0.6)));
  }
  // logo couronné au-dessus du grand écran
  pts.push(V(SCREEN_POS.x, SCREEN_POS.y + SCREEN_SIZE.h / 2 + 2.1, SCREEN_POS.z - 0.3));
  for (const sx of [-1, 1]) {
    pts.push(V(SCREEN_POS.x + sx * (SCREEN_SIZE.w / 2 + 0.7), SCREEN_POS.y + SCREEN_SIZE.h / 2 + 0.6, SCREEN_POS.z));
    pts.push(V(sx * 2.5, 0, TV_STAGE_CENTER.z + 3.6));
  }
  return pts;
}

const fitCam = new THREE.PerspectiveCamera();
const tmp = new THREE.Vector3();

/**
 * Cherche la position de caméra (direction imposée) qui fait tenir tous les points dans la zone
 * libre de l'écran, entre le bandeau du haut et l'habillage du bas.
 */
function fitShot(pts: THREE.Vector3[], aspect: number, fov: number, elev: number, yaw: number, safeTop: number, safeBottom: number): Shot {
  const dir = V(Math.sin(yaw) * Math.cos(elev), Math.sin(elev), Math.cos(yaw) * Math.cos(elev));
  const box = new THREE.Box3().setFromPoints(pts);
  const target = box.getCenter(new THREE.Vector3());
  fitCam.fov = fov;
  fitCam.aspect = aspect;
  fitCam.near = 0.1;
  fitCam.far = 200;
  fitCam.updateProjectionMatrix();
  const xMin = -0.95, xMax = 0.95;
  const yMax = 1 - 2 * safeTop, yMin = -1 + 2 * safeBottom;
  const bounds = (d: number) => {
    fitCam.position.copy(target).addScaledVector(dir, d);
    fitCam.lookAt(target);
    fitCam.updateMatrixWorld();
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const p of pts) {
      tmp.copy(p).project(fitCam);
      x0 = Math.min(x0, tmp.x);
      x1 = Math.max(x1, tmp.x);
      y0 = Math.min(y0, tmp.y);
      y1 = Math.max(y1, tmp.y);
    }
    return { x0, x1, y0, y1 };
  };
  let d = 20;
  for (let pass = 0; pass < 4; pass++) {
    let lo = 4, hi = 120;
    for (let i = 0; i < 22; i++) {
      const mid = (lo + hi) / 2;
      const b = bounds(mid);
      if (b.x1 - b.x0 <= xMax - xMin && b.y1 - b.y0 <= yMax - yMin) hi = mid;
      else lo = mid;
    }
    d = hi;
    // recentre le groupe dans la zone libre
    const b = bounds(d);
    const wy = d * Math.tan(THREE.MathUtils.degToRad(fov / 2));
    const right = V(1, 0, 0).applyQuaternion(fitCam.quaternion);
    const up = V(0, 1, 0).applyQuaternion(fitCam.quaternion);
    target.addScaledVector(right, ((b.x0 + b.x1) / 2 - (xMin + xMax) / 2) * wy * aspect);
    target.addScaledVector(up, ((b.y0 + b.y1) / 2 - (yMin + yMax) / 2) * wy);
  }
  return { pos: target.clone().addScaledVector(dir, d), target, fov, speed: 1.2 };
}

/** Gros plan « star » : face au candidat qui vient de réussir en SOLO, sa tête dans la partie libre de l'écran. */
function starShot(f: StarFocus, aspect: number): Shot {
  const portrait = aspect < 0.9;
  const head = placeHead(f.place);
  // caméra placée à l'intérieur du fer à cheval (côté scène) : aucun voisin entre elle et la star
  const toCenter = V(TV_STAGE_CENTER.x - f.place.position.x, 0, TV_STAGE_CENTER.z + 2.5 - f.place.position.z).normalize();
  const facing = placeLocal(f.place, 0, 0, 1).sub(f.place.position).normalize();
  const dir = toCenter.add(facing.multiplyScalar(0.7)).normalize();
  // léger travelling avant pendant le plan
  const push = Math.min(1, f.t / 2600) * 0.6;
  const dist = (portrait ? 7.4 : 8.2) - push;
  const pos = head.clone().addScaledVector(dir, dist).add(V(0, portrait ? 1.3 : 0.9, 0));
  // tête dans la partie haute, au-dessus de l'habillage du bas
  const target = head.clone().add(V(0, portrait ? -1.45 : -0.95, 0));
  return { pos, target, fov: portrait ? 44 : 32, speed: 3 };
}

/**
 * Hauteur (fraction de l'écran) occupée par l'habillage en haut et en bas. Au sein d'une même phase la réserve du bas
 * ne fait que grandir (le cadre ne saute pas pendant qu'on répond) ; à chaque phase, la caméra se recadre.
 */
function useSafeArea(group: () => string) {
  const safe = useRef({ top: 0.1, bottom: 0.2, w: 0, h: 0, group: "" });
  useEffect(() => {
    const measure = () => {
      const h = window.innerHeight;
      const g = group();
      if (safe.current.w !== window.innerWidth || safe.current.h !== h || safe.current.group !== g) safe.current = { top: 0.1, bottom: 0.12, w: window.innerWidth, h, group: g };
      let bottom = 0;
      document.querySelectorAll<HTMLElement>(".tv-panel, .tv-bottom, .tv-side, .final-panel").forEach((el) => {
        const r = el.getBoundingClientRect();
        // le panneau latéral d'aide (écran large) reste sur le côté : il ne compte que s'il s'étale en largeur
        if (r.height > 0 && (!el.classList.contains("tv-side") || r.width > window.innerWidth * 0.5)) bottom = Math.max(bottom, h - r.top);
      });
      let top = 0;
      document.querySelectorAll<HTMLElement>(".hud-top").forEach((el) => {
        const r = el.getBoundingClientRect();
        top = Math.max(top, r.bottom * 0.6);
      });
      safe.current.bottom = Math.min(window.innerWidth > h ? 0.55 : 0.45, Math.max(safe.current.bottom, bottom / h + 0.015));
      safe.current.top = Math.min(0.2, Math.max(0.03, top / h));
    };
    measure();
    const id = setInterval(measure, 400);
    return () => clearInterval(id);
  }, [group]);
  return safe;
}

/** Réalisateur : choisit automatiquement la caméra selon la phase et adapte le cadrage à l'écran (mobile). */
export function CameraDirector({ state, mySeat, override, fixed = false }: { state: PublicRoomState | null; mySeat: number | null; override?: Shot | null; fixed?: boolean }) {
  const { camera, size } = useThree();
  const curPos = useRef(new THREE.Vector3(0, 9, 26));
  const curTarget = useRef(new THREE.Vector3(0, 3, -2));
  const curFov = useRef(45);
  const stateRef = useRef(state);
  stateRef.current = state;
  const phaseGroup = useCallback(() => {
    const s = stateRef.current;
    return s ? `${s.phase}|${s.phase === "wheel" ? s.wheel?.stage : ""}` : "";
  }, []);
  const safe = useSafeArea(phaseGroup);
  const fitCache = useRef<{ key: string; at: number; shot: Shot } | null>(null);
  useEffect(() => {
    camera.layers.enable(1); // effets (confettis) rendus hors réflexion du sol
  }, [camera]);

  useFrame((_, dt) => {
    const aspect0 = size.width / size.height;
    if (fixed && !override) {
      // plan de partie : tout le plateau et tous les candidats, avec un lent mouvement de grue
      const now = performance.now();
      const count = stateRef.current?.players.length ?? 4;
      const portrait = aspect0 < 0.9;
      const yaw = Math.sin(now * 0.00011) * 0.07;
      const elev = (portrait ? 0.64 : 0.34) + Math.sin(now * 0.00007) * 0.025;
      const key = `${count}|${size.width}x${size.height}|${safe.current.top.toFixed(3)}|${safe.current.bottom.toFixed(3)}`;
      const c = fitCache.current;
      if (!c || c.key !== key || now - c.at > 120) {
        fitCache.current = { key, at: now, shot: fitShot(framePoints(count), aspect0, portrait ? 52 : 38, elev, yaw, safe.current.top, safe.current.bottom) };
      }
      const star = starFocus(stateRef.current, serverNow());
      const shot = star ? starShot(star, aspect0) : fitCache.current!.shot;
      const k = 1 - Math.exp(-dt * (shot.speed ?? 1.2));
      curPos.current.lerp(shot.pos, k);
      curTarget.current.lerp(shot.target, k);
      curFov.current += (shot.fov - curFov.current) * k;
      camera.position.copy(curPos.current);
      camera.lookAt(curTarget.current);
      const cam = camera as THREE.PerspectiveCamera;
      if (Math.abs(cam.fov - curFov.current) > 0.01) {
        cam.fov = curFov.current;
        cam.updateProjectionMatrix();
      }
      return;
    }
    const shot = override ?? directShot(stateRef.current, serverNow(), mySeat);
    const aspect = size.width / size.height;
    let pos = shot.pos.clone();
    let fov = shot.fov;
    let target = shot.target;
    // Écrans étroits (smartphone portrait) : on recule et on élargit pour garder le plateau lisible,
    // et on vise plus bas pour que la scène reste au-dessus de l'écran du pupitre (console en bas).
    if (aspect < 1.5) {
      // tablette portrait : on recule moins que sur téléphone pour garder un plateau bien présent
      const f = Math.min(aspect > 0.6 ? 1.6 : 2.1, 1.5 / aspect);
      const off = pos.clone().sub(shot.target);
      pos = shot.target.clone().add(off.multiplyScalar(0.55 + 0.45 * f));
      fov = Math.min(70, fov * (0.85 + 0.25 * f));
      // tablettes en portrait (0,6–0,9) : on remonte davantage le plateau, qui sinon flotte au milieu d'un grand vide
      const tablet = aspect > 0.6 && aspect < 0.9 ? 1.4 : 0;
      if (aspect < 0.9) target = shot.target.clone().add(V(0, -Math.min(4.5, off.length() * 0.14) * (0.9 - aspect) * 2.4 - tablet, 0));
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
