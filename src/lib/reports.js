import { supabase } from "../supabaseClient";

// ============================================================
// Agendamento de relatórios por email
// ============================================================

export const REPORT_TYPES = [
  { value: "apontamentos", label: "Apontamentos (histórico)" },
  { value: "faltas", label: "Faltas de material" },
  { value: "erros", label: "Erros de separação" },
  { value: "conferencia", label: "Conferência" },
  { value: "metas", label: "Progresso de metas" },
];

export const FREQUENCIES = [
  { value: "diario", label: "Diário" },
  { value: "semanal", label: "Semanal" },
  { value: "mensal", label: "Mensal" },
];

export const WEEKDAYS = [
  { value: 0, label: "Domingo" },
  { value: 1, label: "Segunda" },
  { value: 2, label: "Terça" },
  { value: 3, label: "Quarta" },
  { value: 4, label: "Quinta" },
  { value: 5, label: "Sexta" },
  { value: 6, label: "Sábado" },
];

export async function fetchScheduledReports() {
  const { data, error } = await supabase
    .from("scheduled_reports")
    .select("*")
    .order("created_at", { ascending: false });
  return { data: data || [], error };
}

export async function addScheduledReport({
  name,
  reportType,
  frequency,
  dayOfWeek,
  dayOfMonth,
  hour,
  emailTo,
  filters,
}) {
  return supabase
    .from("scheduled_reports")
    .insert({
      name: name.trim(),
      report_type: reportType,
      frequency,
      day_of_week: frequency === "semanal" ? dayOfWeek : null,
      day_of_month: frequency === "mensal" ? dayOfMonth : null,
      hour: hour ?? 8,
      email_to: emailTo.trim(),
      filters: filters || null,
      active: true,
    })
    .select()
    .maybeSingle();
}

export async function updateScheduledReport(id, fields) {
  return supabase.from("scheduled_reports").update(fields).eq("id", id);
}

export async function deleteScheduledReport(id) {
  return supabase.from("scheduled_reports").delete().eq("id", id);
}

export async function toggleScheduledReport(id, active) {
  return supabase.from("scheduled_reports").update({ active }).eq("id", id);
}

// Marca como enviado agora (usado pela Edge Function em produção)
export async function markReportAsSent(id) {
  return supabase
    .from("scheduled_reports")
    .update({ last_sent_at: new Date().toISOString() })
    .eq("id", id);
}

// Rótulos amigáveis
export function describeSchedule(report) {
  const f = FREQUENCIES.find((x) => x.value === report.frequency)?.label || report.frequency;
  let when = f;
  if (report.frequency === "semanal" && report.day_of_week != null) {
    const wd = WEEKDAYS.find((w) => w.value === report.day_of_week)?.label || "";
    when += ` · ${wd}`;
  }
  if (report.frequency === "mensal" && report.day_of_month) {
    when += ` · dia ${report.day_of_month}`;
  }
  if (report.hour != null) {
    when += ` às ${String(report.hour).padStart(2, "0")}h`;
  }
  return when;
}