// ============================================================
// Aponta CD — Rotação de atividades v2
// - Tarefas rotativas (round-robin por dia)
// - Tarefas equipe_fixa (caminhão → mesmos operadores todos os dias)
// ============================================================
import { supabase } from "../supabaseClient";

// ---------- utilidades de data ----------
export function getMondayOfWeek(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

export function isoDate(d) {
  const dt = d instanceof Date ? d : new Date(d);
  const tz = dt.getTimezoneOffset() * 60000;
  return new Date(dt - tz).toISOString().slice(0, 10);
}

export function addDays(d, n) {
  const dt = new Date(d);
  dt.setDate(dt.getDate() + n);
  return dt;
}

export const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
export const WEEKDAY_LONG = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

// Retorna array de 7 datas ISO a partir de uma segunda-feira
export function weekDates(monday) {
  const out = [];
  for (let i = 0; i < 7; i++) out.push(isoDate(addDays(monday, i)));
  return out;
}

// ============================================================
// DB — TAREFAS
// ============================================================
export async function fetchRotationTasks() {
  const { data, error } = await supabase
    .from("rotation_tasks")
    .select("*")
    .eq("active", true)
    .order("sort_order");
  return { data: data || [], error };
}

export async function addRotationTask({
  name, category, kind = "rotativa", daysOfWeek = [1, 2, 3, 4, 5], sortOrder = 0,
}) {
  return supabase.from("rotation_tasks").insert({
    name,
    category,
    kind,
    days_of_week: daysOfWeek,
    sort_order: sortOrder,
    active: true,
  }).select().maybeSingle();
}

export async function updateRotationTask(id, fields) {
  return supabase.from("rotation_tasks").update(fields).eq("id", id).select().maybeSingle();
}

export async function deleteRotationTask(id) {
  return supabase.from("rotation_tasks").update({ active: false }).eq("id", id);
}

// ============================================================
// DB — ASSIGNMENTS
// ============================================================
export async function fetchRotationAssignments({ from, to } = {}) {
  let q = supabase.from("rotation_assignments").select("*");
  if (from) q = q.gte("scheduled_date", from);
  if (to) q = q.lte("scheduled_date", to);
  const { data, error } = await q;
  return { data: data || [], error };
}

// Substitui todos os assignments de (task, date) pelos novos
export async function setCellAssignments({ taskId, scheduledDate, operators }) {
  await supabase
    .from("rotation_assignments")
    .delete()
    .eq("task_id", taskId)
    .eq("scheduled_date", scheduledDate);

  if (!operators || operators.length === 0) return { error: null };

  const rows = operators.map((op) => ({
    task_id: taskId,
    scheduled_date: scheduledDate,
    operator_code: op.code,
    operator_name: op.name,
    note: null,
  }));
  return supabase.from("rotation_assignments").insert(rows);
}

// Apaga todos os assignments de uma semana
export async function clearWeekAssignments(fromDate, toDate) {
  return supabase
    .from("rotation_assignments")
    .delete()
    .gte("scheduled_date", fromDate)
    .lte("scheduled_date", toDate);
}

// ============================================================
// MOTOR — GERAÇÃO AUTOMÁTICA
// ============================================================

// Filtra operadores por papel compatível com a categoria
export function operatorsForCategory(operators, category) {
  const map = {
    "Carregamento": ["carregamento", "separacao"],
    "Separação": ["separacao"],
    "Limpeza": ["limpeza", "separacao"],
    "Recebimento": ["recebimento"],
    "Conferência": ["conferencia"],
  };
  const allowed = map[category];
  if (!allowed) return operators;
  return operators.filter((op) => {
    const roles = Array.isArray(op.roles) ? op.roles : [];
    return roles.some((r) => allowed.includes(r));
  });
}

/**
 * Gera a rotação para uma semana inteira.
 * @param {Object} args
 *  - tasks: array de rotation_tasks
 *  - operators: array de operators (com .roles)
 *  - mondayISO: 'YYYY-MM-DD' da segunda-feira da semana
 *  - overrides: { [taskId]: { [dateISO]: operator[] } } — mantém o que o usuário já editou
 * @returns Array de rows para inserir em rotation_assignments
 */
export function generateRotation({ tasks, operators, mondayISO, overrides = {} }) {
  const rows = [];

  const monday = new Date(mondayISO + "T12:00:00");
  const dates = weekDates(monday); // 7 datas ISO

  // Agrupa tarefas por categoria
  const byCategory = {};
  tasks.forEach((t) => {
    if (!byCategory[t.category]) byCategory[t.category] = [];
    byCategory[t.category].push(t);
  });

  Object.entries(byCategory).forEach(([category, catTasks]) => {
    const pool = operatorsForCategory(operators, category);
    if (pool.length === 0) return;

    // Ordena por sort_order
    const sortedTasks = [...catTasks].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

    // Offset rotativo acumulado por dia
    let rotationIndex = 0;

    dates.forEach((dateISO, dayIdx) => {
      // Dia da semana (0..6)
      const weekday = new Date(dateISO + "T12:00:00").getDay();

      sortedTasks.forEach((task, taskIdx) => {
        const days = task.days_of_week || [1, 2, 3, 4, 5];
        if (!days.includes(weekday)) return;

        const overrideKey = `${task.id}`;
        const existing = overrides[overrideKey]?.[dateISO];
        if (existing) {
          existing.forEach((op) => {
            rows.push({
              task_id: task.id,
              scheduled_date: dateISO,
              operator_code: op.code,
              operator_name: op.name,
              note: null,
            });
          });
          return;
        }

        if (task.kind === "equipe_fixa") {
          // Equipe fixa: usamos os primeiros N do pool (N = 2 por padrão) — o
          // usuário pode depois ajustar célula a célula.
          const teamSize = Math.min(2, pool.length);
          for (let k = 0; k < teamSize; k++) {
            const op = pool[(taskIdx + k) % pool.length];
            rows.push({
              task_id: task.id,
              scheduled_date: dateISO,
              operator_code: op.code,
              operator_name: op.name,
              note: null,
            });
          }
        } else {
          // Rotativa: round-robin por dia
          const op = pool[(taskIdx + rotationIndex) % pool.length];
          rows.push({
            task_id: task.id,
            scheduled_date: dateISO,
            operator_code: op.code,
            operator_name: op.name,
            note: null,
          });
        }
      });

      // Avança o offset por dia (rotaciona a "linha" do pool)
      rotationIndex = (rotationIndex + 1) % pool.length;
    });
  });

  return rows;
}

// Persiste a rotação gerada
export async function persistRotation(rows) {
  if (!rows || rows.length === 0) return { error: null };
  return supabase.from("rotation_assignments").insert(rows);
}

// Exportar CSV simples
export function rotationToCsv({ tasks, dates, assignmentMap, categories }) {
  const lines = [];

  categories.forEach((cat) => {
    lines.push("");
    lines.push(cat.toUpperCase());
    const header = ["Tarefa", ...dates.map((d) => {
      const wd = WEEKDAY_LABELS[new Date(d + "T12:00:00").getDay()];
      const dd = d.slice(8, 10);
      const mm = d.slice(5, 7);
      return `${wd} ${dd}/${mm}`;
    })];
    lines.push(header.join(";"));
    tasks
      .filter((t) => t.category === cat)
      .forEach((t) => {
        const row = [t.name];
        dates.forEach((d) => {
          const key = `${t.id}|${d}`;
          const ops = assignmentMap[key] || [];
          row.push(ops.map((o) => o.operator_name).join(", "));
        });
        lines.push(row.join(";"));
      });
  });

  return lines.join("\r\n");
}