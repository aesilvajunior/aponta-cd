import { describe, it, expect } from "vitest";
import {
  buildHeatmap, weekdayAverages, forecastNextDays, fairRanking, occupancyByOperator,
  summarizePauses, pausesByOperator,
} from "../analytics";

// 2026-10-10 é sábado; 15:00Z = 12:00 em Brasília
const at = (iso) => ({ start_time: iso });

describe("buildHeatmap (horário local)", () => {
  it("conta por dia da semana e hora locais", () => {
    const { cells, max, total } = buildHeatmap([
      at("2026-10-10T15:00:00Z"), // sáb 12h
      at("2026-10-10T15:30:00Z"), // sáb 12h
      at("2026-10-11T01:30:00Z"), // sáb 22h (UTC já é domingo!)
    ]);
    expect(cells[6][12]).toBe(2);
    expect(cells[6][22]).toBe(1);
    expect(cells[0].every((n) => n === 0)).toBe(true);
    expect(max).toBe(2);
    expect(total).toBe(3);
  });
  it("ignora datas inválidas", () => {
    expect(buildHeatmap([at("lixo")]).total).toBe(0);
  });
});

describe("weekdayAverages / forecastNextDays", () => {
  const entries = [
    // duas segundas: 4 e 2 lançamentos -> média 3
    ...Array(4).fill(at("2026-10-05T15:00:00Z")),
    ...Array(2).fill(at("2026-10-12T15:00:00Z")),
  ];
  it("média só dos dias com movimento", () => {
    const mon = weekdayAverages(entries).find((d) => d.weekday === 1);
    expect(mon.avg).toBe(3);
    expect(mon.days).toBe(2);
  });
  it("prevê pelo mesmo dia da semana", () => {
    // partindo de domingo 18/10 -> o próximo dia (segunda 19/10) deve prever 3
    const next = forecastNextDays(entries, 2, new Date(2026, 9, 18));
    expect(next[0]).toMatchObject({ date: "2026-10-19", label: "Seg", expected: 3 });
  });
});

describe("fairRanking", () => {
  const mk = (code, activity, secs) => ({ operator_code: code, operator_name: code, activity, duration_seconds: secs });
  it("quem pega atividade lenta não é punido", () => {
    const entries = [];
    // Atividade rápida (mediana ~100) e lenta (mediana ~1000)
    for (let i = 0; i < 6; i++) entries.push(mk("A", "rapida", 100), mk("B", "rapida", 100));
    for (let i = 0; i < 6; i++) entries.push(mk("C", "lenta", 1000), mk("D", "lenta", 1000));
    const r = fairRanking(entries);
    // todos na mediana da própria atividade => índice ~1
    r.forEach((o) => expect(o.index).toBeCloseTo(1, 5));
  });
  it("mais rápido que a mediana tem índice > 1", () => {
    const entries = [];
    for (let i = 0; i < 5; i++) entries.push(mk("A", "x", 50), mk("B", "x", 100), mk("C", "x", 200));
    const r = fairRanking(entries);
    expect(r[0].code).toBe("A");
    expect(r[0].index).toBeGreaterThan(1);
    expect(r[r.length - 1].code).toBe("C");
  });
  it("exige mínimo de registros", () => {
    const entries = [mk("A", "x", 10), mk("B", "x", 10), mk("C", "x", 10), mk("A", "x", 10)];
    expect(fairRanking(entries, { minRecords: 5 })).toEqual([]);
  });
});

describe("occupancyByOperator", () => {
  const e = (start, end) => ({ operator_code: "1", operator_name: "Ana", start_time: start, end_time: end });
  it("soma trabalho e espera curta; ignora espera longa (almoço)", () => {
    const r = occupancyByOperator([
      e("2026-10-10T12:00:00Z", "2026-10-10T12:10:00Z"), // 10 min
      e("2026-10-10T12:20:00Z", "2026-10-10T12:30:00Z"), // espera 10 min, trabalho 10
      e("2026-10-10T15:30:00Z", "2026-10-10T15:40:00Z"), // espera de 3h: ignora
    ])[0];
    expect(r.workSeconds).toBe(30 * 60);
    expect(r.idleSeconds).toBe(10 * 60);
    expect(r.occupancy).toBeCloseTo(0.75, 5);
  });
});

describe("pausas", () => {
  const pauses = [
    { reason: "almoco", duration_seconds: 3000, operator_code: "1", operator_name: "Ana" },
    { reason: "almoco", duration_seconds: 1000, operator_code: "2", operator_name: "Bia" },
    { reason: "falta_material", duration_seconds: 600, operator_code: "1", operator_name: "Ana" },
    { reason: null, duration_seconds: null, operator_code: "2", operator_name: "Bia" },
  ];
  it("resume por motivo, do que mais pesa ao que menos", () => {
    const s = summarizePauses(pauses);
    expect(s[0]).toMatchObject({ reason: "almoco", count: 2, seconds: 4000, avgSeconds: 2000 });
    expect(s.find((x) => x.reason === "sem_motivo").count).toBe(1);
  });
  it("resume por operador", () => {
    expect(pausesByOperator(pauses)[0]).toMatchObject({ code: "1", seconds: 3600, count: 2 });
  });
});
