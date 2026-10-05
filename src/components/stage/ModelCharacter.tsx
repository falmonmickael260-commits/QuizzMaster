"use client";

// Candidat en 3D à partir d'un modèle animé (packs CC0 de Quaternius) : choix du modèle, couleur de tenue,
// animation selon l'humeur (attente, salut, réflexion, déception).
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { SkeletonUtils } from "three-stdlib";
import { toCreasedNormals } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { CHARACTER_MODELS, OUTFIT_COLORS, modelOf } from "@shared/characters";
import type { Mood } from "./Character";

/** Hauteur des personnages sur le plateau (un peu plus grands que nature pour être bien visibles). */
const HEIGHT = 2.75;

// Les modèles sont « low-poly » (facettes plates) : on recalcule des normales lissées une fois par géométrie
// pour un rendu plus doux (les couleurs sont unies, sans texture, rien n'est perdu).
const smoothed = new WeakMap<THREE.BufferGeometry, THREE.BufferGeometry>();
function smoothGeometry(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const done = smoothed.get(g);
  if (done) return done;
  let out = g;
  try {
    // lissage des facettes mais arêtes vives conservées au-delà de 50° (yeux, cols, chaussures…)
    out = toCreasedNormals(g, THREE.MathUtils.degToRad(50));
  } catch {
    out = g;
  }
  smoothed.set(g, out);
  return out;
}

export function modelUrl(character: string): string {
  return `/models/${CHARACTER_MODELS[modelOf(character).model].file}.glb`;
}

/** Précharge les modèles des candidats présents pour éviter un plateau vide à l'arrivée. */
export function preloadCharacters(characters: string[]) {
  for (const url of new Set(characters.map(modelUrl))) useGLTF.preload(url);
}

// Matériaux de la tenue principale (haut du corps), teintés à la couleur choisie par le joueur.
// Les autres (peau, cheveux, yeux, chaussures) gardent leurs couleurs d'origine.
const SKIP_TINT = /skin|hair|eye|brow|beard|mouth|teeth|face|head|shoe|boot|sole|black|white|metal|glass|button|belt/i;

function clipFor(mood: Mood): { name: string; once?: boolean } {
  switch (mood) {
    case "happy":
    case "ecstatic":
    case "victory":
    case "excited":
    case "clap":
    case "wave":
      return { name: "Wave" };
    case "sad":
    case "shocked":
    case "shrug":
      return { name: "HitRecieve", once: true };
    case "talk":
    case "present":
    case "point":
      return { name: "Interact" };
    case "thinking":
    case "focused":
      return { name: "Idle_Neutral" };
    default:
      return { name: "Idle" };
  }
}

export function ModelCharacter({ character, mood, seed = 0 }: { character: string; mood: Mood; seed?: number }) {
  const { color } = modelOf(character);
  const { scene, animations } = useGLTF(modelUrl(character));

  const { obj, scale, mixer } = useMemo(() => {
    const o = SkeletonUtils.clone(scene) as THREE.Object3D;
    const tint = color > 0 ? new THREE.Color(OUTFIT_COLORS[color - 1]) : null;
    // la tenue principale = le matériau qui couvre le plus de surface hors peau / cheveux
    const weight = new Map<string, number>();
    o.traverse((c) => {
      const m = c as THREE.Mesh;
      if (!m.isMesh) return;
      m.frustumCulled = false;
      m.geometry = smoothGeometry(m.geometry);
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mat of mats) if (!SKIP_TINT.test(mat.name)) weight.set(mat.name, (weight.get(mat.name) ?? 0) + (m.geometry.index?.count ?? 0));
    });
    const main = [...weight.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    o.traverse((c) => {
      const m = c as THREE.Mesh;
      if (!m.isMesh) return;
      const remap = (mat: THREE.Material) => {
        const std = (mat as THREE.MeshStandardMaterial).clone();
        if (tint && std.name === main) {
          std.color.copy(tint);
          if (std.map) std.map = null;
        }
        std.roughness = Math.min(std.roughness ?? 1, 0.7);
        std.flatShading = false;
        return std;
      };
      m.material = Array.isArray(m.material) ? m.material.map(remap) : remap(m.material);
    });
    const box = new THREE.Box3().setFromObject(o);
    const h = Math.max(0.01, box.max.y - box.min.y);
    return { obj: o, scale: HEIGHT / h, mixer: new THREE.AnimationMixer(o) };
  }, [scene, color]);

  const current = useRef<THREE.AnimationAction | null>(null);
  const actions = useMemo(() => Object.fromEntries(animations.map((a) => [a.name, mixer.clipAction(a)])), [animations, mixer]);

  useEffect(() => {
    const { name, once } = clipFor(mood);
    const next = actions[name] ?? actions.Idle ?? Object.values(actions)[0];
    if (!next || next === current.current) return;
    next.reset();
    next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
    next.clampWhenFinished = !!once;
    // les candidats ne bougent pas tous en même temps
    if (!once) next.time = (seed * 0.731) % Math.max(0.1, next.getClip().duration);
    next.fadeIn(0.25).play();
    current.current?.fadeOut(0.25);
    current.current = next;
    if (once) {
      // après la réaction, retour à l'attente
      const back = actions.Idle_Neutral ?? actions.Idle;
      const t = setTimeout(() => {
        if (!back || current.current !== next) return;
        back.reset().fadeIn(0.4).play();
        next.fadeOut(0.4);
        current.current = back;
      }, next.getClip().duration * 1000);
      return () => clearTimeout(t);
    }
  }, [mood, actions, seed]);

  useEffect(() => () => void mixer.stopAllAction(), [mixer]);
  useFrame((_, dt) => mixer.update(Math.min(dt, 0.1)));

  return (
    <group scale={scale}>
      <primitive object={obj} />
    </group>
  );
}
