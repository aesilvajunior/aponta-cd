import { describe, it, expect } from "vitest";
import { mean, stdDev, computeMetrics } from "../metrics";

describe("mean / stdDev", () => {
  it("lida com lista vazia", () => {
    expect(mean([])).toBe(0);
    expect(stdDev([1])).toBe(0);
  });
  it("calcula média e desvio padrão", () => {
    expect(mean([10, 20, 30])).toBe(20);
    expect(stdDev([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2);
  });
});

describe("computeMetrics", () => {
  const activities = [{ name: "Separação" }, { name: "Recebimento" }];
  const entries = [
    { activity: "Separação", operator_name: "Ana", duration_seconds: 100, shift: "Manhã" },
    { activity: "Separação", operator_name: "Ana", duration_seconds: 300, shift: "Manhã" },
    { activity: "Separação", operator_name: "Bia", duration_seconds: 200, shift: "Tarde" },
    { activity: "Recebimento", operator_name: "Bia", duration_seconds: 1000, shift: "Tarde" },
  ];

  it("média por atividade", () => {
    const m = computeMetrics(entries, activities);
    const sep = m.avgByActivity.find((a) => a.name === "Separação");
    expect(sep).toMatchObject({ media: 200, registros: 3 });
  });

  it("ranking de operadores ordenado pelo total", () => {
    const m = computeMetrics(entries, activities);
    expect(m.opStats.map((o) => o.name)).toEqual(["Bia", "Ana"]);
    expect(m.opStats[0]).toMatchObject({ total: 1200, registros: 2 });
  });

  it("separa por turno", () => {
    const m = computeMetrics(entries, activities);
    expect(m.shiftData.find((s) => s.name === "Manhã").registros).toBe(2);
    expect(m.shiftData.find((s) => s.name === "Tarde").registros).toBe(2);
  });

  it("sem registros não quebra", () => {
    const m = computeMetrics([], activities);
    expect(m.opStats).toEqual([]);
  });
});
