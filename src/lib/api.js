import { supabase } from "../supabaseClient";

// Centraliza todo o acesso ao banco em um só lugar. Isso evita duplicar a
// mesma query em vários componentes (fonte comum de bugs quando o esquema
// muda) e deixa mais fácil adicionar novas funcionalidades no futuro.

// ---------- Leituras ----------

export async function fetchOperators() {
  return supabase.from("operators").select("*").order("code");
}

export async function fetchActivities() {
  return supabase.from("activities").select("*").eq("active", true).order("name");
}

export async function fetchAdminConfig() {
  return supabase.from("admin_config").select("*").eq("id", 1).maybeSingle();
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

// ---------- Ações do quiosque ----------

export async function startSession({ operatorCode, operatorName, activity }) {
  return supabase.from("active_sessions").upsert(
    {
      operator_code: operatorCode,
      operator_name: operatorName,
      activity,
      start_time: new Date().toISOString(),
    },
    { onConflict: "operator_code" }
  );
}

export async function finishSession(session, durationSeconds, shift) {
  const insertRes = await supabase.from("entries").insert({
    operator_code: session.operator_code,
    operator_name: session.operator_name,
    activity: session.activity,
    start_time: session.start_time,
    end_time: new Date().toISOString(),
    duration_seconds: durationSeconds,
    shift,
  });
  if (insertRes.error) return insertRes;
  return supabase.from("active_sessions").delete().eq("operator_code", session.operator_code);
}

// ---------- Operadores ----------

export async function addOperator({ code, name, role }) {
  return supabase.from("operators").insert({ code, name, role: role || "-" });
}

export async function updateOperator(code, fields) {
  return supabase.from("operators").update(fields).eq("code", code);
}

// O código é a chave primária no banco. Trocar o código de um operador
// existente exige criar a linha nova antes de apagar a antiga, para nunca
// ficar um instante sem nenhuma linha (e para poder desfazer se a segunda
// parte falhar).
export async function renameOperatorCode(oldCode, newCode, fields) {
  const insertRes = await supabase.from("operators").insert({ code: newCode, ...fields });
  if (insertRes.error) return insertRes;
  const deleteRes = await supabase.from("operators").delete().eq("code", oldCode);
  if (deleteRes.error) {
    // Não conseguiu remover a linha antiga: desfaz a nova para não duplicar.
    await supabase.from("operators").delete().eq("code", newCode);
    return deleteRes;
  }
  return deleteRes;
}

export async function deleteOperator(code) {
  return supabase.from("operators").delete().eq("code", code);
}

// ---------- Atividades ----------

export async function addActivity(name, targetSeconds = null) {
  return supabase.from("activities").insert({ name, active: true, target_seconds: targetSeconds });
}

export async function renameActivity(oldName, newName, targetSeconds = null) {
  const insertRes = await supabase
    .from("activities")
    .insert({ name: newName, active: true, target_seconds: targetSeconds });
  if (insertRes.error) return insertRes;
  const deleteRes = await supabase.from("activities").delete().eq("name", oldName);
  if (deleteRes.error) {
    await supabase.from("activities").delete().eq("name", newName);
    return deleteRes;
  }
  return deleteRes;
}

export async function updateActivityTarget(name, targetSeconds) {
  return supabase.from("activities").update({ target_seconds: targetSeconds }).eq("name", name);
}

export async function deleteActivity(name) {
  return supabase.from("activities").delete().eq("name", name);
}

// ---------- Administração ----------

export async function updateAdminPin(pin) {
  return supabase.from("admin_config").update({ pin }).eq("id", 1);
}

export async function deleteAllEntries() {
  return supabase.from("entries").delete().neq("id", "00000000-0000-0000-0000-000000000000");
}

// ---------- Lançamento retroativo (só admin) ----------

// Insere um registro já finalizado diretamente no histórico, sem passar
// pelo quiosque — para digitar dados de meses anteriores (ex: papel de
// agosto) para efeito de análise. Fica marcado como manual_entry para
// manter rastreabilidade de que não veio de uma batida real de ponto.
export async function addManualEntry({ operatorCode, operatorName, activity, startTime, endTime, durationSeconds, shift }) {
  return supabase.from("entries").insert({
    operator_code: operatorCode,
    operator_name: operatorName,
    activity,
    start_time: startTime,
    end_time: endTime,
    duration_seconds: durationSeconds,
    shift,
    manual_entry: true,
  });
}
