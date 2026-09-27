import { supabase } from "../supabaseClient";

// ============================================================
// Metas individuais por operador
// ============================================================

// ---------- Períodos ----------

export function getGoalPeriodKey(type, date = new Date()) {
  if (type === "dia") {
    const tz = date.getTimezoneOffset() * 60000;
    return new Date(date - tz).toISOString().slice(0, 10);
  }
  if (type === "semana") {
    const target = new Date(date);
    target.setHours(0, 0, 0, 0);
    const dayNr = (target.getDay() + 6) % 7;
    target.setDate(target.getDate() - dayNr + 3);
    const firstThursday = new Date(target.getFullYear(), 0, 4);
    const diff = target - firstThursday;
    const week = 1 + Math.round(diff / (7 * 24 * 60 * 60 * 1000));
    return `${target.getFullYear()}-W${String(week).padStart(2, "0")}`;
  }
  // mes
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function formatGoalPeriod(periodKey, type) {
  if (type === "semana") {
    const [year, week] = periodKey.split("-W");
    return `Semana ${parseInt(week, 10)} · ${year}`;
  }
  if (type === "mes") {
    const [year, month] = periodKey.split("-");
    const names = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
    return `${names[parseInt(month, 10) - 1]} de ${year}`;
  }
  // dia
  const [y, m, d] = periodKey.split("-");
  return `${d}/${m}/${y}`;
}

// ---------- CRUD ----------

export async function fetchGoals({ periodType, periodKey, operatorCode } = {}) {
  let query = supabase.from("operator_goals").select("*").order("created_at", { ascending: false });
  if (periodType) query = query.eq("period_type", periodType);
  if (periodKey) query = query.eq("period_key", periodKey);
  if (operatorCode) query = query.eq("operator_code", operatorCode);
  const { data, error } = await query;
  return { data: data || [], error };
}

export async function fetchGoalsForCurrentPeriod() {
  const now = new Date();
  const monthKey = getGoalPeriodKey("mes", now);
  const weekKey = getGoalPeriodKey("semana", now);
  const dayKey = getGoalPeriodKey("dia", now);

  const { data, error } = await supabase
    .from("operator_goals")
    .select("*")
    .or(`and(period_type.eq.mes,period_key.eq.${monthKey}),and(period_type.eq.semana,period_key.eq.${weekKey}),and(period_type.eq.dia,period_key.eq.${dayKey})`);

  return { data: data || [], error };
}

export async function upsertGoal({ operatorCode, operatorName, periodType, periodKey, goalCount, goalAvgSeconds, note }) {
  const payload = {
    operator_code: operatorCode,
    operator_name: operatorName,
    period_type: periodType,
    period_key: periodKey,
    goal_count: goalCount ?? null,
    goal_avg_seconds: goalAvgSeconds ?? null,
    note: note || null,
  };

  const { data, error } = await supabase
    .from("operator_goals")
    .upsert(payload, { onConflict: "operator_code,period_type,period_key" })
    .select()
    .maybeSingle();

  return { data, error };
}

export async function deleteGoal(id) {
  return supabase.from("operator_goals").delete().eq("id", id);
}

// ---------- Cálculo de progresso ----------

// Retorna { count, avgSeconds, goalsMet: { count: bool|null, avg: bool|null } }
export function computeGoalProgress(goal, entries) {
  const list = entries.filter((e) => e.operator_code === goal.operator_code);
  const count = list.length;
  const totalSec = list.reduce((sum, e) => sum + (e.duration_seconds || 0), 0);
  const avgSeconds = count > 0 ? Math.round(totalSec / count) : 0;

  const goalsMet = {
    count: goal.goal_count != null ? count >= goal.goal_count : null,
    avg: goal.goal_avg_seconds != null && count > 0 ? avgSeconds <= goal.goal_avg_seconds : null,
  };

  return { count, avgSeconds, goalsMet };
}

// Filtra entries pelo período da meta
export function filterEntriesByGoalPeriod(entries, periodType, periodKey) {
  return entries.filter((e) => {
    const d = new Date(e.start_time);

    if (periodType === "dia") {
      const tz = d.getTimezoneOffset() * 60000;
      const key = new Date(d - tz).toISOString().slice(0, 10);
      return key === periodKey;
    }

    if (periodType === "semana") {
      const target = new Date(d);
      target.setHours(0, 0, 0, 0);
      const dayNr = (target.getDay() + 6) % 7;
      target.setDate(target.getDate() - dayNr + 3);
      const firstThursday = new Date(target.getFullYear(), 0, 4);
      const diff = target - firstThursday;
      const week = 1 + Math.round(diff / (7 * 24 * 60 * 60 * 1000));
      const key = `${target.getFullYear()}-W${String(week).padStart(2, "0")}`;
      return key === periodKey;
    }

    // mes
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return key === periodKey;
  });
}