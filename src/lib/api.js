import { supabase } from "../supabaseClient";

// ============================================================
// OPERATORS
// ============================================================
export async function fetchOperators() {
  const { data, error } = await supabase.from("operators").select("*").order("code");
  return { data, error };
}

export async function addOperator({ code, name, role, canScheduleDelivery = false, canConference = false }) {
  return supabase.from("operators").insert({
    code,
    name,
    role,
    can_schedule_delivery: canScheduleDelivery,
    can_conference: canConference,
  });
}

export async function updateOperator(code, fields) {
  return supabase.from("operators").update(fields).eq("code", code);
}

export async function renameOperatorCode(oldCode, newCode, fields) {
  const { error: updError } = await supabase
    .from("operators")
    .update({
      code: newCode,
      name: fields.name,
      role: fields.role,
      can_schedule_delivery: fields.can_schedule_delivery,
      can_conference: fields.can_conference ?? false,
    })
    .eq("code", oldCode);
  if (updError) return { error: updError };

  const [{ error: entriesError }, { error: sessionsError }, { error: errorsError }] = await Promise.all([
    supabase.from("entries").update({ operator_code: newCode }).eq("operator_code", oldCode),
    supabase.from("active_sessions").update({ operator_code: newCode }).eq("operator_code", oldCode),
    supabase.from("separation_errors").update({ operator_code: newCode }).eq("operator_code", oldCode),
  ]);
  return { error: entriesError || sessionsError || errorsError || null };
}

export async function deleteOperator(code) {
  return supabase.from("operators").delete().eq("code", code);
}

// ============================================================
// ACTIVITIES
// ============================================================
export async function fetchActivities() {
  const { data, error } = await supabase
    .from("activities")
    .select("*")
    .eq("active", true)
    .order("sort_order", { ascending: true });
  return { data, error };
}

export async function addActivity(name, targetSeconds, requiresOrderInfo, extra = {}) {
  const { data: existing } = await supabase
    .from("activities")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder = existing ? (existing.sort_order || 0) + 1 : 0;

  return supabase.from("activities").insert({
    name,
    target_seconds: targetSeconds,
    requires_order_info: requiresOrderInfo,
    extra_field_type: extra.extra_field_type || "pedido",
    asks_shortage: extra.asks_shortage ?? null,
    sort_order: nextOrder,
    active: true,
  });
}

export async function updateActivity(name, fields) {
  return supabase.from("activities").update(fields).eq("name", name);
}

export async function renameActivity(oldName, newName) {
  const { error: updError } = await supabase
    .from("activities")
    .update({ name: newName })
    .eq("name", oldName);
  if (updError) return { error: updError };

  const [{ error: entriesError }, { error: sessionsError }] = await Promise.all([
    supabase.from("entries").update({ activity: newName }).eq("activity", oldName),
    supabase.from("active_sessions").update({ activity: newName }).eq("activity", oldName),
  ]);
  return { error: entriesError || sessionsError || null };
}

export async function swapActivityOrder(nameA, orderA, nameB, orderB) {
  const { error: e1 } = await supabase
    .from("activities")
    .update({ sort_order: orderB })
    .eq("name", nameA);
  if (e1) return { error: e1 };
  return supabase.from("activities").update({ sort_order: orderA }).eq("name", nameB);
}

export async function deleteActivity(name) {
  return supabase.from("activities").update({ active: false }).eq("name", name);
}

// ============================================================
// ERROR TYPES
// ============================================================
export async function fetchErrorTypes() {
  const { data, error } = await supabase.from("error_types").select("*").order("name");
  return { data, error };
}

export async function addErrorType(name) {
  return supabase.from("error_types").insert({ name });
}

export async function renameErrorType(oldName, newName) {
  const { error: insertError } = await supabase.from("error_types").insert({ name: newName });
  if (insertError) return { error: insertError };
  return supabase.from("error_types").delete().eq("name", oldName);
}

export async function deleteErrorType(name) {
  return supabase.from("error_types").delete().eq("name", name);
}

// ============================================================
// VEHICLES
// ============================================================
export async function fetchVehicles() {
  const { data, error } = await supabase.from("vehicles").select("*").order("plate");
  return { data, error };
}

export async function addVehicle({ plate, model }) {
  return supabase.from("vehicles").insert({ plate, model });
}

export async function updateVehicle(oldPlate, fields) {
  return supabase.from("vehicles").update(fields).eq("plate", oldPlate);
}

export async function deleteVehicle(plate) {
  return supabase.from("vehicles").delete().eq("plate", plate);
}

// ============================================================
// ADMIN CONFIG
// ============================================================
export async function fetchAdminConfig() {
  const { data, error } = await supabase
    .from("admin_config")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  return { data, error };
}

export async function updateAdminPin(pin) {
  return supabase.from("admin_config").update({ pin }).eq("id", 1);
}

export async function updateAlertThreshold(seconds) {
  return supabase.from("admin_config").update({ alert_threshold_seconds: seconds }).eq("id", 1);
}

// ============================================================
// ENTRIES
// ============================================================
export async function fetchEntries({ limit = 5000 } = {}) {
  const { data, error } = await supabase
    .from("entries")
    .select("*")
    .order("start_time", { ascending: false })
    .limit(limit);
  return { data, error };
}

export async function deleteAllEntries() {
  return supabase.from("entries").delete().neq("id", "00000000-0000-0000-0000-000000000000");
}

export async function updateEntry(id, fields) {
  return supabase.from("entries").update(fields).eq("id", id).select().maybeSingle();
}

export async function deleteEntry(id) {
  return supabase.from("entries").delete().eq("id", id);
}

export async function bulkDeleteEntries(ids) {
  if (!ids || ids.length === 0) return { error: null };
  return supabase.from("entries").delete().in("id", ids);
}

export async function addManualEntry({
  operatorCode, operatorName, activity, startTime, endTime,
  durationSeconds, shift, isEncaixe, shortages,
}) {
  const { data: entry, error } = await supabase
    .from("entries")
    .insert({
      operator_code: operatorCode,
      operator_name: operatorName,
      activity,
      start_time: startTime,
      end_time: endTime,
      duration_seconds: durationSeconds,
      shift,
      is_encaixe: isEncaixe,
      manual_entry: true,
      station: null,
    })
    .select()
    .maybeSingle();

  if (error) return { error };

  if (shortages && shortages.length > 0 && entry) {
    const rows = shortages.map((s) => ({
      entry_id: entry.id,
      product_code: s.productCode,
      quantity: s.quantity,
    }));
    await supabase.from("entry_shortages").insert(rows);
  }

  return { data: entry, error: null };
}

// ============================================================
// ACTIVE SESSIONS
// ============================================================
export async function fetchActiveSessions() {
  const { data, error } = await supabase
    .from("active_sessions")
    .select("*")
    .order("start_time", { ascending: true });
  return { data, error };
}

export async function fetchActiveSessionFor(operatorCode) {
  const { data, error } = await supabase
    .from("active_sessions")
    .select("*")
    .eq("operator_code", operatorCode)
    .maybeSingle();
  return { data, error };
}

export async function startSession({
  operatorCode, operatorName, activity, orderNumber, customerName,
  transferType, transferUrgent, transferNumber, vehicle, plate,
  station, isEncaixe, supplierName, invoiceNumber,
}) {
  const payload = {
    operator_code: operatorCode,
    operator_name: operatorName,
    activity,
    start_time: new Date().toISOString(),
    order_number: orderNumber || null,
    customer_name: customerName || null,
    transfer_type: transferType || null,
    transfer_urgent: transferUrgent ?? null,
    transfer_number: transferNumber || null,
    vehicle: vehicle || null,
    plate: plate || null,
    station: station || null,
    is_encaixe: isEncaixe || false,
    supplier_name: supplierName || null,
    invoice_number: invoiceNumber || null,
  };

  const { data, error } = await supabase
    .from("active_sessions")
    .insert(payload)
    .select()
    .maybeSingle();

  if (error && (error.message || "").includes("duplicate")) {
    return { error: { message: "OPERATOR_ALREADY_ACTIVE" } };
  }

  return { data, error };
}

// NOVA assinatura: aceita pausedSeconds (opcional, default 0)
export async function finishSession(session, durationSeconds, shift, note, isEncaixe, pausedSeconds = 0) {
  const entryPayload = {
    operator_code: session.operator_code,
    operator_name: session.operator_name,
    activity: session.activity,
    start_time: session.start_time,
    end_time: new Date().toISOString(),
    duration_seconds: durationSeconds,
    shift,
    order_number: session.order_number || null,
    customer_name: session.customer_name || null,
    transfer_type: session.transfer_type || null,
    transfer_urgent: session.transfer_urgent ?? null,
    transfer_number: session.transfer_number || null,
    vehicle: session.vehicle || null,
    plate: session.plate || null,
    supplier_name: session.supplier_name || null,
    invoice_number: session.invoice_number || null,
    station: session.station || null,
    is_encaixe: isEncaixe || false,
    manual_entry: false,
    note: note || null,
    paused_seconds: pausedSeconds || 0,
  };

  const { data: entry, error } = await supabase
    .from("entries")
    .insert(entryPayload)
    .select()
    .maybeSingle();

  if (error) return { error };

  await supabase.from("active_sessions").delete().eq("operator_code", session.operator_code);

  return { data: entry, error: null };
}

export async function updateActiveSession(operatorCode, fields) {
  return supabase
    .from("active_sessions")
    .update(fields)
    .eq("operator_code", operatorCode)
    .select()
    .maybeSingle();
}

export async function forceFinishActiveSession(session, note = "") {
  const now = new Date();
  const pausedSecs = session.total_paused_seconds || 0;
  const duration = Math.max(0, Math.round((now.getTime() - new Date(session.start_time).getTime()) / 1000) - pausedSecs);
  const shift = getShiftFor(session.start_time);

  const entryPayload = {
    operator_code: session.operator_code,
    operator_name: session.operator_name,
    activity: session.activity,
    start_time: session.start_time,
    end_time: now.toISOString(),
    duration_seconds: duration,
    shift,
    order_number: session.order_number || null,
    customer_name: session.customer_name || null,
    transfer_type: session.transfer_type || null,
    transfer_urgent: session.transfer_urgent ?? null,
    transfer_number: session.transfer_number || null,
    vehicle: session.vehicle || null,
    plate: session.plate || null,
    supplier_name: session.supplier_name || null,
    invoice_number: session.invoice_number || null,
    station: session.station || null,
    is_encaixe: session.is_encaixe || false,
    manual_entry: false,
    note: note || "[finalizada pelo admin]",
    paused_seconds: pausedSecs,
  };

  const { data: entry, error } = await supabase
    .from("entries")
    .insert(entryPayload)
    .select()
    .maybeSingle();

  if (error) return { error };

  await supabase.from("active_sessions").delete().eq("operator_code", session.operator_code);

  return { data: entry, error: null };
}

export async function cancelActiveSession(operatorCode) {
  return supabase.from("active_sessions").delete().eq("operator_code", operatorCode);
}

function getShiftFor(iso) {
  const d = new Date(iso);
  const h = d.getHours();
  if (h >= 6 && h < 14) return "Manhã";
  return "Tarde";
}

// ============================================================
// SHORTAGES
// ============================================================
export async function fetchShortages({ limit = 5000 } = {}) {
  const { data, error } = await supabase
    .from("entry_shortages")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  return { data, error };
}

// Aceita supplierName opcional
export async function saveShortages(entryId, shortages) {
  if (!shortages || shortages.length === 0) return { error: null };
  const rows = shortages.map((s) => ({
    entry_id: entryId,
    product_code: s.productCode,
    quantity: s.quantity,
    supplier_name: s.supplierName || null,
  }));
  return supabase.from("entry_shortages").insert(rows);
}

export async function deleteAllShortages() {
  return supabase.from("entry_shortages").delete().neq("id", 0);
}

export async function updateShortage(id, fields) {
  return supabase.from("entry_shortages").update(fields).eq("id", id).select().maybeSingle();
}

export async function deleteShortage(id) {
  return supabase.from("entry_shortages").delete().eq("id", id);
}

export async function deleteShortagesByEntry(entryId) {
  return supabase.from("entry_shortages").delete().eq("entry_id", entryId);
}

// ============================================================
// SEPARATION ERRORS
// ============================================================
export async function fetchSeparationErrors() {
  const { data, error } = await supabase
    .from("separation_errors")
    .select("*")
    .order("created_at", { ascending: false });
  return { data, error };
}

export async function logSeparationError({
  operatorCode, operatorName, errorType, note, station,
  orderType, orderNumber, errorOperatorCode, errorOperatorName,
}) {
  return supabase.from("separation_errors").insert({
    operator_code: operatorCode,
    operator_name: operatorName,
    error_type: errorType,
    note: note || null,
    station: station || null,
    order_type: orderType || null,
    order_number: orderNumber || null,
    error_operator_code: errorOperatorCode || null,
    error_operator_name: errorOperatorName || null,
  });
}

export async function deleteAllSeparationErrors() {
  return supabase.from("separation_errors").delete().neq("id", 0);
}

export async function updateSeparationError(id, fields) {
  return supabase.from("separation_errors").update(fields).eq("id", id).select().maybeSingle();
}

export async function deleteSeparationError(id) {
  return supabase.from("separation_errors").delete().eq("id", id);
}

// ============================================================
// AUDIT LOG
// ============================================================
export async function fetchAuditLog({ limit = 1000 } = {}) {
  const { data, error } = await supabase
    .from("audit_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  return { data, error };
}

export async function logAudit({
  actorCode, actorName, action, entity, entityId,
  details, beforeData, afterData,
}) {
  return supabase.from("audit_log").insert({
    actor_code: actorCode,
    actor_name: actorName,
    action,
    entity,
    entity_id: entityId,
    details,
    before_data: beforeData || null,
    after_data: afterData || null,
  });
}

export async function deleteAllAuditLog() {
  return supabase.from("audit_log").delete().neq("id", 0);
}

// ============================================================
// DELIVERY SCHEDULES
// ============================================================
export async function fetchSchedules({ limit = 2000 } = {}) {
  const { data, error } = await supabase
    .from("delivery_schedules")
    .select("*")
    .order("scheduled_at", { ascending: true })
    .limit(limit);
  return { data, error };
}

export async function addSchedule(payload) {
  return supabase
    .from("delivery_schedules")
    .insert({
      scheduled_date: payload.scheduledDate,
      scheduled_time: payload.scheduledTime,
      scheduled_at: payload.scheduledAt,
      supplier_name: payload.supplierName,
      invoice_number: payload.invoiceNumber,
      carrier: payload.carrier,
      purchase_order: payload.purchaseOrder,
      volume_weight: payload.volumeWeight,
      responsible_name: payload.responsibleName,
      observation: payload.observation,
      is_exception: payload.isException,
      exception_reason: payload.exceptionReason,
      created_by_code: payload.createdByCode,
      created_by_name: payload.createdByName,
    })
    .select()
    .maybeSingle();
}

export async function updateSchedule(id, fields) {
  return supabase.from("delivery_schedules").update(fields).eq("id", id);
}

export async function deleteSchedule(id) {
  return supabase.from("delivery_schedules").delete().eq("id", id);
}

export async function checkScheduleConflict(scheduledAt, excludeId = null) {
  const target = new Date(scheduledAt).getTime();
  const window = 30 * 60 * 1000;
  const from = new Date(target - window).toISOString();
  const to = new Date(target + window).toISOString();

  let query = supabase
    .from("delivery_schedules")
    .select("id, scheduled_at")
    .gte("scheduled_at", from)
    .lte("scheduled_at", to);

  if (excludeId) query = query.neq("id", excludeId);

  const { data, error } = await query;
  if (error) return { data: false, error };
  return { data: (data || []).length > 0, error: null };
}

export async function updateScheduleGoogleEventId(id, googleEventId) {
  return supabase
    .from("delivery_schedules")
    .update({ google_event_id: googleEventId })
    .eq("id", id);
}

// ============================================================
// SALES TEAM
// ============================================================
export async function fetchSalesLeaders() {
  const { data, error } = await supabase.from("sales_leaders").select("*").order("code");
  return { data, error };
}

export async function fetchSalesMembers() {
  const { data, error } = await supabase.from("sales_members").select("*").order("code");
  return { data, error };
}

export async function addSalesLeader({ code, name, teamName }) {
  return supabase.from("sales_leaders").insert({ code, name, team_name: teamName });
}

export async function updateSalesLeader(code, fields) {
  return supabase.from("sales_leaders").update(fields).eq("code", code);
}

export async function deleteSalesLeader(code) {
  return supabase.from("sales_leaders").delete().eq("code", code);
}

export async function addSalesMember({ code, name, role, leaderCode }) {
  return supabase.from("sales_members").insert({
    code,
    name,
    role,
    leader_code: leaderCode || null,
  });
}

export async function updateSalesMember(code, fields) {
  return supabase.from("sales_members").update(fields).eq("code", code);
}

export async function deleteSalesMember(code) {
  return supabase.from("sales_members").delete().eq("code", code);
}

export async function promoteMemberToLeader(memberCode, { leaderCode, teamName }) {
  const { data: member } = await supabase
    .from("sales_members")
    .select("*")
    .eq("code", memberCode)
    .maybeSingle();

  if (!member) return { error: { message: "Vendedor não encontrado." } };

  const { error: insErr } = await supabase.from("sales_leaders").insert({
    code: leaderCode,
    name: member.name,
    team_name: teamName,
  });
  if (insErr) return { error: insErr };

  const { error: updErr } = await supabase
    .from("sales_members")
    .update({ leader_code: null })
    .eq("leader_code", memberCode);

  const { error: delErr } = await supabase.from("sales_members").delete().eq("code", memberCode);

  return { error: updErr || delErr || null };
}

export async function demoteLeaderToMember(leaderCode) {
  const { data: leader } = await supabase
    .from("sales_leaders")
    .select("*")
    .eq("code", leaderCode)
    .maybeSingle();

  if (!leader) return { error: { message: "Líder não encontrado." } };

  const { error: delErr } = await supabase
    .from("sales_leaders")
    .delete()
    .eq("code", leaderCode);

  if (delErr) return { error: delErr };

  return { error: null };
}

// ============================================================
// CONFERENCE QUEUE
// ============================================================
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

export async function fetchConferenceHistory({ limit = 500 } = {}) {
  const { data, error } = await supabase
    .from("conference_queue")
    .select("*")
    .in("status", ["conferido", "com_problema"])
    .order("conference_finished_at", { ascending: false })
    .limit(limit);
  return { data: data || [], error };
}

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

export async function finishConference(id, operator, note = "") {
  const startedAt = await getConferenceStartedAt(id);
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

export async function reportConferenceProblem(id, operator, reason, note = "") {
  const startedAt = await getConferenceStartedAt(id);
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

async function getConferenceStartedAt(id) {
  const { data } = await supabase
    .from("conference_queue")
    .select("conference_started_at")
    .eq("id", id)
    .maybeSingle();
  return data?.conference_started_at || null;
}

export async function updateConferenceItem(id, fields) {
  return supabase
    .from("conference_queue")
    .update(fields)
    .eq("id", id)
    .select()
    .maybeSingle();
}

export async function deleteConferenceItem(id) {
  return supabase.from("conference_queue").delete().eq("id", id);
}

export async function resetConferenceItem(id) {
  return supabase
    .from("conference_queue")
    .update({
      status: "aguardando",
      conference_started_at: null,
      conference_started_by_code: null,
      conference_started_by_name: null,
      conference_finished_at: null,
      conference_finished_by_code: null,
      conference_finished_by_name: null,
      duration_seconds: null,
      problem_reason: null,
    })
    .eq("id", id)
    .select()
    .maybeSingle();
}