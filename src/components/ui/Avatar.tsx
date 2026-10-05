"use client";

// Portrait d'un candidat (miniature du personnage 3D), avec l'anneau de sa couleur de joueur
// et une pastille de la couleur de tenue choisie.
import { CHARACTER_MODELS, OUTFIT_COLORS, modelOf } from "@shared/characters";

export function Avatar({ character, size = 48, ring }: { character: string; size?: number; ring?: string }) {
  const { model, color } = modelOf(character);
  const m = CHARACTER_MODELS[model];
  return (
    <span className="avatar" style={{ width: size, height: size, boxShadow: ring ? `0 0 0 ${Math.max(2, size * 0.05)}px ${ring}` : undefined }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/models/portraits/${m.file}.png`} alt="" width={size} height={size} loading="lazy" decoding="async" draggable={false} />
      {color > 0 && <i style={{ background: OUTFIT_COLORS[color - 1] }} aria-hidden />}
    </span>
  );
}
