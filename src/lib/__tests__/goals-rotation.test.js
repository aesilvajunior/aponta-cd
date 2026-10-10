import { describe, it, expect, vi } from "vitest";
vi.mock("../../supabaseClient", () => ({ supabase: {} }));
import { getGoalPeriodKey, computeGoalProgress, filterEntriesByGoalPeriod } from "../goals";
import { getMondayOfWeek, weekDates, addDays } from "../rotation";

describe("goals", () => {
  it("chave do dia usa o fuso local", () => {
    expect(getGoalPeriodKey("dia", new Date("2026-10-11T01:30:00Z"))).toBe("2026-10-10");
  });
  it("chave do mês", () => {
    expect(getGoalPeriodKey("mes", new Date(2026, 9, 15))).toBe("2026-10");
  });
  it("progresso da meta", () => {
    const goal = { operator_code: "1", goal_count: 2, goal_avg_seconds: 400 };
    const entries = [
      { operator_code: "1", duration_seconds: 300 },
      { operator_code: "1", duration_seconds: 500 },
      { operator_code: "2", duration_seconds: 10 },
    ];
    expect(computeGoalProgress(goal, entries)).toEqual({
      count: 2,
      avgSeconds: 400,
      goalsMet: { count: true, avg: true },
    });
  });
  it("filtra por dia usando horário local", () => {
    const entries = [
      { start_time: "2026-10-11T01:30:00Z" }, // 22:30 do dia 10
      { start_time: "2026-10-11T12:00:00Z" }, // dia 11
    ];
    expect(filterEntriesByGoalPeriod(entries, "dia", "2026-10-10")).toHaveLength(1);
  });
});

describe("rotation (datas)", () => {
  it("segunda-feira da semana", () => {
    const monday = getMondayOfWeek(new Date(2026, 9, 10)); // sábado 10/10/2026
    expect(monday.getDay()).toBe(1);
    expect(monday.getDate()).toBe(5);
  });
  it("domingo pertence à semana que terminou", () => {
    expect(getMondayOfWeek(new Date(2026, 9, 11)).getDate()).toBe(5);
  });
  it("7 datas a partir da segunda", () => {
    const dates = weekDates(new Date(2026, 9, 5));
    expect(dates).toHaveLength(7);
    expect(dates[0]).toBe("2026-10-05");
    expect(dates[6]).toBe("2026-10-11");
    expect(addDays(new Date(2026, 9, 5), 1).getDate()).toBe(6);
  });
});
