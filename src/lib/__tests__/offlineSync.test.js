import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../api", () => ({
  startSession: vi.fn(),
  finishSession: vi.fn(),
  saveShortages: vi.fn(),
  addToConferenceQueue: vi.fn(),
}));

import * as api from "../api";
import { readQueue, __resetForTests } from "../offlineQueue";
import {
  startSessionSafe, finishSessionSafe, pendingSessionFor, syncQueue, localSessionRow,
} from "../offlineSync";

const NET = { message: "TypeError: Failed to fetch" };
const startArgs = { operatorCode: "101", operatorName: "Ana", activity: "Separação", orderNumber: "55" };
const session = {
  operator_code: "101", operator_name: "Ana", activity: "Separação",
  start_time: "2026-10-10T12:00:00Z", order_number: "55",
};
const finishArgs = (over = {}) => ({
  session, durationSeconds: 120, shift: "Manhã", note: "", isEncaixe: false,
  pausedSeconds: 0, shortages: [], separation: false, ...over,
});

beforeEach(() => {
  __resetForTests();
  vi.clearAllMocks();
});

describe("startSessionSafe", () => {
  it("online: devolve o resultado normal e não usa a fila", async () => {
    api.startSession.mockResolvedValue({ data: { id: 1 }, error: null });
    const res = await startSessionSafe(startArgs);
    expect(res.queued).toBeUndefined();
    expect(readQueue()).toHaveLength(0);
  });

  it("sem rede: guarda na fila e devolve sessão local", async () => {
    api.startSession.mockResolvedValue({ error: NET });
    const res = await startSessionSafe(startArgs);
    expect(res.queued).toBe(true);
    expect(res.data.__offline).toBe(true);
    expect(readQueue()).toHaveLength(1);
    expect(pendingSessionFor("101")?.activity).toBe("Separação");
  });

  it("erro de regra do banco NÃO vai para a fila", async () => {
    api.startSession.mockResolvedValue({ error: { message: "OPERATOR_ALREADY_ACTIVE" } });
    const res = await startSessionSafe(startArgs);
    expect(res.error.message).toBe("OPERATOR_ALREADY_ACTIVE");
    expect(readQueue()).toHaveLength(0);
  });
});

describe("finishSessionSafe", () => {
  it("online: grava com id próprio e devolve entryId", async () => {
    api.finishSession.mockResolvedValue({ data: { id: "x" }, error: null });
    const res = await finishSessionSafe(finishArgs());
    expect(res.error).toBeNull();
    expect(res.queued).toBeUndefined();
    const opts = api.finishSession.mock.calls[0][7];
    expect(opts.entryId).toBe(res.entryId);
  });

  it("sem rede: enfileira finalização + faltas + conferência", async () => {
    api.finishSession.mockResolvedValue({ error: NET });
    const res = await finishSessionSafe(
      finishArgs({ shortages: [{ productCode: "A1", quantity: 2 }], separation: true })
    );
    expect(res.queued).toBe(true);
    expect(readQueue().map((o) => o.type)).toEqual(["finish", "shortages", "conference"]);
    // todas as operações compartilham o mesmo entryId
    expect(new Set(readQueue().map((o) => o.entryId)).size).toBe(1);
  });

  it("sessão iniciada offline e ainda na fila: finalização entra na fila (sem fantasma)", async () => {
    api.startSession.mockResolvedValue({ error: NET });
    const started = await startSessionSafe(startArgs);

    api.finishSession.mockResolvedValue({ data: { id: "x" }, error: null });
    // ainda sem rede: o "iniciar" não consegue sair
    const res = await finishSessionSafe(finishArgs({ session: started.data }));
    expect(res.queued).toBe(true);
    expect(readQueue().map((o) => o.type)).toEqual(["start", "finish"]);
    expect(api.finishSession).not.toHaveBeenCalled();
  });
});

describe("syncQueue", () => {
  it("reenvia na ordem: iniciar, finalizar, faltas, conferência", async () => {
    api.startSession.mockResolvedValueOnce({ error: NET });
    await startSessionSafe(startArgs);
    // o "iniciar" ainda está na fila, então a finalização nem tenta a rede
    await finishSessionSafe(
      finishArgs({ session: localSessionRow(startArgs, "2026-10-10T12:00:00Z"), shortages: [{ productCode: "A", quantity: 1 }], separation: true })
    );

    const order = [];
    api.startSession.mockImplementation(async () => { order.push("start"); return { error: null }; });
    api.finishSession.mockImplementation(async () => { order.push("finish"); return { error: null }; });
    api.saveShortages.mockImplementation(async () => { order.push("shortages"); return { error: null }; });
    api.addToConferenceQueue.mockImplementation(async () => { order.push("conference"); return { error: null }; });

    const res = await syncQueue();
    expect(order).toEqual(["start", "finish", "shortages", "conference"]);
    expect(res.remaining).toBe(0);
  });

  it("iniciar que já existe no banco é descartado, sem travar a fila", async () => {
    api.startSession.mockResolvedValueOnce({ error: NET });
    await startSessionSafe(startArgs);
    api.startSession.mockResolvedValue({ error: { message: "OPERATOR_ALREADY_ACTIVE" } });
    const res = await syncQueue();
    expect(res.remaining).toBe(0);
  });
});
