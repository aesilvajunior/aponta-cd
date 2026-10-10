// ============================================================
// Liga a fila offline (offlineQueue.js) às chamadas da API.
// Use startSessionSafe / finishSessionSafe no Kiosk: online funcionam
// como antes; sem internet guardam na fila e reenviam sozinhas.
// ============================================================
import { startSession, finishSession, saveShortages, addToConferenceQueue } from "./api";
import {
  enqueue,
  flushQueue,
  isNetworkError,
  makeId,
  readQueue,
  removeByEntryId,
  subscribeQueue,
  getQueueState,
  retryFailed,
} from "./offlineQueue";

export { isNetworkError, subscribeQueue, getQueueState, removeByEntryId, retryFailed };

// Linha no formato de active_sessions, para o Kiosk continuar funcionando
// enquanto a sessão ainda não chegou ao banco.
export function localSessionRow(args, startTime) {
  return {
    operator_code: args.operatorCode,
    operator_name: args.operatorName,
    activity: args.activity,
    start_time: startTime,
    order_number: args.orderNumber || null,
    customer_name: args.customerName || null,
    transfer_type: args.transferType || null,
    transfer_urgent: args.transferUrgent ?? null,
    transfer_number: args.transferNumber || null,
    vehicle: args.vehicle || null,
    plate: args.plate || null,
    station: args.station || null,
    is_encaixe: args.isEncaixe || false,
    supplier_name: args.supplierName || null,
    invoice_number: args.invoiceNumber || null,
    is_dupla: !!args.isDupla,
    paused_at: null,
    total_paused_seconds: 0,
    __offline: true,
  };
}

// Sessão iniciada offline e ainda não enviada (para o operador reabrir/finalizar).
export function pendingSessionFor(operatorCode) {
  let session = null;
  for (const op of readQueue()) {
    if (op.operatorCode !== operatorCode) continue;
    if (op.type === "start") session = localSessionRow(op.payload, op.payload.startTime);
    if (op.type === "finish") session = null;
  }
  return session;
}

export async function startSessionSafe(args) {
  const startTime = new Date().toISOString();
  const res = await startSession({ ...args, startTime });
  if (res.error && isNetworkError(res.error)) {
    enqueue({ type: "start", operatorCode: args.operatorCode, payload: { ...args, startTime } });
    return { data: localSessionRow(args, startTime), error: null, queued: true };
  }
  return res;
}

function entryLikeFrom(session, entryId, endTime, durationSeconds, shift, note, isEncaixe) {
  return {
    id: entryId,
    operator_code: session.operator_code,
    operator_name: session.operator_name,
    activity: session.activity,
    start_time: session.start_time,
    end_time: endTime,
    duration_seconds: durationSeconds,
    shift,
    order_number: session.order_number || null,
    customer_name: session.customer_name || null,
    transfer_type: session.transfer_type || null,
    transfer_urgent: session.transfer_urgent ?? null,
    transfer_number: session.transfer_number || null,
    is_encaixe: !!isEncaixe,
    note: note || null,
  };
}

export function queueShortages(entryId, operatorCode, shortages) {
  if (!shortages || shortages.length === 0) return;
  enqueue({ type: "shortages", entryId, operatorCode, payload: { shortages } });
}

export function queueConference(entry) {
  enqueue({ type: "conference", entryId: entry.id, operatorCode: entry.operator_code, payload: { entry } });
}

// Finaliza. Se estiver sem internet, guarda na fila (inclusive faltas e fila
// de conferência) e devolve { queued: true }.
export async function finishSessionSafe({
  session, durationSeconds, shift, note, isEncaixe, pausedSeconds, shortages = [], separation = false,
}) {
  const entryId = makeId();
  const endTime = new Date().toISOString();

  // Se o "iniciar" desta sessão ainda está na fila, ele precisa chegar ao banco
  // ANTES do "finalizar"; senão sobraria uma sessão fantasma depois.
  let mustQueue = false;
  if (session.__offline) {
    await syncQueue();
    mustQueue = !!pendingSessionFor(session.operator_code);
  }

  const res = mustQueue
    ? { error: { message: "offline" } }
    : await finishSession(
        session, durationSeconds, shift, note, isEncaixe, pausedSeconds, null, { entryId, endTime }
      );

  if (res.error && (mustQueue || isNetworkError(res.error))) {
    enqueue({
      type: "finish",
      entryId,
      operatorCode: session.operator_code,
      payload: { session, durationSeconds, shift, note, isEncaixe, pausedSeconds, endTime },
    });
    queueShortages(entryId, session.operator_code, shortages);
    const entry = entryLikeFrom(session, entryId, endTime, durationSeconds, shift, note, isEncaixe);
    if (separation) queueConference(entry);
    return { data: entry, entryId, error: null, queued: true };
  }
  return { ...res, entryId };
}

const executors = {
  start: async (op) => {
    const { error } = await startSession(op.payload);
    if (error?.message === "OPERATOR_ALREADY_ACTIVE") return { drop: true };
    return { error };
  },
  finish: async (op) => {
    const p = op.payload;
    const { error } = await finishSession(
      p.session, p.durationSeconds, p.shift, p.note, p.isEncaixe, p.pausedSeconds, null,
      { entryId: op.entryId, endTime: p.endTime }
    );
    return { error };
  },
  shortages: async (op) => {
    const { error } = await saveShortages(op.entryId, op.payload.shortages);
    return { error };
  },
  conference: async (op) => {
    const { error } = await addToConferenceQueue(op.payload.entry);
    return { error };
  },
};

export function syncQueue() {
  return flushQueue(executors);
}

// Liga a sincronização automática: ao voltar a internet, ao voltar para a aba
// e a cada 15 s enquanto houver pendências. Retorna a função de limpeza.
export function startAutoSync(onSynced) {
  async function run() {
    if (getQueueState().pending === 0) return;
    const result = await syncQueue();
    if (result.sent > 0) onSynced?.(result);
  }
  const onOnline = () => { run(); };
  const onVisible = () => { if (document.visibilityState === "visible") run(); };
  window.addEventListener("online", onOnline);
  document.addEventListener("visibilitychange", onVisible);
  const iv = setInterval(run, 15000);
  run();
  return () => {
    window.removeEventListener("online", onOnline);
    document.removeEventListener("visibilitychange", onVisible);
    clearInterval(iv);
  };
}
