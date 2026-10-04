// « Moment star » : pendant la révélation, la réalisation met en avant les candidats qui ont réussi en SOLO
// (gros plan caméra, projecteurs braqués sur eux, bandeau doré). Partagé par la caméra, les lumières et l'habillage.
import * as THREE from "three";
import { REVEAL_LOCK_MS } from "@shared/config";
import type { PublicPlayer, PublicRoomState } from "@shared/types";
import { tvSeat, type Seat } from "./layout";

/** Délai après l'affichage de la bonne réponse avant le gros plan. */
const FOCUS_DELAY_MS = 900;
/** Durée du gros plan par candidat. */
const FOCUS_EACH_MS = 2600;
/** Au plus 3 stars montrées tour à tour (la révélation dure 9 s). */
const FOCUS_MAX = 3;

export interface StarFocus {
  player: PublicPlayer;
  place: Seat;
  /** Temps écoulé dans ce gros plan (ms). */
  t: number;
}

/** Place du pupitre d'un candidat sur le plateau (même calcul que l'affichage des pupitres). */
export function seatPlaceOf(s: PublicRoomState, playerId: string): Seat | null {
  const list = [...s.players].sort((a, b) => a.seat - b.seat);
  const order = list.findIndex((p) => p.id === playerId);
  return order < 0 ? null : tvSeat(order, list.length);
}

export function starFocus(s: PublicRoomState | null, now: number): StarFocus | null {
  if (!s || s.phase !== "reveal" || !s.reveal) return null;
  const t = now - s.phaseStartedAt - REVEAL_LOCK_MS - FOCUS_DELAY_MS;
  if (t < 0) return null;
  const r = s.reveal.results;
  const stars = [...s.players].filter((p) => r[p.id]?.correct && r[p.id]?.mode === "solo").sort((a, b) => a.seat - b.seat).slice(0, FOCUS_MAX);
  const i = Math.floor(t / FOCUS_EACH_MS);
  if (!stars.length || i >= stars.length) return null;
  const place = seatPlaceOf(s, stars[i].id);
  return place ? { player: stars[i], place, t: t - i * FOCUS_EACH_MS } : null;
}

const UP = new THREE.Vector3(0, 1, 0);

/** Point en coordonnées locales d'un pupitre (z positif = vers l'avant du pupitre). */
export function placeLocal(place: Seat, x: number, y: number, z: number): THREE.Vector3 {
  return new THREE.Vector3(x, y, z).applyAxisAngle(UP, place.rotationY).add(place.position);
}

/** Tête du candidat installé derrière son pupitre. */
export function placeHead(place: Seat): THREE.Vector3 {
  return placeLocal(place, 0, 2.25, -0.62);
}
