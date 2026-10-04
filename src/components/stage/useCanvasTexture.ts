"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { serverNow } from "@/lib/net";

// Peu d'envois de textures vers le GPU par frame : les écrans qui changent en même temps
// sont étalés sur les frames suivantes au lieu de provoquer un à-coup. Un écran qui attend depuis
// trop longtemps passe quand même (aucun écran ne reste figé, même sur un appareil lent).
const UPLOADS_PER_FRAME = 2;
const MAX_WAIT_MS = 220;
let uploadFrame = -1;
let uploadsThisFrame = 0;

/**
 * Texture de canvas redessinée uniquement quand sa « signature » change
 * (évite de redessiner les écrans du décor à chaque frame).
 */
export function useCanvasTexture(
  width: number,
  height: number,
  sig: (now: number) => string,
  draw: (ctx: CanvasRenderingContext2D, now: number) => void,
) {
  const { canvas, texture } = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 16; // plafonné automatiquement au maximum de la carte graphique
    texture.generateMipmaps = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    return { canvas, texture };
  }, [width, height]);
  const last = useRef("");
  const waitingSince = useRef(0);
  const drawRef = useRef(draw);
  const sigRef = useRef(sig);
  drawRef.current = draw;
  sigRef.current = sig;

  useEffect(() => () => texture.dispose(), [texture]);

  useFrame((st) => {
    const now = serverNow();
    const s = sigRef.current(now);
    if (s === last.current) {
      waitingSince.current = 0;
      return;
    }
    const t = performance.now();
    if (!waitingSince.current) waitingSince.current = t;
    const frame = st.gl.info.render.frame;
    if (uploadFrame !== frame) {
      uploadFrame = frame;
      uploadsThisFrame = 0;
    }
    const overdue = t - waitingSince.current > MAX_WAIT_MS;
    if (last.current !== "" && uploadsThisFrame >= UPLOADS_PER_FRAME && !overdue) return;
    uploadsThisFrame++;
    waitingSince.current = 0;
    last.current = s;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    drawRef.current(ctx, now);
    texture.needsUpdate = true;
  });

  return texture;
}

/**
 * Teinte des écrans du décor (valeurs linéaires) : le blanc des textes reste juste sous le seuil
 * du halo lumineux, pour des écritures nettes au lieu d'un contour flou.
 */
export const SCREEN_TINT: [number, number, number] = [0.74, 0.74, 0.74];
