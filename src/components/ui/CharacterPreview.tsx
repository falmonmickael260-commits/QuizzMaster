"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Suspense, useRef } from "react";
import * as THREE from "three";
import { ModelCharacter } from "../stage/ModelCharacter";

function Turntable({ character }: { character: string }) {
  const g = useRef<THREE.Group>(null);
  useFrame((st) => {
    if (g.current) g.current.rotation.y = Math.sin(st.clock.elapsedTime * 0.6) * 0.5;
  });
  return (
    <group ref={g} position={[0, -1.35, 0]}>
      <Suspense fallback={null}>
        <ModelCharacter character={character} mood="wave" seed={1} />
      </Suspense>
    </group>
  );
}

/** Aperçu 3D du personnage choisi, sur son socle lumineux. */
export function CharacterPreview({ character, distance = 4.2 }: { character: string; distance?: number }) {
  return (
    <Canvas dpr={[1, 1.5]} camera={{ position: [0, 0.9, distance], fov: 32 }} gl={{ antialias: true, alpha: true }}>
      <ambientLight intensity={0.9} color="#a0b0ff" />
      <directionalLight position={[2, 4, 5]} intensity={2.4} />
      <pointLight position={[-3, 2, 1]} intensity={20} color="#29e7ff" />
      <pointLight position={[3, 2, 1]} intensity={20} color="#ff2e63" />
      <Turntable character={character} />
    </Canvas>
  );
}
