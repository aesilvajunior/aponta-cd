import { supabase } from "../supabaseClient";

// Centraliza todo o acesso ao banco em um só lugar. Isso evita duplicar a
// mesma query em vários componentes (fonte comum de bugs quando o esquema
// muda) e deixa mais fácil adicionar novas funcionalidades no futuro.

// ---------- Leituras ----------

export async function fetchOperators() {
  return supabase.from("operators").select("*").order("code");
}

export async function fetchActivities() {
  return supabase.from("activities").select("*").eq("active", true).order("sort_order", { ascending: true });
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

export async function startSession({
  operatorCode, operatorName, activity,
  orderNumber = null, customerName = null, transferType = null,
  vehicle = null, plate = null, station = null,
}) {
  return supabase.from("active_sessions").upsert(
    {
      operator_code: operatorCode,
      operator_name: operatorName,
      activity,
      start_time: new Date().toISOString(),
      order_number: orderNumber,
      customer_name: customerName,
      transfer_type: transferType,
      vehicle,
      plate,
      station,
    },
    { onConflict: "operator_code" }
  );
}

export async function finishSession(session, durationSeconds, shift, note = null) {
  const insertRes = await supabase.from("entries").insert({
    operator_code: session.operator_code,
    operator_name: session.operator_name,
    activity: session.activity,
    start_time: session.start_time,
    end_time: new Date().toISOString(),
    duration_seconds: durationSeconds,
    shift,
    note: note || null,
    order_number: session.order_number || null,
    customer_name: session.customer_name || null,
    transfer_type: session.transfer_type || null,
    vehicle: session.vehicle || null,
    plate: session.plate || null,
    station: session.station || null,
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

// extraFields carrega o que precisa ser preservado ao renomear (meta,
// se pede pedido/cliente, e a posição de ordenação atual).
export async function renameActivity(oldName, newName, extraFields = {}) {
  const insertRes = await supabase.from("activities").insert({ name: newName, active: true, ...extraFields });
  if (insertRes.error) return insertRes;
  const deleteRes = await supabase.from("activities").delete().eq("name", oldName);
  if (deleteRes.error) {
    await supabase.from("activities").delete().eq("name", newName);
    return deleteRes;
  }
  return deleteRes;
}

export async function updateActivity(name, fields) {
  return supabase.from("activities").update(fields).eq("name", name);
}

export async function deleteActivity(name) {
  return supabase.from("activities").delete().eq("name", name);
}

// Troca a posição de duas atividades na lista (usado pelos botões
// de mover para cima/para baixo na tela Equipe). Se a segunda metade da
// troca falhar, desfaz a primeira — sem isso, as duas atividades podiam
// ficar com o mesmo valor de ordenação em caso de erro de rede no meio.
export async function swapActivityOrder(nameA, sortOrderA, nameB, sortOrderB) {
  const r1 = await supabase.from("activities").update({ sort_order: sortOrderB }).eq("name", nameA);
  if (r1.error) return r1;
  const r2 = await supabase.from("activities").update({ sort_order: sortOrderA }).eq("name", nameB);
  if (r2.error) {
    await supabase.from("activities").update({ sort_order: sortOrderA }).eq("name", nameA);
    return r2;
  }
  return r2;
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

// ---------- Erros de separação ----------

export const SEPARATION_ERROR_TYPES = ["Sobra de Material", "Não Tem no Pedido", "Falta de Material", "Outros"];

export async function fetchSeparationErrors(limit = 2000) {
  return supabase.from("separation_errors").select("*").order("created_at", { ascending: false }).limit(limit);
}

export async function logSeparationError({ operatorCode, operatorName, errorType, note, station = null }) {
  return supabase.from("separation_errors").insert({
    operator_code: operatorCode,
    operator_name: operatorName,
    error_type: errorType,
    note: note || null,
    station,
  });
}

// ---------- Tipos de erro (editável pelo admin) ----------

export async function fetchErrorTypes() {
  return supabase.from("error_types").select("*").eq("active", true).order("name");
}

export async function addErrorType(name) {
  return supabase.from("error_types").insert({ name, active: true });
}

export async function renameErrorType(oldName, newName) {
  const insertRes = await supabase.from("error_types").insert({ name: newName, active: true });
  if (insertRes.error) return insertRes;
  const deleteRes = await supabase.from("error_types").delete().eq("name", oldName);
  if (deleteRes.error) {
    await supabase.from("error_types").delete().eq("name", newName);
    return deleteRes;
  }
  return deleteRes;
}

export async function deleteErrorType(name) {
  return supabase.from("error_types").delete().eq("name", name);
}
