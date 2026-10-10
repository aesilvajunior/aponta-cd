import { describe, it, expect, vi } from "vitest";
vi.mock("../../supabaseClient", () => ({ supabase: {} }));
import { analyzeEntriesForFraud } from "../fraud";

const op = { code: "101", name: "Ana" };
const mk = (over = {}) => ({
  id: Math.random().toString(36).slice(2),
  operator_code: "101",
  operator_name: "Ana",
  activity: "Separação",
  start_time: "2026-10-10T12:00:00Z",
  duration_seconds: 300,
  ...over,
});

describe("analyzeEntriesForFraud", () => {
  it("não alerta com registros normais", () => {
    expect(analyzeEntriesForFraud([mk(), mk(), mk()], [op])).toEqual([]);
  });

  it("alerta registros curtos demais (>=3)", () => {
    const list = [mk({ duration_seconds: 5 }), mk({ duration_seconds: 6 }), mk({ duration_seconds: 7 })];
    const alerts = analyzeEntriesForFraud(list, [op]);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ alert_type: "tempo_curto", severity: "media", operator_name: "Ana" });
  });

  it("severidade alta com 8+ registros curtos", () => {
    const list = Array.from({ length: 8 }, () => mk({ duration_seconds: 3 }));
    expect(analyzeEntriesForFraud(list, [op])[0].severity).toBe("alta");
  });

  it("alerta registro com mais de 4h", () => {
    const alerts = analyzeEntriesForFraud([mk({ duration_seconds: 5 * 3600 })], [op]);
    expect(alerts.map((a) => a.alert_type)).toContain("tempo_longo");
  });

  it("agrupa encaixes por dia LOCAL (21h-23h59 não vira o dia seguinte)", () => {
    // 20 encaixes às 22:30 locais do dia 10 (= 01:30Z do dia 11)
    const late = Array.from({ length: 20 }, () => mk({ is_encaixe: true, start_time: "2026-10-11T01:30:00Z" }));
    const alerts = analyzeEntriesForFraud(late, [op]);
    const enc = alerts.find((a) => a.alert_type === "muitos_encaixes");
    expect(enc.context.day).toBe("2026-10-10");
  });
});
