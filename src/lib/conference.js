// ============================================================
// Mesa de conferência — helpers e cálculos
// ============================================================

import { supabase } from "../supabaseClient";

// ------------------------------------------------------------
// Buscar a fila da mesa (por padrão, só os ativos)
// ------------------------------------------------------------
export async function fetchConferenceQueue({ includeFinished = false } = {}) {
  let query = supabase
    .from("conference_queue")
    .select("*")
    .order("separated_at", { ascending: true });

  if (!includeFinished) {
    query = query.in("status", ["aguardando", "em_conferencia"]);
  }

  const { data, error } = await query;
  return { data: data || [], error };
}

// ------------------------------------------------------------
// Buscar histórico (conferidos + com problema)
// ------------------------------------------------------------
export async function fetchConferenceHistory({ limit = 500 } = {}) {
  const { data, error } = await supabase
    .from("conference_queue")
    .select("*")
    .in("status", ["conferido", "com_problema"])
    .order("conference_finished_at", { ascending: false })
    .limit(limit);
  return { data: data || [], error };
}

// ------------------------------------------------------------
// Criar item na mesa quando uma separação termina
// ------------------------------------------------------------
export async function addToConferenceQueue(entry) {
  const payload = {
    entry_id: entry.id,
    order_number: entry.order_number || null,
    customer_name: entry.customer_name || null,
    transfer_type: entry.transfer_type || null,
    transfer_number: entry.transfer_number || null,
    transfer_urgent: entry.transfer_urgent ?? null,
    is_encaixe: entry.is_encaixe || false,
    separated_by_code: entry.operator_code,
    separated_by_name: entry.operator_name,
    separated_at: entry.end_time,
    status: "aguardando",
  };

  const { data, error } = await supabase
    .from("conference_queue")
    .insert(payload)
    .select()
    .maybeSingle();

  return { data, error };
}

// ------------------------------------------------------------
// Assumir conferência
// ------------------------------------------------------------
export async function startConference(id, operator) {
  const { data, error } = await supabase
    .from("conference_queue")
    .update({
      status: "em_conferencia",
      conference_started_at: new Date().toISOString(),
      conference_started_by_code: operator.code,
      conference_started_by_name: operator.name,
    })
    .eq("id", id)
    .select()
    .maybeSingle();

  return { data, error };
}

// ------------------------------------------------------------
// Finalizar conferência (sucesso)
// ------------------------------------------------------------
export async function finishConference(id, operator, note = "") {
  const startedAt = await getStartedAt(id);
  const duration = startedAt
    ? Math.round((Date.now() - new Date(startedAt).getTime()) / 1000)
    : null;

  const { data, error } = await supabase
    .from("conference_queue")
    .update({
      status: "conferido",
      conference_finished_at: new Date().toISOString(),
      conference_finished_by_code: operator.code,
      conference_finished_by_name: operator.name,
      duration_seconds: duration,
      note: note || null,
    })
    .eq("id", id)
    .select()
    .maybeSingle();

  return { data, error };
}

// ------------------------------------------------------------
// Devolver com problema
// ------------------------------------------------------------
export async function reportConferenceProblem(id, operator, reason, note = "") {
  const startedAt = await getStartedAt(id);
  const duration = startedAt
    ? Math.round((Date.now() - new Date(startedAt).getTime()) / 1000)
    : null;

  const { data, error } = await supabase
    .from("conference_queue")
    .update({
      status: "com_problema",
      conference_finished_at: new Date().toISOString(),
      conference_finished_by_code: operator.code,
      conference_finished_by_name: operator.name,
      problem_reason: reason,
      note: note || null,
      duration_seconds: duration,
    })
    .eq("id", id)
    .select()
    .maybeSingle();

  return { data, error };
}

// ------------------------------------------------------------
// Helpers internos
// ------------------------------------------------------------
async function getStartedAt(id) {
  const { data } = await supabase
    .from("conference_queue")
    .select("conference_started_at")
    .eq("id", id)
    .maybeSingle();
  return data?.conference_started_at || null;
}

// ------------------------------------------------------------
// Calcular tempo esperando (em segundos) — pra alertas
// ------------------------------------------------------------
export function waitingSeconds(item, now = Date.now()) {
  const separated = new Date(item.separated_at).getTime();
  return Math.max(0, Math.round((now - separated) / 1000));
}

// ------------------------------------------------------------
// Estatísticas da mesa
// ------------------------------------------------------------
export function computeConferenceStats(queue, history) {
  const waiting = queue.filter((q) => q.status === "aguardando");
  const inProgress = queue.filter((q) => q.status === "em_conferencia");

  const today = new Date().toISOString().slice(0, 10);
  const todayFinished = history.filter(
    (h) => h.conference_finished_at && h.conference_finished_at.slice(0, 10) === today
  );

  const finishedOk = todayFinished.filter((h) => h.status === "conferido");
  const finishedProblem = todayFinished.filter((h) => h.status === "com_problema");

  const durations = finishedOk.map((h) => h.duration_seconds || 0).filter((d) => d > 0);
  const avgDuration = durations.length > 0
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    : 0;

  const oldestWaiting = waiting.length > 0
    ? waiting.reduce((oldest, w) =>
        new Date(w.separated_at) < new Date(oldest.separated_at) ? w : oldest
      )
    : null;

  return {
    waiting: waiting.length,
    inProgress: inProgress.length,
    todayFinished: todayFinished.length,
    finishedOk: finishedOk.length,
    finishedProblem: finishedProblem.length,
    avgDuration,
    oldestWaiting,
  };
}