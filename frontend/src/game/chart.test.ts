import { describe, expect, it } from "vitest";
import { DIFFICULTIES, generatedChart, type Difficulty } from "./chart";

describe("generatedChart (titres YouTube)", () => {
  it("est reproductible : même titre + même niveau = mêmes notes", () => {
    expect(generatedChart(7, "hard", 120)).toEqual(generatedChart(7, "hard", 120));
  });

  it("change d'un titre à l'autre", () => {
    expect(generatedChart(7, "hard", 120)).not.toEqual(generatedChart(8, "hard", 120));
  });

  it("a plus de notes quand la difficulté monte", () => {
    const count = (d: Difficulty) => generatedChart(42, d, 180).length;
    expect(count("easy")).toBeLessThan(count("normal"));
    expect(count("normal")).toBeLessThan(count("hard"));
  });

  it("laisse un temps de préparation et reste dans la durée du morceau", () => {
    const chart = generatedChart(3, "normal", 90);
    expect(chart[0].time).toBeGreaterThanOrEqual(2.5);
    expect(chart.at(-1)!.time).toBeLessThan(90);
  });

  it("utilise les 4 flèches et des notes triées", () => {
    const chart = generatedChart(5, "normal", 120);
    expect(new Set(chart.map((n) => n.lane))).toEqual(new Set([0, 1, 2, 3]));
    for (let i = 1; i < chart.length; i++) expect(chart[i].time).toBeGreaterThanOrEqual(chart[i - 1].time);
  });

  it("n'a pas d'accords en facile", () => {
    const times = generatedChart(9, "easy", 180).map((n) => n.time);
    expect(new Set(times).size).toBe(times.length);
  });

  it("définit les 3 niveaux, du plus lent au plus rapide", () => {
    expect(DIFFICULTIES.easy.travel).toBeGreaterThan(DIFFICULTIES.normal.travel);
    expect(DIFFICULTIES.normal.travel).toBeGreaterThan(DIFFICULTIES.hard.travel);
  });
});
