"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import type { CharacterPreset } from "@shared/characters";
import { Character } from "../stage/Character";

function Turntable({ preset }: { preset: CharacterPreset }) {
  const g = useRef<THREE.Group>(null);
  useFrame((st) => {
    if (g.current) g.current.rotation.y = Math.sin(st.clock.elapsedTime * 0.6) * 0.5;
  });
  return (
    <group ref={g} position={[0, -1.35, 0]}>
      <Character preset={preset} mood="wave" lookAt={null} seed={1} />
    </group>
  );
}

/** Aperçu 3D du personnage choisi, sur son socle lumineux. */
export function CharacterPreview({ preset, distance = 4.2 }: { preset: CharacterPreset; distance?: number }) {
  return (
    <Canvas dpr={[1, 1.5]} camera={{ position: [0, 0.9, distance], fov: 32 }} gl={{ antialias: true, alpha: true }}>
      <ambientLight intensity={0.6} color="#8090ff" />
      <directionalLight position={[2, 4, 5]} intensity={2.2} />
      <pointLight position={[-3, 2, 1]} intensity={20} color="#29e7ff" />
      <pointLight position={[3, 2, 1]} intensity={20} color="#ff2e63" />
      <Turntable preset={preset} />
    </Canvas>
  );
}
