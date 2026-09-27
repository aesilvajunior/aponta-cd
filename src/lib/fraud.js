import { supabase } from "../supabaseClient";
import { localISODate } from "./format";

// ============================================================
// Detecção de fraude / padrões suspeitos
// ============================================================

const MIN_REASONABLE_SECONDS = 15;        // registros absurdamente curtos
const MAX_REASONABLE_SECONDS = 4 * 60 * 60; // 4h numa única atividade
const MANY_ENCAIXES_PER_DAY = 20;
const FEW_REGISTROS_PER_DAY = 3;
const SUSPICIOUS_SAME_CUSTOMER = 15;

// Analisa entries do operador e retorna lista de alertas
export function analyzeEntriesForFraud(entries, operators) {
  const alerts = [];
  const byOperator = {};
  entries.forEach((e) => {
    const key = e.operator_code;
    if (!byOperator[key]) byOperator[key] = [];
    byOperator[key].push(e);
  });

  Object.entries(byOperator).forEach(([code, list]) => {
    const op = operators.find((o) => o.code === code);
    const opName = op?.name || list[0]?.operator_name || code;

    // 1) Registros absurdamente curtos (<15s)
    const tooShort = list.filter((e) => (e.duration_seconds || 0) < MIN_REASONABLE_SECONDS);
    if (tooShort.length >= 3) {
      alerts.push({
        alert_type: "tempo_curto",
        severity: tooShort.length >= 8 ? "alta" : "media",
        operator_code: code,
        operator_name: opName,
        details: `${tooShort.length} registros com menos de ${MIN_REASONABLE_SECONDS}s`,
        context: { entries: tooShort.slice(0, 5).map((e) => ({ id: e.id, activity: e.activity, seconds: e.duration_seconds })) },
      });
    }

    // 2) Registros absurdamente longos (>4h)
    const tooLong = list.filter((e) => (e.duration_seconds || 0) > MAX_REASONABLE_SECONDS);
    if (tooLong.length >= 1) {
      alerts.push({
        alert_type: "tempo_longo",
        severity: "media",
        operator_code: code,
        operator_name: opName,
        details: `${tooLong.length} registro(s) com mais de 4 horas`,
        context: { entries: tooLong.slice(0, 5).map((e) => ({ id: e.id, activity: e.activity, seconds: e.duration_seconds })) },
      });
    }

    // 3) Muitos encaixes num único dia
    const byDay = {};
    list.forEach((e) => {
      const day = localISODate(e.start_time);
      if (!byDay[day]) byDay[day] = { total: 0, encaixes: 0 };
      byDay[day].total += 1;
      if (e.is_encaixe) byDay[day].encaixes += 1;
    });
    Object.entries(byDay).forEach(([day, { encaixes, total }]) => {
      if (encaixes >= MANY_ENCAIXES_PER_DAY) {
        alerts.push({
          alert_type: "muitos_encaixes",
          severity: "media",
          operator_code: code,
          operator_name: opName,
          details: `${encaixes} encaixes em ${day} (total do dia: ${total})`,
          context: { day, encaixes, total },
        });
      }
    });

    // 4) Poucos registros por dia (pode indicar não apontamento)
    //    Só alerta se o operador tem histórico médio maior
    const dayCounts = Object.values(byDay).map((d) => d.total);
    if (dayCounts.length >= 5) {
      const avg = dayCounts.reduce((a, b) => a + b, 0) / dayCounts.length;
      const suspiciousDays = Object.entries(byDay).filter(([_, d]) => d.total < FEW_REGISTROS_PER_DAY && avg >= 8);
      if (suspiciousDays.length >= 3) {
        alerts.push({
          alert_type: "poucos_registros",
          severity: "media",
          operator_code: code,
          operator_name: opName,
          details: `${suspiciousDays.length} dias com menos de ${FEW_REGISTROS_PER_DAY} registros (média geral ${avg.toFixed(1)})`,
          context: { days: suspiciousDays.map(([d]) => d) },
        });
      }
    }

    // 5) Sempre o mesmo cliente / pedido repetido
    const customersCount = {};
    list.forEach((e) => {
      if (!e.customer_name) return;
      const c = e.customer_name.toLowerCase().trim();
      customersCount[c] = (customersCount[c] || 0) + 1;
    });
    const topCustomer = Object.entries(customersCount).sort((a, b) => b[1] - a[1])[0];
    if (topCustomer && topCustomer[1] >= SUSPICIOUS_SAME_CUSTOMER) {
      alerts.push({
        alert_type: "padrao_estranho",
        severity: "baixa",
        operator_code: code,
        operator_name: opName,
        details: `${topCustomer[1]} registros para o mesmo cliente "${topCustomer[0]}"`,
        context: { customer: topCustomer[0], count: topCustomer[1] },
      });
    }
  });

  return alerts;
}

// Varre todos os entries recentes (últimos 30 dias) e cria alertas no banco
export async function scanAndPersistAlerts(entries, operators) {
  const alerts = analyzeEntriesForFraud(entries, operators);
  if (alerts.length === 0) return { inserted: 0 };

  // Filtra alertas que já existem (mesmo tipo + operador + details)
  const { data: existing } = await supabase
    .from("fraud_alerts")
    .select("alert_type, operator_code, details")
    .eq("resolved", false)
    .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

  const existingKeys = new Set((existing || []).map((a) => `${a.alert_type}|${a.operator_code}|${a.details}`));

  const newAlerts = alerts.filter((a) => !existingKeys.has(`${a.alert_type}|${a.operator_code}|${a.details}`));
  if (newAlerts.length === 0) return { inserted: 0 };

  const { error } = await supabase.from("fraud_alerts").insert(newAlerts);
  if (error) return { error, inserted: 0 };
  return { inserted: newAlerts.length };
}

// ---------- CRUD dos alertas ----------

export async function fetchFraudAlerts({ resolved = false, limit = 500 } = {}) {
  const { data, error } = await supabase
    .from("fraud_alerts")
    .select("*")
    .eq("resolved", resolved)
    .order("created_at", { ascending: false })
    .limit(limit);
  return { data: data || [], error };
}

export async function resolveFraudAlert(id, resolvedBy = "admin") {
  return supabase
    .from("fraud_alerts")
    .update({ resolved: true, resolved_by: resolvedBy, resolved_at: new Date().toISOString() })
    .eq("id", id);
}

export async function deleteFraudAlert(id) {
  return supabase.from("fraud_alerts").delete().eq("id", id);
}

export async function deleteAllResolvedFraudAlerts() {
  return supabase.from("fraud_alerts").delete().eq("resolved", true);
}

export const FRAUD_LABELS = {
  tempo_curto: "Registros muito curtos",
  tempo_longo: "Registros muito longos",
  muitos_encaixes: "Muitos encaixes num dia",
  poucos_registros: "Poucos registros por dia",
  padrao_estranho: "Padrão estranho",
};

export const SEVERITY_COLORS = {
  baixa: "var(--text-muted)",
  media: "var(--warning)",
  alta: "var(--danger)",
};