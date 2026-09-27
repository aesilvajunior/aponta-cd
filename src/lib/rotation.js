import { supabase } from "../supabaseClient";

// ============================================================
// Rotação de atividades da equipe
// (limpezas, organizações, inventários periódicos, etc)
// ============================================================

// ---------- Períodos ----------

export function getPeriodKey(type, date = new Date()) {
  if (type === "diaria") {
    return isoDate(date);
  }
  if (type === "semanal") {
    return getWeekKey(date);
  }
  if (type === "mensal") {
    return getMonthKey(date);
  }
  return isoDate(date);
}

function isoDate(d) {
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d - tz).toISOString().slice(0, 10);
}

function getWeekKey(d) {
  // Formato ISO: 2026-W39
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  const dayNr = (target.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  const diff = target - firstThursday;
  const week = 1 + Math.round(diff / (7 * 24 * 60 * 60 * 1000));
  return `${target.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

function getMonthKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function formatPeriodKey(periodKey, type) {
  if (type === "semanal") {
    const [year, week] = periodKey.split("-W");
    return `Semana ${parseInt(week, 10)} · ${year}`;
  }
  if (type === "mensal") {
    const [year, month] = periodKey.split("-");
    const names = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
    return `${names[parseInt(month, 10) - 1]}/${year}`;
  }
  // diária
  const [y, m, d] = periodKey.split("-");
  return `${d}/${m}/${y}`;
}

export function getPreviousPeriodKey(type, periodKey) {
  if (type === "diaria") {
    const d = new Date(periodKey + "T12:00:00");
    d.setDate(d.getDate() - 1);
    return isoDate(d);
  }
  if (type === "semanal") {
    const [year, week] = periodKey.split("-W");
    const w = parseInt(week, 10);
    if (w === 1) {
      const prevYear = parseInt(year, 10) - 1;
      const lastWeek = getWeeksInYear(prevYear);
      return `${prevYear}-W${String(lastWeek).padStart(2, "0")}`;
    }
    return `${year}-W${String(w - 1).padStart(2, "0")}`;
  }
  if (type === "mensal") {
    const [year, month] = periodKey.split("-");
    const m = parseInt(month, 10);
    if (m === 1) return `${parseInt(year, 10) - 1}-12`;
    return `${year}-${String(m - 1).padStart(2, "0")}`;
  }
  return periodKey;
}

function getWeeksInYear(year) {
  const d = new Date(year, 11, 31);
  return getISOWeek(d);
}

function getISOWeek(date) {
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  const dayNr = (target.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  const diff = target - firstThursday;
  return 1 + Math.round(diff / (7 * 24 * 60 * 60 * 1000));
}

// ---------- CRUD Tarefas ----------

export async function fetchRotationTasks() {
  const { data, error } = await supabase
    .from("rotation_tasks")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("name");
  return { data: data || [], error };
}

export async function addRotationTask({ name, description, frequency, sortOrder = 0 }) {
  return supabase.from("rotation_tasks").insert({
    name: name.trim(),
    description: description?.trim() || null,
    frequency,
    sort_order: sortOrder,
    active: true,
  });
}

export async function updateRotationTask(id, fields) {
  return supabase.from("rotation_tasks").update(fields).eq("id", id);
}

export async function deleteRotationTask(id) {
  return supabase.from("rotation_tasks").delete().eq("id", id);
}

// ---------- Assignments ----------

export async function fetchRotationAssignments(periodKey) {
  let query = supabase
    .from("rotation_assignments")
    .select("*")
    .order("created_at", { ascending: true });
  if (periodKey) query = query.eq("period_key", periodKey);
  const { data, error } = await query;
  return { data: data || [], error };
}

export async function addRotationAssignment({ taskId, operatorCode, operatorName, periodKey }) {
  return supabase
    .from("rotation_assignments")
    .insert({
      task_id: taskId,
      operator_code: operatorCode,
      operator_name: operatorName,
      period_key: periodKey,
      status: "pendente",
    })
    .select()
    .maybeSingle();
}

export async function updateAssignmentStatus(id, status, note = "") {
  return supabase
    .from("rotation_assignments")
    .update({
      status,
      completed_at: status === "concluida" ? new Date().toISOString() : null,
      note: note || null,
    })
    .eq("id", id);
}

export async function deleteRotationAssignment(id) {
  return supabase.from("rotation_assignments").delete().eq("id", id);
}

// ---------- Gerador automático de rotação ----------

// Distribui as tarefas ativas entre os operadores de forma round-robin
export async function autoRotateAssignments({ periodKey, frequency, taskIds, operators }) {
  if (!operators || operators.length === 0) {
    return { error: { message: "Nenhum operador disponível." } };
  }
  if (!taskIds || taskIds.length === 0) {
    return { error: { message: "Nenhuma tarefa selecionada." } };
  }

  // Remove assignments existentes desse período
  await supabase.from("rotation_assignments").delete().eq("period_key", periodKey);

  const rows = [];
  taskIds.forEach((taskId, idx) => {
    const op = operators[idx % operators.length];
    rows.push({
      task_id: taskId,
      operator_code: op.code,
      operator_name: op.name,
      period_key: periodKey,
      status: "pendente",
    });
  });

  const { data, error } = await supabase
    .from("rotation_assignments")
    .insert(rows)
    .select();

  return { data: data || [], error };
}