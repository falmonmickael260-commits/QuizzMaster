// Roue BONUS / MALUS : chaque case indique l'effet ET à qui il s'applique.
// Les effets « de manche » durent toute la manche suivante (5 questions).

export type WheelEffectKind =
  | "bonus_points" // +N pour moi
  | "double_points" // points x2 pour moi pendant la manche suivante
  | "extra_time" // +N s pour moi pendant la manche suivante
  | "shield" // bloque le prochain malus reçu
  | "underdog_boost" // +N au dernier du classement (coup de pouce)
  | "malus_points" // -N à un joueur choisi
  | "malus_time" // -N s à un joueur choisi pendant la manche suivante
  | "half_points" // points /2 pour un joueur choisi pendant la manche suivante
  | "steal_points"; // vol de N à un joueur choisi

export type WheelTone = "bonus" | "malus" | "steal" | "special";

export interface WheelSegment {
  id: string;
  kind: WheelEffectKind;
  value: number;
  label: string; // texte court sur la roue
  line2: string; // « POUR MOI » / « À UN JOUEUR »...
  tone: WheelTone;
  needsTarget: boolean;
}

export const WHEEL_SEGMENTS: WheelSegment[] = [
  { id: "plus500", kind: "bonus_points", value: 500, label: "+500", line2: "POUR MOI", tone: "bonus", needsTarget: false },
  { id: "malus300", kind: "malus_points", value: 300, label: "-300", line2: "À UN JOUEUR", tone: "malus", needsTarget: true },
  { id: "double", kind: "double_points", value: 2, label: "POINTS x2", line2: "POUR MOI", tone: "bonus", needsTarget: false },
  { id: "steal300", kind: "steal_points", value: 300, label: "VOL 300", line2: "À UN JOUEUR", tone: "steal", needsTarget: true },
  { id: "time5", kind: "extra_time", value: 5, label: "+5 SEC", line2: "POUR MOI", tone: "bonus", needsTarget: false },
  { id: "timeMinus3", kind: "malus_time", value: 3, label: "-3 SEC", line2: "À UN JOUEUR", tone: "malus", needsTarget: true },
  { id: "shield", kind: "shield", value: 1, label: "BOUCLIER", line2: "POUR MOI", tone: "bonus", needsTarget: false },
  { id: "half", kind: "half_points", value: 0.5, label: "DEMI-POINTS", line2: "À UN JOUEUR", tone: "malus", needsTarget: true },
  { id: "underdog", kind: "underdog_boost", value: 400, label: "+400", line2: "AU DERNIER", tone: "special", needsTarget: false },
  { id: "plus250", kind: "bonus_points", value: 250, label: "+250", line2: "POUR MOI", tone: "bonus", needsTarget: false },
];

export const WHEEL_TONE_COLORS: Record<WheelTone, { bg: string; bg2: string; text: string }> = {
  bonus: { bg: "#10b981", bg2: "#065f46", text: "#ffffff" },
  malus: { bg: "#ff3b5c", bg2: "#7f1026", text: "#ffffff" },
  steal: { bg: "#a855f7", bg2: "#4c1d95", text: "#ffffff" },
  special: { bg: "#ffb703", bg2: "#8a5a00", text: "#1a1200" },
};

export function segmentFullLabel(s: WheelSegment): string {
  return `${s.label} ${s.line2}`;
}
