"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { serverNow } from "@/lib/net";

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
    texture.anisotropy = 4;
    texture.generateMipmaps = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    return { canvas, texture };
  }, [width, height]);
  const last = useRef("");
  const drawRef = useRef(draw);
  const sigRef = useRef(sig);
  drawRef.current = draw;
  sigRef.current = sig;

  useEffect(() => () => texture.dispose(), [texture]);

  useFrame(() => {
    const now = serverNow();
    const s = sigRef.current(now);
    if (s === last.current) return;
    last.current = s;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    drawRef.current(ctx, now);
    texture.needsUpdate = true;
  });

  return texture;
}
