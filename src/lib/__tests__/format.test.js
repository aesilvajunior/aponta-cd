import { describe, it, expect, vi, afterEach } from "vitest";
import { localISODate, todayLocalISODate, shiftFor, fmtDuration, fmtDate } from "../format";

afterEach(() => vi.useRealTimers());

describe("localISODate (fuso de Brasília)", () => {
  it("às 22:30 locais ainda é o mesmo dia (UTC já virou o dia)", () => {
    // 01:30Z do dia 11 = 22:30 do dia 10 em Brasília
    expect(localISODate("2026-10-11T01:30:00Z")).toBe("2026-10-10");
    // regressão: o jeito antigo (fatiar o ISO em UTC) erraria o dia
    expect("2026-10-11T01:30:00Z".slice(0, 10)).toBe("2026-10-11");
  });

  it("de manhã bate com a data UTC", () => {
    expect(localISODate("2026-10-10T12:00:00Z")).toBe("2026-10-10");
  });

  it("aceita Date", () => {
    expect(localISODate(new Date("2026-03-01T02:59:59Z"))).toBe("2026-02-28");
  });
});

describe("todayLocalISODate", () => {
  it("às 22h do dia 10 (local) ainda devolve o dia 10", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-11T01:00:00Z"));
    expect(todayLocalISODate()).toBe("2026-10-10");
  });
});

describe("shiftFor", () => {
  it("antes das 13:30 é Manhã", () => {
    expect(shiftFor("2026-10-10T15:29:00Z")).toBe("Manhã"); // 12:29 local
  });
  it("a partir das 13:30 é Tarde", () => {
    expect(shiftFor("2026-10-10T16:30:00Z")).toBe("Tarde"); // 13:30 local
  });
  it("data inválida cai em Manhã", () => {
    expect(shiftFor("lixo")).toBe("Manhã");
  });
});

describe("fmtDuration / fmtDate", () => {
  it("formata minutos e horas", () => {
    expect(fmtDuration(65)).toBe("1m 05s");
    expect(fmtDuration(3725)).toBe("1h 02m 05s");
  });
  it("valores inválidos", () => {
    expect(fmtDuration(null)).toBe("-");
    expect(fmtDate("x")).toBe("--/--/----");
  });
});
