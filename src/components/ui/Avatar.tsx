"use client";

// Portrait 2D d'un personnage (tête + épaules), fidèle à sa personnalisation :
// teint, coiffure et couleur de cheveux, tenue, accessoire et sa couleur.
import { useId } from "react";
import { getCharacter, type CharacterPreset } from "@shared/characters";

function Hair({ p }: { p: CharacterPreset }) {
  const c = p.hair;
  switch (p.hairStyle) {
    case "buzz":
      return <path d="M31 44c0-14 8-22 19-22s19 8 19 22c-4-6-10-9-19-9s-15 3-19 9z" fill={c} opacity="0.85" />;
    case "spiky":
      return <path d="M29 46l2-14-6-4 9-2 2-9 7 6 7-8 5 8 8-5 1 9 9 1-6 6 3 14c-5-7-11-10-20-10s-16 3-21 9z" fill={c} />;
    case "afro":
      return <circle cx="50" cy="36" r="27" fill={c} />;
    case "curly":
      return (
        <g fill={c}>
          {[
            [32, 38],
            [38, 28],
            [48, 24],
            [58, 26],
            [66, 34],
            [70, 44],
            [30, 48],
          ].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="9" />
          ))}
        </g>
      );
    case "long":
      return <path d="M27 48c0-17 10-27 23-27s23 10 23 27v26c-3-2-6-2-8 0V46c-4-6-9-9-15-9s-11 3-15 9v28c-2-2-5-2-8 0z" fill={c} />;
    case "bob":
      return <path d="M27 50c0-18 10-29 23-29s23 11 23 29v12h-8V48c-4-7-9-10-15-10s-11 3-15 10v14h-8z" fill={c} />;
    case "ponytail":
      return (
        <g fill={c}>
          <path d="M30 46c0-15 9-24 20-24s20 9 20 24c-5-6-12-9-20-9s-15 3-20 9z" />
          <path d="M68 34c9 2 12 12 9 24-2-5-5-8-9-9z" />
        </g>
      );
    case "bun":
      return (
        <g fill={c}>
          <circle cx="50" cy="16" r="8" />
          <path d="M30 46c0-15 9-24 20-24s20 9 20 24c-5-6-12-9-20-9s-15 3-20 9z" />
        </g>
      );
    default:
      return <path d="M30 46c0-15 9-24 20-24s20 9 20 24c-4-5-9-8-15-8-7 0-10 3-14 3s-7-1-11 5z" fill={c} />;
  }
}

function Accessory({ p }: { p: CharacterPreset }) {
  const c = p.accessoryColor;
  switch (p.accessory) {
    case "headphones":
      return (
        <g>
          <path d="M27 48c0-17 10-27 23-27s23 10 23 27" fill="none" stroke={c} strokeWidth="4.5" />
          <rect x="21" y="42" width="10" height="16" rx="5" fill={c} />
          <rect x="69" y="42" width="10" height="16" rx="5" fill={c} />
        </g>
      );
    case "cap":
      return (
        <g fill={c}>
          <path d="M29 40c0-12 9-20 21-20s21 8 21 20z" />
          <path d="M50 38h30c-2 5-8 6-14 6H50z" />
        </g>
      );
    case "beanie":
      return (
        <g fill={c}>
          <path d="M29 42c0-14 9-23 21-23s21 9 21 23z" />
          <rect x="28" y="38" width="44" height="7" rx="3.5" opacity="0.85" />
          <circle cx="50" cy="17" r="4" />
        </g>
      );
    case "headband":
      return <path d="M30 38c5-6 12-9 20-9s15 3 20 9" fill="none" stroke={c} strokeWidth="5" strokeLinecap="round" />;
    case "glasses":
    case "roundGlasses": {
      const r = p.accessory === "roundGlasses";
      return (
        <g fill="rgba(255,255,255,0.15)" stroke={c} strokeWidth="2.4">
          {r ? <circle cx="41" cy="51" r="6.5" /> : <rect x="34" y="46" width="14" height="10" rx="3" />}
          {r ? <circle cx="59" cy="51" r="6.5" /> : <rect x="52" y="46" width="14" height="10" rx="3" />}
          <path d="M48 51h4" fill="none" />
        </g>
      );
    }
    default:
      return null;
  }
}

/** Portrait d'un personnage à partir de son identifiant (preset ou code personnalisé). */
export function Avatar({ character, size = 48, ring }: { character: string; size?: number; ring?: string }) {
  const p = getCharacter(character);
  const clip = useId();
  return (
    <svg className="avatar" width={size} height={size} viewBox="0 0 100 100" aria-hidden>
      <defs>
        <clipPath id={clip}>
          <circle cx="50" cy="50" r="48" />
        </clipPath>
        <radialGradient id={`${clip}-bg`} cx="50%" cy="35%" r="70%">
          <stop offset="0" stopColor="#24357e" />
          <stop offset="1" stopColor="#070b24" />
        </radialGradient>
      </defs>
      <circle cx="50" cy="50" r="48" fill={`url(#${clip}-bg)`} />
      <g clipPath={`url(#${clip})`}>
        {p.hairStyle === "long" && <path d="M27 50h46v34H27z" fill={p.hair} />}
        {/* épaules / tenue */}
        <path d="M14 104c2-20 16-30 36-30s34 10 36 30z" fill={p.outfit} />
        <path d="M42 75h16l-8 10z" fill={p.outfitAccent} opacity="0.9" />
        <rect x="44" y="64" width="12" height="12" rx="4" fill={p.skin} />
        {/* visage */}
        <ellipse cx="50" cy="50" rx="19" ry="21" fill={p.skin} />
        <ellipse cx="31" cy="52" rx="3.5" ry="5" fill={p.skin} />
        <ellipse cx="69" cy="52" rx="3.5" ry="5" fill={p.skin} />
        <Hair p={p} />
        <circle cx="42" cy="52" r="3.4" fill="#fff" />
        <circle cx="58" cy="52" r="3.4" fill="#fff" />
        <circle cx="42.4" cy="52.6" r="2.1" fill={p.eyes} />
        <circle cx="58.4" cy="52.6" r="2.1" fill={p.eyes} />
        <path d="M44 61c4 4 8 4 12 0" fill="none" stroke="#6b2f23" strokeWidth="2.2" strokeLinecap="round" />
        <circle cx="37" cy="59" r="3" fill="#ff7a8a" opacity="0.35" />
        <circle cx="63" cy="59" r="3" fill="#ff7a8a" opacity="0.35" />
        <Accessory p={p} />
      </g>
      {ring && <circle cx="50" cy="50" r="47" fill="none" stroke={ring} strokeWidth="3.5" />}
    </svg>
  );
}
