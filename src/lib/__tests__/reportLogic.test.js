import { describe, it, expect } from "vitest";
import { isDue, periodFor, toCsv, summarizeByOperator, brtDateString } from "../../../supabase/functions/_shared/reportLogic.js";

// 2026-10-12 é segunda-feira. 11:00Z = 08:00 em Brasília.
const MON_8H = new Date("2026-10-12T11:00:00Z");

describe("isDue", () => {
  const base = { active: true, frequency: "diario", hour: 8 };
  it("diário na hora certa (horário de Brasília)", () => {
    expect(isDue(base, MON_8H)).toBe(true);
    expect(isDue(base, new Date("2026-10-12T08:00:00Z"))).toBe(false); // 05h em Brasília
  });
  it("semanal só no dia da semana configurado", () => {
    expect(isDue({ ...base, frequency: "semanal", day_of_week: 1 }, MON_8H)).toBe(true);
    expect(isDue({ ...base, frequency: "semanal", day_of_week: 2 }, MON_8H)).toBe(false);
  });
  it("mensal só no dia do mês configurado", () => {
    expect(isDue({ ...base, frequency: "mensal", day_of_month: 12 }, MON_8H)).toBe(true);
    expect(isDue({ ...base, frequency: "mensal", day_of_month: 1 }, MON_8H)).toBe(false);
  });
  it("não repete no mesmo dia, mas volta a sair no dia seguinte", () => {
    const sentToday = { ...base, last_sent_at: "2026-10-12T11:05:00Z" };
    expect(isDue(sentToday, MON_8H)).toBe(false);
    expect(isDue({ ...base, last_sent_at: "2026-10-11T11:05:00Z" }, MON_8H)).toBe(true);
  });
  it("desativado ou frequência inválida nunca sai", () => {
    expect(isDue({ ...base, active: false }, MON_8H)).toBe(false);
    expect(isDue({ ...base, frequency: "quinzenal" }, MON_8H)).toBe(false);
  });
  it("meia-noite de Brasília já é o dia certo (UTC ainda é o dia anterior? não: 03h UTC)", () => {
    // 23h do dia 11 em Brasília = 02h UTC do dia 12: o dia local ainda é 11
    expect(brtDateString(new Date("2026-10-12T02:00:00Z"))).toBe("2026-10-11");
  });
});

describe("periodFor", () => {
  it("diário = ontem inteiro (em Brasília)", () => {
    const p = periodFor({ frequency: "diario" }, MON_8H);
    expect(p.label).toBe("2026-10-11");
    expect(p.fromIso).toBe("2026-10-11T03:00:00.000Z");
    expect(p.toIso).toBe("2026-10-12T03:00:00.000Z");
  });
  it("semanal = 7 dias terminando ontem", () => {
    const p = periodFor({ frequency: "semanal" }, MON_8H);
    expect(p.label).toBe("2026-10-05 a 2026-10-11");
  });
  it("mensal = 30 dias", () => {
    expect(periodFor({ frequency: "mensal" }, MON_8H).label).toBe("2026-09-12 a 2026-10-11");
  });
});

describe("toCsv", () => {
  it("usa ; e BOM, e protege aspas, ; e quebras de linha", () => {
    const csv = toCsv(
      [{ a: 'diz "oi"', b: "x;y", c: null }, { a: "linha\nnova", b: 1, c: 2 }],
      [{ key: "a", label: "A" }, { key: "b", label: "B" }, { key: "c", label: "C" }]
    );
    expect(csv.startsWith("\ufeff")).toBe(true);
    const lines = csv.slice(1).split("\r\n");
    expect(lines[0]).toBe("A;B;C");
    expect(lines[1]).toBe('"diz ""oi""";"x;y";');
    expect(lines[2].startsWith('"linha\nnova";1;2')).toBe(true);
  });
  it("sem colunas usa as chaves da primeira linha", () => {
    expect(toCsv([{ x: 1, y: 2 }]).slice(1).split("\r\n")[0]).toBe("x;y");
  });
});

describe("summarizeByOperator", () => {
  it("agrupa e formata", () => {
    const r = summarizeByOperator([
      { operator_code: "1", operator_name: "Ana", duration_seconds: 60 },
      { operator_code: "1", operator_name: "Ana", duration_seconds: 120 },
      { operator_code: "2", operator_name: "Bia", duration_seconds: 30 },
    ]);
    expect(r[0]).toMatchObject({ operador: "Ana", registros: 2, media: "1m 30s", total: "3m 00s" });
  });
});
