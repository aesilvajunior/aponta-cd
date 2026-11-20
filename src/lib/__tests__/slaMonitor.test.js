import { describe, it, expect, vi } from "vitest";

vi.mock("../../supabaseClient", () => ({ supabase: {} }));

import {
  DEFAULT_SLA_CONFIG,
  evaluatePauseSlas,
  evaluateConferenceSla,
  evaluateShiftProductivitySla,
  evaluateAllSlaBottlenecks,
} from "../slaMonitor";

describe("slaMonitor — alertas proativos de gargalo", () => {
  const baseNow = new Date("2026-10-15T11:00:00-03:00").getTime();

  it("alerta quando uma pausa ativa ultrapassa o limite SLA do motivo", () => {
    const activeSessions = [
      {
        operator_code: "101",
        operator_name: "Ana",
        paused_at: new Date(baseNow - 22 * 60 * 1000).toISOString(),
      },
    ];
    const openPauseLogs = [
      { operator_code: "101", operator_name: "Ana", reason: "aguardando_lideranca", paused_at: activeSessions[0].paused_at, resumed_at: null },
    ];

    const alerts = evaluatePauseSlas(activeSessions, openPauseLogs, DEFAULT_SLA_CONFIG, baseNow);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].type).toBe("pause_exceeded");
    expect(alerts[0].severity).toBe("critical"); // 22min vs 10min (> 1.5x)
    expect(alerts[0].tab).toBe("pauses");
  });

  it("não alerta almoço dentro do limite de 65 minutos", () => {
    const pausedAt = new Date(baseNow - 40 * 60 * 1000).toISOString();
    const alerts = evaluatePauseSlas(
      [{ operator_code: "102", operator_name: "Bia", paused_at: pausedAt }],
      [{ operator_code: "102", reason: "almoco", paused_at: pausedAt, resumed_at: null }],
      DEFAULT_SLA_CONFIG,
      baseNow
    );
    expect(alerts).toHaveLength(0);
  });

  it("alerta fila de conferência travada quando pedido mais antigo passa do SLA sem conferente", () => {
    const queue = [
      { id: 1, status: "aguardando", separated_at: new Date(baseNow - 28 * 60 * 1000).toISOString() },
      { id: 2, status: "aguardando", separated_at: new Date(baseNow - 10 * 60 * 1000).toISOString() },
    ];
    const alerts = evaluateConferenceSla(queue, DEFAULT_SLA_CONFIG, baseNow);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].type).toBe("conference_stalled");
    expect(alerts[0].severity).toBe("critical");
    expect(alerts[0].title).toContain("travada");
  });

  it("alerta queda de produtividade do turno abaixo da meta percentual", () => {
    // Histórico: 40 lançamentos no turno Manhã em 2 dias passados -> média 40/turno
    // Às 11h (5h de 8h = 62.5%), esperado ~25 registros; hoje tem apenas 5 (20%)
    const entries = [];
    for (let i = 0; i < 40; i++) {
      entries.push({ shift: "Manhã", start_time: "2026-10-13T09:00:00-03:00" });
      entries.push({ shift: "Manhã", start_time: "2026-10-14T09:00:00-03:00" });
    }
    for (let i = 0; i < 5; i++) {
      entries.push({ shift: "Manhã", start_time: "2026-10-15T08:30:00-03:00" });
    }

    const alerts = evaluateShiftProductivitySla(entries, [], DEFAULT_SLA_CONFIG, baseNow);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].type).toBe("shift_productivity_low");
    expect(alerts[0].severity).toBe("critical");
    expect(alerts[0].tab).toBe("workload");
  });

  it("consolida todos os alertas em evaluateAllSlaBottlenecks e respeita enabled=false", () => {
    const pausedAt = new Date(baseNow - 30 * 60 * 1000).toISOString();
    const queue = [{ id: 1, status: "aguardando", separated_at: pausedAt }];
    const all = evaluateAllSlaBottlenecks({
      activeSessions: [{ operator_code: "1", operator_name: "Ana", paused_at: pausedAt }],
      conferenceQueue: queue,
      now: baseNow,
    });
    expect(all.length).toBe(2);

    const disabled = evaluateAllSlaBottlenecks({
      activeSessions: [{ operator_code: "1", operator_name: "Ana", paused_at: pausedAt }],
      conferenceQueue: queue,
      cfg: { enabled: false },
      now: baseNow,
    });
    expect(disabled).toHaveLength(0);
  });
});
