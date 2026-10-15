import { describe, expect, it } from "vitest";
import type { Note } from "./chart";
import { Game, grade, WINDOWS } from "./engine";

const notes: Note[] = [
  { time: 1, lane: 0 },
  { time: 2, lane: 1 },
  { time: 3, lane: 2 },
  { time: 4, lane: 3 },
  { time: 5, lane: 0 },
];

describe("Game : jugements", () => {
  it("juge selon l'écart avec la note", () => {
    const game = new Game(notes);
    expect(game.press(0, 1 + WINDOWS.perfect - 0.01)?.judgement).toBe("perfect");
    expect(game.press(1, 2 - 0.08)?.judgement).toBe("great");
    expect(game.press(2, 3 + 0.14)?.judgement).toBe("good");
  });

  it("ignore un appui dans le vide ou sur la mauvaise flèche", () => {
    const game = new Game(notes);
    expect(game.press(3, 0.5)).toBeNull();
    expect(game.press(1, 1)).toBeNull(); // la note de 1 s est sur la flèche 0
    expect(game.stats.counts.miss).toBe(0);
  });

  it("ne compte une note qu'une seule fois", () => {
    const game = new Game(notes);
    expect(game.press(0, 1)).not.toBeNull();
    expect(game.press(0, 1)).toBeNull();
  });

  it("marque comme ratées les notes dépassées et remet le combo à zéro", () => {
    const game = new Game(notes);
    game.press(0, 1);
    game.press(1, 2);
    expect(game.combo).toBe(2);
    expect(game.update(3 + WINDOWS.good + 0.01)).toBe(1);
    expect(game.combo).toBe(0);
    expect(game.stats.maxCombo).toBe(2);
  });
});

describe("Game : score", () => {
  it("donne un bonus de combo plafonné à ×2", () => {
    const many: Note[] = Array.from({ length: 120 }, (_, i) => ({ time: i + 1, lane: 0 }));
    const game = new Game(many);
    many.forEach((n) => game.press(0, n.time));
    // Toutes parfaites : 300 points × (1 + min(combo, 50) / 50)
    const expected = many.reduce((sum, _, i) => sum + Math.round(300 * (1 + Math.min(i + 1, 50) / 50)), 0);
    expect(game.score).toBe(expected);
    expect(game.score).toBeLessThanOrEqual(120 * 300 * 2); // même plafond que le contrôle côté serveur
  });

  it("calcule la précision pondérée", () => {
    const game = new Game(notes);
    game.press(0, 1); // parfait = 1
    game.press(1, 2.08); // super = 0,7
    game.update(Infinity); // 3 ratées = 0
    expect(game.stats.accuracy).toBeCloseTo(1.7 / 5);
  });
});

describe("grade", () => {
  it.each([
    [1, "S"],
    [0.95, "S"],
    [0.9, "A"],
    [0.75, "B"],
    [0.6, "C"],
    [0.2, "D"],
  ])("précision %s → %s", (accuracy, letter) => {
    expect(grade(accuracy)).toBe(letter);
  });
});
