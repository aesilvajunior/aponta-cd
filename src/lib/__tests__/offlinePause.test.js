import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../api", () => ({
  startSession: vi.fn(),
  finishSession: vi.fn(),
  saveShortages: vi.fn(),
  addToConferenceQueue: vi.fn(),
  setSessionPaused: vi.fn(),
  setSessionResumed: vi.fn(),
  insertPauseLog: vi.fn(),
  closePauseLog: vi.fn(),
  logSeparationError: vi.fn(),
}));

import * as api from "../api";
import { readQueue, __resetForTests } from "../offlineQueue";
import { pauseSessionSafe, resumeSessionSafe, logSeparationErrorSafe, syncQueue } from "../offlineSync";

const NET = { message: "TypeError: Failed to fetch" };
const session = { operator_code: "101", operator_name: "Ana", activity: "Separação", start_time: "2026-10-10T12:00:00Z" };

beforeEach(() => {
  __resetForTests();
  vi.clearAllMocks();
});

describe("pausar / retomar", () => {
  it("online: pausa e registra o motivo", async () => {
    api.setSessionPaused.mockResolvedValue({ error: null });
    api.insertPauseLog.mockResolvedValue({ error: null });
    const res = await pauseSessionSafe({ session, reason: "almoco", station: "Sep 1" });
    expect(res.queued).toBe(false);
    expect(api.insertPauseLog).toHaveBeenCalledWith(expect.objectContaining({ reason: "almoco", operatorCode: "101" }));
    expect(readQueue()).toHaveLength(0);
  });

  it("tabela de motivos ausente não impede a pausa", async () => {
    api.setSessionPaused.mockResolvedValue({ error: null });
    api.insertPauseLog.mockResolvedValue({ error: { code: "42P01", message: "relation does not exist" } });
    const res = await pauseSessionSafe({ session, reason: "outro" });
    expect(res.error).toBeNull();
    expect(readQueue()).toHaveLength(0);
  });

  it("sem rede: pausa e retomada entram na fila, em ordem", async () => {
    api.setSessionPaused.mockResolvedValue({ error: NET });
    api.setSessionResumed.mockResolvedValue({ error: NET });
    const p = await pauseSessionSafe({ session, reason: "banheiro" });
    const r = await resumeSessionSafe({ session, addedPause: 120, newTotal: 120 });
    expect(p.queued).toBe(true);
    expect(r.queued).toBe(true);
    expect(readQueue().map((o) => o.type)).toEqual(["pause", "resume"]);
  });

  it("ao voltar a rede, reenvia pausa e retomada na ordem", async () => {
    api.setSessionPaused.mockResolvedValueOnce({ error: NET });
    api.setSessionResumed.mockResolvedValueOnce({ error: NET });
    await pauseSessionSafe({ session, reason: "almoco" });
    await resumeSessionSafe({ session, addedPause: 60, newTotal: 60 });

    const order = [];
    api.setSessionPaused.mockImplementation(async () => { order.push("pause"); return { error: null }; });
    api.insertPauseLog.mockImplementation(async () => { order.push("log+"); return { error: null }; });
    api.setSessionResumed.mockImplementation(async () => { order.push("resume"); return { error: null }; });
    api.closePauseLog.mockImplementation(async () => { order.push("log-"); return { error: null }; });
    const res = await syncQueue();
    expect(order).toEqual(["pause", "log+", "resume", "log-"]);
    expect(res.remaining).toBe(0);
  });
});

describe("erro de separação offline", () => {
  const args = { operatorCode: "101", operatorName: "Ana", errorType: "Faltou item" };

  it("online grava normalmente", async () => {
    api.logSeparationError.mockResolvedValue({ error: null });
    expect((await logSeparationErrorSafe(args)).queued).toBe(false);
  });

  it("sem rede guarda com a hora original e reenvia", async () => {
    api.logSeparationError.mockResolvedValueOnce({ error: NET });
    const res = await logSeparationErrorSafe(args);
    expect(res.queued).toBe(true);
    const saved = readQueue()[0].payload.createdAt;
    expect(saved).toBeTruthy();

    api.logSeparationError.mockResolvedValue({ error: null });
    await syncQueue();
    expect(api.logSeparationError).toHaveBeenLastCalledWith(expect.objectContaining({ createdAt: saved }));
    expect(readQueue()).toHaveLength(0);
  });

  it("erro de regra do banco aparece para o operador (não vai para a fila)", async () => {
    api.logSeparationError.mockResolvedValue({ error: { message: "violates check constraint" } });
    const res = await logSeparationErrorSafe(args);
    expect(res.error.message).toMatch(/violates/);
    expect(readQueue()).toHaveLength(0);
  });
});
