import { describe, it, expect, vi } from "vitest";
vi.mock("../../supabaseClient", () => ({ supabase: {} }));
import { applyRealtimeChange } from "../useRealtimeSync";

const byStartDesc = (a, b) => new Date(b.start_time) - new Date(a.start_time);
const list = [
  { id: 1, start_time: "2026-10-10T10:00:00Z" },
  { id: 2, start_time: "2026-10-09T10:00:00Z" },
];

describe("applyRealtimeChange", () => {
  it("INSERT entra e mantém a ordem", () => {
    const out = applyRealtimeChange(list, { eventType: "INSERT", new: { id: 3, start_time: "2026-10-10T11:00:00Z" } }, { compare: byStartDesc });
    expect(out.map((e) => e.id)).toEqual([3, 1, 2]);
  });
  it("UPDATE troca a linha existente", () => {
    const out = applyRealtimeChange(list, { eventType: "UPDATE", new: { id: 2, start_time: "2026-10-09T10:00:00Z", note: "x" } });
    expect(out.find((e) => e.id === 2).note).toBe("x");
    expect(out).toHaveLength(2);
  });
  it("DELETE remove pela chave", () => {
    expect(applyRealtimeChange(list, { eventType: "DELETE", old: { id: 1 } }).map((e) => e.id)).toEqual([2]);
  });
  it("fora da janela: não entra, e sai se já existia", () => {
    const accept = (row) => new Date(row.start_time) > new Date("2026-10-01T00:00:00Z");
    const old = { id: 9, start_time: "2025-01-01T00:00:00Z" };
    expect(applyRealtimeChange(list, { eventType: "INSERT", new: old }, { accept })).toHaveLength(2);
    expect(applyRealtimeChange([...list, old], { eventType: "UPDATE", new: old }, { accept })).toHaveLength(2);
  });
  it("chave customizada (active_sessions)", () => {
    const sessions = [{ operator_code: "1" }];
    expect(applyRealtimeChange(sessions, { eventType: "DELETE", old: { operator_code: "1" } }, { key: "operator_code" })).toEqual([]);
  });
});
