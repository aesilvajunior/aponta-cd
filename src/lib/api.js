import { supabase } from "../supabaseClient";

// Centraliza todo o acesso ao banco em um só lugar.

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

export async function fetchEntries({ limit = 2000, since = null } = {}) {
  let q = supabase.from("entries").select("*").order("start_time", { ascending: false }).limit(limit);
  if (since) q = q.gte("start_time", since);
  return q;
}

export async function fetchActiveSessions() {
  return supabase.from("active_sessions").select("*");
}

export async function fetchActiveSessionFor(operatorCode) {
  return supabase.from("active_sessions").select("*").eq("operator_code", operatorCode).maybeSingle();
}

// ---------- Veículos ----------

export async function fetchVehicles() {
  return supabase.from("vehicles").select("*").eq("active", true).order("sort_order", { ascending: true });
}

export async function addVehicle({ plate, model }) {
  return supabase.from("vehicles").insert({ plate: plate.trim().toUpperCase(), model: model.trim(), active: true });
}

export async function updateVehicle(oldPlate, fields) {
  const plate = fields.plate ? fields.plate.trim().toUpperCase() : oldPlate;
  const model = fields.model ? fields.model.trim() : undefined;
  const payload = {};
  if (plate !== oldPlate) payload.plate = plate;
  if (model !== undefined) payload.model = model;
  if (Object.keys(payload).length === 0) return { error: null };
  return supabase.from("vehicles").update(payload).eq("plate", oldPlate);
}

export async function deleteVehicle(plate) {
  return supabase.from("vehicles").delete().eq("plate", plate);
}

// ---------- Ações do quiosque (via RPC atômica) ----------

export async function startSession({
  operatorCode, operatorName, activity,
  orderNumber = null, customerName = null, transferType = null,
  transferUrgent = null, transferNumber = null,
  vehicle = null, plate = null, station = null,
  isEncaixe = false,
  supplierName = null, invoiceNumber = null,
}) {
  return supabase.rpc("start_session_atomic", {
    p_operator_code: operatorCode,
    p_operator_name: operatorName,
    p_activity: activity,
    p_order_number: orderNumber,
    p_customer_name: customerName,
    p_transfer_type: transferType,
    p_transfer_urgent: transferUrgent,
    p_transfer_number: transferNumber,
    p_vehicle: vehicle,
    p_plate: plate,
    p_station: station,
    p_is_encaixe: isEncaixe,
    p_supplier_name: supplierName,
    p_invoice_number: invoiceNumber,
  });
}

export async function finishSession(session, durationSeconds, shift, note = null, isEncaixe = false) {
  return supabase.rpc("finish_session_atomic", {
    p_operator_code: session.operator_code,
    p_operator_name: session.operator_name,
    p_activity: session.activity,
    p_start_time: session.start_time,
    p_end_time: new Date().toISOString(),
    p_duration_seconds: durationSeconds,
    p_shift: shift,
    p_note: note || null,
    p_order_number: session.order_number || null,
    p_customer_name: session.customer_name || null,
    p_transfer_type: session.transfer_type || null,
    p_transfer_urgent: session.transfer_urgent ?? null,
    p_transfer_number: session.transfer_number || null,
    p_vehicle: session.vehicle || null,
    p_plate: session.plate || null,
    p_station: session.station || null,
    p_is_encaixe: isEncaixe || !!session.is_encaixe,
    p_supplier_name: session.supplier_name || null,
    p_invoice_number: session.invoice_number || null,
  });
}

// ---------- Faltas ----------

export async function saveShortages(entryId, shortages) {
  if (!entryId || !shortages || shortages.length === 0) return { error: null };
  const rows = shortages.map((s) => ({
    entry_id: entryId,
    product_code: String(s.productCode).trim(),
    quantity: Number(s.quantity) || 1,
  }));
  return supabase.from("entry_shortages").insert(rows);
}

export async function fetchShortages({ limit = 2000 } = {}) {
  return supabase
    .from("entry_shortages")
    .select(`
      id,
      entry_id,
      product_code,
      quantity,
      created_at,
      entries:entry_id (
        id,
        operator_name,
        operator_code,
        activity,
        order_number,
        customer_name,
        shift,
        start_time,
        end_time,
        is_encaixe
      )
    `)
    .order("created_at", { ascending: false })
    .limit(limit);
}

export async function deleteAllShortages() {
  return supabase.rpc("delete_all_shortages");
}

// ---------- Operadores ----------

export async function addOperator({ code, name, role, canScheduleDelivery = false }) {
  return supabase.from("operators").insert({
    code,
    name,
    role: role || "-",
    can_schedule_delivery: canScheduleDelivery,
  });
}

export async function updateOperator(code, fields) {
  return supabase.from("operators").update(fields).eq("code", code);
}

export async function renameOperatorCode(oldCode, newCode, fields) {
  const insertRes = await supabase.from("operators").insert({ code: newCode, ...fields });
  if (insertRes.error) return insertRes;
  const deleteRes = await supabase.from("operators").delete().eq("code", oldCode);
  if (deleteRes.error) {
    await supabase.from("operators").delete().eq("code", newCode);
    return deleteRes;
  }
  return deleteRes;
}

export async function deleteOperator(code) {
  return supabase.from("operators").delete().eq("code", code);
}

// ---------- Atividades ----------

export async function addActivity(name, targetSeconds = null, asksShortage = null) {
  return supabase.from("activities").insert({
    name,
    active: true,
    target_seconds: targetSeconds,
    asks_shortage: asksShortage,
  });
}

export async function renameActivity(oldName, newName) {
  return supabase.rpc("rename_activity_atomic", { p_old: oldName, p_new: newName });
}

export async function updateActivity(name, fields) {
  return supabase.from("activities").update(fields).eq("name", name);
}

export async function deleteActivity(name) {
  return supabase.from("activities").delete().eq("name", name);
}

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

export async function updateAlertThreshold(seconds) {
  const value = Math.max(60, Number(seconds) || 1800);
  return supabase.from("admin_config").update({ alert_threshold_seconds: value }).eq("id", 1);
}

export async function deleteAllEntries() {
  return supabase.rpc("delete_all_entries");
}

export async function addManualEntry({
  operatorCode, operatorName, activity, startTime, endTime, durationSeconds, shift,
  isEncaixe = false, shortages = [],
}) {
  const insertRes = await supabase.from("entries").insert({
    operator_code: operatorCode,
    operator_name: operatorName,
    activity,
    start_time: startTime,
    end_time: endTime,
    duration_seconds: durationSeconds,
    shift,
    manual_entry: true,
    is_encaixe: isEncaixe,
  }).select("id").single();

  if (insertRes.error) return insertRes;

  if (shortages.length > 0) {
    const shortageRes = await saveShortages(insertRes.data.id, shortages);
    if (shortageRes.error) return shortageRes;
  }

  return insertRes;
}

// ---------- Erros de separação ----------

export async function fetchSeparationErrors(limit = 2000) {
  return supabase.from("separation_errors").select("*").order("created_at", { ascending: false }).limit(limit);
}

export async function logSeparationError({
  operatorCode,
  operatorName,
  errorType,
  note,
  station = null,
  orderType = null,
  orderNumber = null,
  errorOperatorCode = null,
  errorOperatorName = null,
}) {
  return supabase.from("separation_errors").insert({
    operator_code: operatorCode,
    operator_name: operatorName,
    error_type: errorType,
    note: note || null,
    station,
    order_type: orderType,
    order_number: orderNumber,
    error_operator_code: errorOperatorCode,
    error_operator_name: errorOperatorName,
  });
}

export async function deleteAllSeparationErrors() {
  return supabase.rpc("delete_all_separation_errors");
}

// ---------- Tipos de erro ----------

export async function fetchErrorTypes() {
  return supabase.from("error_types").select("*").eq("active", true).order("name");
}

export async function addErrorType(name) {
  return supabase.from("error_types").insert({ name, active: true });
}

export async function renameErrorType(oldName, newName) {
  return supabase.rpc("rename_error_type_atomic", { p_old: oldName, p_new: newName });
}

export async function deleteErrorType(name) {
  return supabase.from("error_types").delete().eq("name", name);
}

// ---------- Auditoria ----------

export async function logAudit({ actorCode, actorName, action, entity, entityId, details, beforeData, afterData }) {
  return supabase.from("audit_log").insert({
    actor_code: actorCode || null,
    actor_name: actorName || null,
    action,
    entity,
    entity_id: entityId || null,
    details: details || null,
    before_data: beforeData || null,
    after_data: afterData || null,
  });
}

export async function fetchAuditLog({ limit = 500, entity = null, action = null, actorCode = null, since = null } = {}) {
  let q = supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(limit);
  if (entity) q = q.eq("entity", entity);
  if (action) q = q.eq("action", action);
  if (actorCode) q = q.eq("actor_code", actorCode);
  if (since) q = q.gte("created_at", since);
  return q;
}

export async function deleteAllAuditLog() {
  return supabase.rpc("delete_all_audit_log");
}

// ====================================================================
// AGENDAMENTOS DE RECEBIMENTO
// ====================================================================

export async function fetchSchedules({ limit = 500, fromDate = null, toDate = null } = {}) {
  let q = supabase.from("delivery_schedules").select("*").order("scheduled_at", { ascending: true }).limit(limit);
  if (fromDate) q = q.gte("scheduled_date", fromDate);
  if (toDate) q = q.lte("scheduled_date", toDate);
  return q;
}

export async function checkScheduleConflict(scheduledAt, excludeId = null) {
  return supabase.rpc("check_schedule_conflict", {
    p_scheduled_at: scheduledAt,
    p_exclude_id: excludeId,
  });
}

export async function addSchedule({
  scheduledDate,
  scheduledTime,
  scheduledAt,
  supplierName,
  invoiceNumber,
  carrier = null,
  purchaseOrder = null,
  volumeWeight,
  responsibleName,
  observation = null,
  isException = false,
  exceptionReason = null,
  createdByCode = null,
  createdByName = null,
}) {
  return supabase.from("delivery_schedules").insert({
    scheduled_date: scheduledDate,
    scheduled_time: scheduledTime,
    scheduled_at: scheduledAt,
    supplier_name: supplierName,
    invoice_number: invoiceNumber,
    carrier,
    purchase_order: purchaseOrder,
    volume_weight: volumeWeight,
    responsible_name: responsibleName,
    observation,
    is_exception: isException,
    exception_reason: exceptionReason,
    created_by_code: createdByCode,
    created_by_name: createdByName,
  }).select("id").single();
}

export async function updateSchedule(id, fields) {
  return supabase.from("delivery_schedules").update(fields).eq("id", id);
}

export async function deleteSchedule(id) {
  return supabase.from("delivery_schedules").delete().eq("id", id);
}

export async function updateScheduleGoogleEventId(id, googleEventId) {
  return supabase.from("delivery_schedules").update({ google_event_id: googleEventId }).eq("id", id);
}