// Personnages 3D procéduraux : chaque preset décrit l'apparence d'un candidat.

export type HairStyle = "short" | "spiky" | "long" | "ponytail" | "curly" | "bun" | "buzz" | "afro" | "bob";
export type Accessory = "none" | "cap" | "glasses" | "beanie" | "headphones" | "roundGlasses" | "headband";

export interface CharacterPreset {
  id: string;
  name: string;
  skin: string;
  hair: string;
  hairStyle: HairStyle;
  outfit: string;
  outfitAccent: string;
  accessory: Accessory;
  accessoryColor: string;
  eyes: string;
}

export const CHARACTERS: CharacterPreset[] = [
  { id: "nova", name: "Nova", skin: "#f2c7a5", hair: "#3b2416", hairStyle: "ponytail", outfit: "#ff4d6d", outfitAccent: "#ffe3e8", accessory: "none", accessoryColor: "#ffffff", eyes: "#3d6b3a" },
  { id: "rocco", name: "Rocco", skin: "#c68a62", hair: "#1b1210", hairStyle: "short", outfit: "#1fb6ff", outfitAccent: "#0a2540", accessory: "cap", accessoryColor: "#ff9f1c", eyes: "#2b1a10" },
  { id: "maya", name: "Maya", skin: "#8d5a3b", hair: "#120c0a", hairStyle: "afro", outfit: "#ffd23f", outfitAccent: "#2a1a00", accessory: "headband", accessoryColor: "#ff3b5c", eyes: "#23150c" },
  { id: "hugo", name: "Hugo", skin: "#f5d0b5", hair: "#c9632d", hairStyle: "spiky", outfit: "#2ee59d", outfitAccent: "#0b3326", accessory: "glasses", accessoryColor: "#16161a", eyes: "#3f6fa8" },
  { id: "yuna", name: "Yuna", skin: "#f0cfa8", hair: "#0d0d12", hairStyle: "bob", outfit: "#9b5de5", outfitAccent: "#f3e8ff", accessory: "headphones", accessoryColor: "#29e7ff", eyes: "#2a1a10" },
  { id: "sam", name: "Sam", skin: "#6b4029", hair: "#0b0908", hairStyle: "buzz", outfit: "#ff7a1c", outfitAccent: "#fff1e0", accessory: "none", accessoryColor: "#ffffff", eyes: "#1f130b" },
  { id: "lily", name: "Lily", skin: "#fbe0cc", hair: "#e8c26a", hairStyle: "long", outfit: "#ff66c4", outfitAccent: "#fff", accessory: "none", accessoryColor: "#ffffff", eyes: "#3a78b8" },
  { id: "karim", name: "Karim", skin: "#b57a52", hair: "#1c120c", hairStyle: "curly", outfit: "#3a86ff", outfitAccent: "#e6f0ff", accessory: "roundGlasses", accessoryColor: "#c9a227", eyes: "#2b1a10" },
  { id: "zoe", name: "Zoé", skin: "#e9b98f", hair: "#7a2e1b", hairStyle: "bun", outfit: "#00c2a8", outfitAccent: "#e0fffa", accessory: "none", accessoryColor: "#ffffff", eyes: "#4a3020" },
  { id: "leo", name: "Léo", skin: "#f3cfae", hair: "#4a3322", hairStyle: "short", outfit: "#e63946", outfitAccent: "#ffffff", accessory: "beanie", accessoryColor: "#29e7ff", eyes: "#40613a" },
  { id: "ines", name: "Inès", skin: "#d6a07a", hair: "#2a1710", hairStyle: "long", outfit: "#7b2cbf", outfitAccent: "#ffd6ff", accessory: "beanie", accessoryColor: "#ff3b5c", eyes: "#2a1a10" },
  { id: "max", name: "Max", skin: "#f7d7bd", hair: "#d9d4c7", hairStyle: "spiky", outfit: "#222831", outfitAccent: "#29e7ff", accessory: "headphones", accessoryColor: "#ff4d6d", eyes: "#5a7fa0" },
];

export const CHARACTER_BY_ID: Record<string, CharacterPreset> = Object.fromEntries(CHARACTERS.map((c) => [c.id, c]));

export function getCharacter(id: string | undefined): CharacterPreset {
  return resolveCharacter(id);
}

// ─── Personnalisation ────────────────────────────────────────────────────────
// Un personnage personnalisé est transmis sous la forme d'un code compact :
//   c-<base>-<coiffure>-<cheveux>-<peau>-<tenue>-<accessoire>-<couleurAccessoire>
// (index dans les palettes ci-dessous). Le serveur n'accepte que des codes valides.

export const SKIN_TONES = ["#fbe0cc", "#f5d0b5", "#f2c7a5", "#e9b98f", "#d6a07a", "#c68a62", "#8d5a3b", "#6b4029"];
export const HAIR_COLORS = ["#0d0d12", "#1b1210", "#3b2416", "#7a2e1b", "#c9632d", "#e8c26a", "#d9d4c7", "#ff66c4", "#29e7ff", "#9b5de5"];
export const OUTFIT_COLORS = ["#ff4d6d", "#1fb6ff", "#ffd23f", "#2ee59d", "#9b5de5", "#ff7a1c", "#ff66c4", "#3a86ff", "#00c2a8", "#e63946", "#7b2cbf", "#222831"];
export const ACCESSORY_COLORS = ["#ffffff", "#16161a", "#ff3b5c", "#29e7ff", "#ff9f1c", "#c9a227", "#2ee59d", "#9b5de5"];
export const HAIR_STYLES: HairStyle[] = ["short", "spiky", "long", "ponytail", "curly", "bun", "buzz", "afro", "bob"];
export const ACCESSORIES: Accessory[] = ["none", "headphones", "cap", "beanie", "glasses", "roundGlasses", "headband"];

export const HAIR_STYLE_LABELS: Record<HairStyle, string> = {
  short: "Courts",
  spiky: "En pics",
  long: "Longs",
  ponytail: "Queue",
  curly: "Bouclés",
  bun: "Chignon",
  buzz: "Rasés",
  afro: "Afro",
  bob: "Carré",
};
export const ACCESSORY_LABELS: Record<Accessory, string> = {
  none: "Aucun",
  headphones: "Casque",
  cap: "Casquette",
  beanie: "Bonnet",
  glasses: "Lunettes",
  roundGlasses: "Lunettes rondes",
  headband: "Bandeau",
};

export interface CharacterLook {
  base: string;
  hairStyle: HairStyle;
  hair: number;
  skin: number;
  outfit: number;
  accessory: Accessory;
  accessoryColor: number;
}

const idx = (list: string[], color: string) => Math.max(0, list.indexOf(color));

/** Apparence modifiable d'un personnage (preset ou code personnalisé). */
export function lookOf(id: string): CharacterLook {
  const p = getCharacter(id);
  const base = parseCustom(id)?.base ?? p.id;
  return {
    base,
    hairStyle: p.hairStyle,
    hair: idx(HAIR_COLORS, p.hair),
    skin: idx(SKIN_TONES, p.skin),
    outfit: idx(OUTFIT_COLORS, p.outfit),
    accessory: p.accessory,
    accessoryColor: idx(ACCESSORY_COLORS, p.accessoryColor),
  };
}

export function encodeLook(l: CharacterLook): string {
  return ["c", l.base, HAIR_STYLES.indexOf(l.hairStyle), l.hair, l.skin, l.outfit, ACCESSORIES.indexOf(l.accessory), l.accessoryColor].join("-");
}

function parseCustom(id: string): CharacterLook | null {
  const m = /^c-([a-z]{2,12})-(\d)-(\d{1,2})-(\d{1,2})-(\d{1,2})-(\d)-(\d{1,2})$/.exec(id);
  if (!m || !CHARACTER_BY_ID[m[1]]) return null;
  const [hs, hair, skin, outfit, acc, accColor] = m.slice(2).map(Number);
  if (!HAIR_STYLES[hs] || hair >= HAIR_COLORS.length || skin >= SKIN_TONES.length || outfit >= OUTFIT_COLORS.length || !ACCESSORIES[acc] || accColor >= ACCESSORY_COLORS.length) return null;
  return { base: m[1], hairStyle: HAIR_STYLES[hs], hair, skin, outfit, accessory: ACCESSORIES[acc], accessoryColor: accColor };
}

/** Accepte un identifiant de preset ou un code de personnage personnalisé valide. */
export function isValidCharacter(id: unknown): id is string {
  return typeof id === "string" && id.length <= 40 && (!!CHARACTER_BY_ID[id] || !!parseCustom(id));
}

function lighten(hex: string, k: number) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (s: number) => Math.round(((n >> s) & 255) + (255 - ((n >> s) & 255)) * k);
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, "0")}`;
}

/** Preset complet d'un personnage (preset d'origine ou personnalisé). */
export function resolveCharacter(id: string | undefined): CharacterPreset {
  const custom = id ? parseCustom(id) : null;
  if (!custom) return (id && CHARACTER_BY_ID[id]) || CHARACTERS[0];
  const base = CHARACTER_BY_ID[custom.base];
  const outfit = OUTFIT_COLORS[custom.outfit];
  return {
    ...base,
    id: id!,
    hairStyle: custom.hairStyle,
    hair: HAIR_COLORS[custom.hair],
    skin: SKIN_TONES[custom.skin],
    outfit,
    outfitAccent: lighten(outfit, 0.82),
    accessory: custom.accessory,
    accessoryColor: ACCESSORY_COLORS[custom.accessoryColor],
  };
}
