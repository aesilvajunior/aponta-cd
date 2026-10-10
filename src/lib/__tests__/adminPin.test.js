import { describe, it, expect, beforeEach, vi } from "vitest";

const rpc = vi.fn();
const maybeSingle = vi.fn();
const update = vi.fn();
vi.mock("../../supabaseClient", () => ({
  supabase: {
    rpc: (...a) => rpc(...a),
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle }) }),
      update: (...a) => ({ eq: () => update(...a) }),
    }),
  },
}));

import { verifyAdminPin, changeAdminPin, fetchAdminConfig } from "../api";

beforeEach(() => vi.clearAllMocks());

describe("verifyAdminPin", () => {
  it("usa o servidor (RPC) e respeita a resposta", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    expect(await verifyAdminPin("2026")).toEqual({ ok: true, error: null });
    expect(rpc).toHaveBeenCalledWith("verify_admin_pin", { p_pin: "2026" });
    rpc.mockResolvedValue({ data: false, error: null });
    expect((await verifyAdminPin("0000")).ok).toBe(false);
  });

  it("modo legado quando a migração ainda não foi aplicada", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "PGRST202", message: "Could not find the function" } });
    maybeSingle.mockResolvedValue({ data: { pin: "2026" }, error: null });
    expect((await verifyAdminPin("2026")).ok).toBe(true);
    expect((await verifyAdminPin("1111")).ok).toBe(false);
  });

  it("erro de rede não libera o acesso", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "Failed to fetch" } });
    const res = await verifyAdminPin("2026");
    expect(res.ok).toBe(false);
    expect(res.error).toBeTruthy();
  });
});

describe("changeAdminPin", () => {
  it("troca pelo servidor", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    expect((await changeAdminPin("2026", "4321")).ok).toBe(true);
    expect(rpc).toHaveBeenCalledWith("set_admin_pin", { p_current: "2026", p_new: "4321" });
  });
  it("PIN atual errado não troca", async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    expect((await changeAdminPin("0000", "4321")).ok).toBe(false);
  });
});

describe("fetchAdminConfig", () => {
  it("nunca devolve o PIN para o estado do app", async () => {
    maybeSingle.mockResolvedValue({ data: { id: 1, pin: "2026", pin_hash: "x", alert_threshold_seconds: 900 }, error: null });
    const { data } = await fetchAdminConfig();
    expect(data).toEqual({ id: 1, alert_threshold_seconds: 900 });
  });
});
