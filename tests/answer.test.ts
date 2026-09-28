import { describe, expect, it } from "vitest";
import { isAnswerCorrect, normalizeAnswer } from "../server/game/answer";

describe("correction des réponses SOLO", () => {
  it("ignore casse, accents, espaces et articles", () => {
    for (const v of ["Rome", "ROME", "rome", "  rome ", "Rôme"]) expect(isAnswerCorrect(v, "Rome")).toBe(true);
    expect(isAnswerCorrect("la tour eiffel", "Tour Eiffel")).toBe(true);
    expect(isAnswerCorrect("L'Oréal", "Loreal")).toBe(true);
    expect(normalizeAnswer("Saint-Étienne")).toBe("saint etienne");
  });

  it("tolère une petite faute de frappe sur les mots longs", () => {
    expect(isAnswerCorrect("Canbera", "Canberra")).toBe(true);
    expect(isAnswerCorrect("Toutankamon", "Toutânkhamon")).toBe(true);
    expect(isAnswerCorrect("Paris", "Rome")).toBe(false);
  });

  it("reste strict sur les nombres, chiffres romains et lettres", () => {
    expect(isAnswerCorrect("Louis XVI", "Louis XIV")).toBe(false);
    expect(isAnswerCorrect("1441", "1 440")).toBe(false);
    expect(isAnswerCorrect("1440", "1 440")).toBe(true);
    expect(isAnswerCorrect("A négatif", "O négatif")).toBe(false);
    expect(isAnswerCorrect("4 °C", "-4 °C")).toBe(false);
  });

  it("accepte les variantes déclarées", () => {
    expect(isAnswerCorrect("huit", "8", ["huit"])).toBe(true);
    expect(isAnswerCorrect("Bonaparte", "Napoléon Bonaparte", ["Napoléon", "Bonaparte"])).toBe(true);
    expect(isAnswerCorrect("", "Rome")).toBe(false);
  });
});
