import { supabase } from "../supabaseClient";

// ============================================================
// Camada central de acesso ao Supabase.
// Nenhum componente deve chamar `supabase.from(...)` diretamente —
// tudo passa por aqui. Isso evita lógica duplicada, facilita
// adicionar recursos novos e concentra o tratamento de erro num
// só lugar.
// ============================================================

// ---------- Leitura -----------------------------------------

export async function fetchOperators() {
  return supabase.from("operators").select("*").order("code");
}

export async function fetchActivities() {
  return supabase.from("activities").select("*").eq("active", true).order("name");
}

export async function fetchEntries(limit = 2000) {
  return supabase.from("entries").select("*").order("start_time", { ascending: false }).limit(limit);
}

export async function fetchActiveSessions() {
  return supabase.from("active_sessions").select("*");
}

export async function fetchActiveSessionFor(operatorCode) {
  return supabase.from("active_sessions").select("*").eq("operator_code", operatorCode).maybeSingle();
}

// ---------- Operadores ----------------------------------------

export async function insertOperator({ code, name, role }) {
  return supabase.from("operators").insert({ code, name, role: role || "-" });
}

export async function updateOperator(code, { name, role }) {
  return supabase.from("operators").update({ name, role: role || "-" }).eq("code", code);
}

export async function deleteOperator(code) {
  return supabase.from("operators").delete().eq("code", code);
}

// Renomear o código de um operador não é um "update" simples porque
// `code` é a chave primária: fazemos insert do novo + delete do
// antigo. Se o insert falhar (ex.: código já em uso), o antigo é
// preservado e nada é perdido.
export async function renameOperatorCode(originalCode, { code, name, role }) {
  const { error: insertErr } = await insertOperator({ code, name, role });
  if (insertErr) return { error: insertErr };
  const { error: deleteErr } = await deleteOperator(originalCode);
  return { error: deleteErr || null };
}

// ---------- Atividades -----------------------------------------

export async function insertActivity(name) {
  return supabase.from("activities").insert({ name, active: true });
}

export async function deleteActivity(name) {
  return supabase.from("activities").delete().eq("name", name);
}

export async function renameActivity(originalName, newName) {
  if (newName === originalName) return { error: null };
  const { error: insertErr } = await insertActivity(newName);
  if (insertErr) return { error: insertErr };
  const { error: deleteErr } = await deleteActivity(originalName);
  return { error: deleteErr || null };
}

// ---------- Sessões / apontamentos -----------------------------------------

export async function startSession({ operatorCode, operatorName, activity, startTimeIso, detail }) {
  return supabase.from("active_sessions").upsert(
    {
      operator_code: operatorCode,
      operator_name: operatorName,
      activity,
      start_time: startTimeIso,
      detail: detail || null,
    },
    { onConflict: "operator_code" }
  );
}

export async function finishSession(session, { endTimeIso, durationSeconds, shift }) {
  const { error: insertError } = await supabase.from("entries").insert({
    operator_code: session.operator_code,
    operator_name: session.operator_name,
    activity: session.activity,
    start_time: session.start_time,
    end_time: endTimeIso,
    duration_seconds: durationSeconds,
    shift,
    detail: session.detail || null,
  });
  if (insertError) return { error: insertError };

  const { error: deleteError } = await supabase
    .from("active_sessions")
    .delete()
    .eq("operator_code", session.operator_code);
  return { error: deleteError || null };
}

export async function resetAllEntries() {
  return supabase.from("entries").delete().neq("id", "00000000-0000-0000-0000-000000000000");
}

// ---------- Realtime -----------------------------------------

// Assina mudanças em várias tabelas e chama `onChange` (sem argumentos)
// sempre que qualquer uma delas mudar. Retorna uma função de limpeza.
export function subscribeToTables(tables, onChange) {
  const channel = supabase.channel(`changes-${tables.join("-")}`);
  tables.forEach((table) => {
    channel.on("postgres_changes", { event: "*", schema: "public", table }, onChange);
  });
  channel.subscribe();
  return () => supabase.removeChannel(channel);
}
