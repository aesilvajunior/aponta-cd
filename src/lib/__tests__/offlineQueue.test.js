import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  enqueue, flushQueue, readQueue, readFailed, removeByEntryId, retryFailed,
  isNetworkError, getQueueState, subscribeQueue, __resetForTests,
} from "../offlineQueue";

beforeEach(() => __resetForTests());

describe("isNetworkError", () => {
  it("reconhece falha de rede", () => {
    expect(isNetworkError({ message: "TypeError: Failed to fetch" })).toBe(true);
    expect(isNetworkError(new TypeError("Load failed"))).toBe(true);
  });
  it("erro de regra do banco não é rede", () => {
    expect(isNetworkError({ message: "duplicate key value" })).toBe(false);
    expect(isNetworkError(null)).toBe(false);
  });
});

describe("fila", () => {
  it("guarda em ordem e sobrevive a 'recarregar' (localStorage)", () => {
    enqueue({ type: "start", operatorCode: "1" });
    enqueue({ type: "finish", operatorCode: "1", entryId: "e1" });
    expect(readQueue().map((o) => o.type)).toEqual(["start", "finish"]);
    expect(JSON.parse(localStorage.getItem("aponta_offline_queue_v1"))).toHaveLength(2);
  });

  it("notifica quem assina", () => {
    const fn = vi.fn();
    subscribeQueue(fn);
    enqueue({ type: "start" });
    expect(fn).toHaveBeenLastCalledWith({ pending: 1, failed: 0 });
  });

  it("envia tudo em ordem quando há conexão", async () => {
    const calls = [];
    enqueue({ type: "start", n: 1 });
    enqueue({ type: "finish", n: 2 });
    const res = await flushQueue({
      start: async (op) => { calls.push(op.n); return {}; },
      finish: async (op) => { calls.push(op.n); return {}; },
    });
    expect(calls).toEqual([1, 2]);
    expect(res).toEqual({ sent: 2, remaining: 0 });
  });

  it("para no primeiro erro de rede e mantém o resto", async () => {
    enqueue({ type: "start", n: 1 });
    enqueue({ type: "finish", n: 2 });
    const finish = vi.fn(async () => ({}));
    const res = await flushQueue({
      start: async () => ({ error: { message: "Failed to fetch" } }),
      finish,
    });
    expect(finish).not.toHaveBeenCalled();
    expect(res).toEqual({ sent: 0, remaining: 2 });
  });

  it("'drop' descarta a operação (ex.: sessão já existia)", async () => {
    enqueue({ type: "start" });
    const res = await flushQueue({ start: async () => ({ error: { message: "x" }, drop: true }) });
    expect(res).toEqual({ sent: 1, remaining: 0 });
  });

  it("depois de 5 falhas de regra, vai para 'failed' e a fila segue", async () => {
    enqueue({ type: "start" });
    enqueue({ type: "finish" });
    const exec = {
      start: async () => ({ error: { message: "violates constraint" } }),
      finish: async () => ({}),
    };
    for (let i = 0; i < 4; i++) {
      await flushQueue(exec);
      expect(readQueue()[0].type).toBe("start"); // mantém a ordem
    }
    await flushQueue(exec); // 5ª tentativa
    expect(readFailed()).toHaveLength(1);
    await flushQueue(exec);
    expect(getQueueState()).toEqual({ pending: 0, failed: 1 });
  });

  it("retryFailed devolve os falhados para a fila", async () => {
    enqueue({ type: "start" });
    const exec = { start: async () => ({ error: { message: "erro de regra" } }) };
    for (let i = 0; i < 5; i++) await flushQueue(exec);
    expect(getQueueState().failed).toBe(1);
    expect(retryFailed()).toBe(1);
    expect(getQueueState()).toEqual({ pending: 1, failed: 0 });
  });

  it("removeByEntryId tira da fila tudo daquele lançamento (desfazer offline)", () => {
    enqueue({ type: "finish", entryId: "a" });
    enqueue({ type: "shortages", entryId: "a" });
    enqueue({ type: "finish", entryId: "b" });
    expect(removeByEntryId("a")).toBe(2);
    expect(readQueue().map((o) => o.entryId)).toEqual(["b"]);
  });

  it("tipo desconhecido não trava a fila", async () => {
    enqueue({ type: "???" });
    enqueue({ type: "start" });
    const res = await flushQueue({ start: async () => ({}) });
    expect(res.remaining).toBe(0);
    expect(readFailed()).toHaveLength(1);
  });
});
