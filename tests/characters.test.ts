import { describe, expect, it } from "vitest";
import { ACCESSORY_COLORS, CHARACTERS, HAIR_COLORS, OUTFIT_COLORS, SKIN_TONES, encodeLook, getCharacter, isValidCharacter, lookOf } from "../shared/characters";

describe("personnalisation des personnages", () => {
  it("un preset reste valide et inchangé", () => {
    expect(isValidCharacter("nova")).toBe(true);
    expect(getCharacter("nova")).toEqual(CHARACTERS[0]);
  });

  it("aller-retour : apparence → code → personnage", () => {
    const look = { ...lookOf("hugo"), hairStyle: "afro" as const, hair: 7, skin: 6, outfit: 11, accessory: "headphones" as const, accessoryColor: 3 };
    const code = encodeLook(look);
    expect(isValidCharacter(code)).toBe(true);
    const p = getCharacter(code);
    expect(p.hairStyle).toBe("afro");
    expect(p.hair).toBe(HAIR_COLORS[7]);
    expect(p.skin).toBe(SKIN_TONES[6]);
    expect(p.outfit).toBe(OUTFIT_COLORS[11]);
    expect(p.accessory).toBe("headphones");
    expect(p.accessoryColor).toBe(ACCESSORY_COLORS[3]);
    expect(lookOf(code)).toEqual(look);
  });

  it("refuse les codes invalides ou trafiqués", () => {
    for (const bad of ["c-inconnu-0-0-0-0-0-0", "c-nova-9-0-0-0-0-0", "c-nova-0-99-0-0-0-0", "c-nova-0-0-0-0-9-0", "<script>", "", 42, null, "c-nova-0-0-0-0-0-0-0"]) {
      expect(isValidCharacter(bad)).toBe(false);
    }
    expect(getCharacter("c-nova-9-0-0-0-0-0")).toEqual(CHARACTERS[0]);
  });
});

describe("personnages modélisés", () => {
  it("accepte les codes q- valides et refuse les autres", async () => {
    const { CHARACTER_MODELS, encodeModel, modelOf } = await import("../shared/characters");
    const code = encodeModel(CHARACTER_MODELS.length - 1, OUTFIT_COLORS.length);
    expect(isValidCharacter(code)).toBe(true);
    expect(modelOf(code)).toEqual({ model: CHARACTER_MODELS.length - 1, color: OUTFIT_COLORS.length });
    for (const bad of [`q-${CHARACTER_MODELS.length}-0`, `q-0-${OUTFIT_COLORS.length + 1}`, "q-a-1", "q-1"]) expect(isValidCharacter(bad)).toBe(false);
    // les anciens personnages restent affichables
    expect(modelOf("nova").model).toBeGreaterThanOrEqual(0);
  });
});
