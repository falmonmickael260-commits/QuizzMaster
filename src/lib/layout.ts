// Géométrie du plateau BLIND QUIZZ (unités ≈ mètres). Tout est fixe : les pupitres ne bougent jamais.
//
//   Vue de dessus (la caméra principale est en bas, côté public) :
//
//                 [ GRAND ÉCRAN ]
//      ROUE                               CLASSEMENT
//            C4  C3                C3  C4
//         C2        (animateur)        C2
//       C1                                C1        ← candidats en « U » ouvert vers le public
//                  ( logo au sol )
//                    — public —

import * as THREE from "three";

export const STAGE_CENTER = new THREE.Vector3(0, 0, 1.2);
export const HOST_POS = new THREE.Vector3(0, 0, -0.7);
export const SCREEN_POS = new THREE.Vector3(0, 5.9, -8.8);
export const SCREEN_SIZE = { w: 12, h: 6.75 };
export const WHEEL_POS = new THREE.Vector3(-10.8, 0, -5.4);
export const WHEEL_RADIUS = 2.3;
export const WHEEL_CENTER_Y = 3.55;
export const PANEL_POS = new THREE.Vector3(10.6, 4.4, -5.2);
/** Centre de l'arc des candidats : ils sont tous tournés vers ce point (vers l'avant du plateau). */
export const FACE_POINT = new THREE.Vector3(0, 0, 8.6);

const ARC_RADIUS = 10.4;
/** Ordre de remplissage : d'abord les places autour de l'animateur, puis vers l'extérieur, alternées gauche/droite. */
const SEAT_ANGLES_DEG = [-16.5, 16.5, -29, 29, -41.5, 41.5, -54, 54];

export interface Seat {
  index: number;
  position: THREE.Vector3;
  rotationY: number;
}

export const SEATS: Seat[] = SEAT_ANGLES_DEG.map((deg, index) => {
  const a = THREE.MathUtils.degToRad(deg);
  const position = new THREE.Vector3(FACE_POINT.x + Math.sin(a) * ARC_RADIUS, 0, FACE_POINT.z - Math.cos(a) * ARC_RADIUS);
  const dir = new THREE.Vector3().subVectors(FACE_POINT, position);
  const rotationY = Math.atan2(dir.x, dir.z);
  return { index, position, rotationY };
});

const UP = new THREE.Vector3(0, 1, 0);

function local(seat: number, x: number, y: number, z: number) {
  const s = SEATS[seat] ?? SEATS[0];
  return new THREE.Vector3(x, y, z).applyAxisAngle(UP, s.rotationY).add(s.position);
}

/** Position de la tête du candidat d'un siège (monde). */
export function seatHead(seat: number): THREE.Vector3 {
  return local(seat, 0, 2.3, -0.62);
}

/** L'écran incliné du pupitre, que le candidat regarde pendant la question. */
export function seatScreen(seat: number): THREE.Vector3 {
  return local(seat, 0, 1.45, 0.1);
}

/** Point devant un siège, pour une caméra « JOUEUR ». */
export function seatCamera(seat: number, distance = 5.6, height = 2.9): { pos: THREE.Vector3; target: THREE.Vector3 } {
  // cadre de la tête jusqu'à la façade du pupitre (pseudo + score), voisins hors du premier plan
  const head = seatHead(seat);
  const pos = local(seat, 0.2, height, -0.62 + distance);
  return { pos, target: head.clone().add(new THREE.Vector3(0, -1.05, 0)) };
}

export const PLAYER_COLORS = ["#29e7ff", "#ff2e63", "#ffb800", "#2ee59d", "#a66cff", "#ff7a1c", "#3a86ff", "#ff66c4"];
