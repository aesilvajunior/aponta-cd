import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart, Bar, LineChart, Line, Legend, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { fmtClock, fmtDate, fmtDuration } from "../lib/format";
import { computeMetrics, computeWeeklyTrend, computeMonthlyBuckets, monthLabel, mean as meanM } from "../lib/metrics";
import logo from "../assets/logo.png";

const COLORS = ["#FFB020", "#34D399", "#F87171", "#60A5FA", "#C084FC", "#FB923C", "#22D3EE", "#A3A3A3"];
const DEFAULT_ALERT_SECONDS = 45 * 60;

function todayLocalISODate() {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d - tz).toISOString().slice(0, 10);
}

export default function Panel({ entries, activities, operators, activeSessions, separationErrors = [], onResetEntries }) {
  const [filterOperator, setFilterOperator] = useState("");
  const [filterActivity, setFilterActivity] = useState("");
  const [filterShift, setFilterShift] = useState("");
  const [filterStation, setFilterStation] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [confirmingReset, setConfirmingReset] = useState(false);
  const [resetPhrase, setResetPhrase] = useState("");
  const [resetting, setResetting] = useState(false);

  const [copyLabel, setCopyLabel] = useState("Copiar resumo do dia");
  const [soundEnabled, setSoundEnabled] = useState(false);
  const alertedRef = useRef(new Set());

  // Atualiza a cada 15s só para os alertas de "atividade em andamento há
  // muito tempo" recalcularem sozinhos, sem precisar de ação do admin.
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(iv);
  }, []);

  const dateFilteredEntries = useMemo(() => {
    return entries.filter((e) => {
      const d = new Date(e.start_time);
      if (dateFrom) {
        const from = new Date(dateFrom + "T00:00:00");
        if (d < from) return false;
      }
      if (dateTo) {
        const to = new Date(dateTo + "T23:59:59");
        if (d > to) return false;
      }
      return true;
    });
  }, [entries, dateFrom, dateTo]);

  const metrics = useMemo(() => computeMetrics(dateFilteredEntries, activities), [dateFilteredEntries, activities]);

  const volumeLeader = useMemo(() => {
    if (metrics.opStats.length === 0) return null;
    return [...metrics.opStats].sort((a, b) => b.registros - a.registros)[0];
  }, [metrics.opStats]);

  const filteredEntries = useMemo(() => {
    return dateFilteredEntries
      .filter((e) => !filterOperator || e.operator_code === filterOperator)
      .filter((e) => !filterActivity || e.activity === filterActivity)
      .filter((e) => !filterShift || e.shift === filterShift)
      .filter((e) => !filterStation || e.station === filterStation)
      .sort((a, b) => new Date(b.start_time) - new Date(a.start_time));
  }, [dateFilteredEntries, filterOperator, filterActivity, filterShift, filterStation]);

  const knownStations = useMemo(() => {
    const set = new Set();
    entries.forEach((e) => e.station && set.add(e.station));
    return Array.from(set).sort();
  }, [entries]);

  // ---------- Alerta de atividade demorada ----------
  // Prioridade do limite: meta definida pelo admin (com folga de 30%) >
  // média histórica da atividade (com folga de 60%) > padrão fixo de 45min.
  const activityAlerts = useMemo(() => {
    return activeSessions
      .map((s) => {
        const elapsed = Math.round((now - new Date(s.start_time).getTime()) / 1000);
        const activityConfig = activities.find((a) => a.name === s.activity);
        const historicalAvg = metrics.avgByActivity.find((a) => a.name === s.activity)?.media;
        let threshold = DEFAULT_ALERT_SECONDS;
        if (activityConfig?.target_seconds) {
          threshold = activityConfig.target_seconds * 1.3;
        } else if (historicalAvg) {
          threshold = historicalAvg * 1.6;
        }
        return { ...s, elapsed, threshold, isLate: elapsed > threshold };
      })
      .filter((s) => s.isLate)
      .sort((a, b) => b.elapsed - a.elapsed);
  }, [activeSessions, activities, metrics.avgByActivity, now]);

  function playAlertBeep() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.value = 0.18;
      osc.start();
      osc.stop(ctx.currentTime + 0.28);
    } catch {
      // Áudio bloqueado pelo navegador — segue sem som.
    }
  }

  function toggleSound() {
    const next = !soundEnabled;
    setSoundEnabled(next);
    if (next) {
      // Precisa de um gesto do usuário pra "destravar" áudio e notificação
      // no navegador — este clique serve pra isso.
      playAlertBeep();
      if (typeof Notification !== "undefined" && Notification.permission === "default") {
        Notification.requestPermission();
      }
    }
  }

  // Toca o som/mostra notificação só quando um alerta é NOVO — evita
  // ficar apitando o tempo todo enquanto o mesmo alerta continua ativo.
  useEffect(() => {
    if (!soundEnabled) return;
    const currentKeys = new Set(activityAlerts.map((a) => a.operator_code));
    activityAlerts.forEach((a) => {
      if (!alertedRef.current.has(a.operator_code)) {
        playAlertBeep();
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          new Notification("Atividade demorada", {
            body: `${a.operator_name} — ${a.activity} — ${fmtDuration(a.elapsed)}`,
          });
        }
      }
    });
    alertedRef.current = currentKeys;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activityAlerts, soundEnabled]);

  // ---------- Meta vs real ----------
  const targetComparison = useMemo(() => {
    return activities
      .filter((a) => a.target_seconds)
      .map((a) => {
        const real = metrics.avgByActivity.find((m) => m.name === a.name);
        const media = real?.media ?? 0;
        const deltaPct = media > 0 ? Math.round(((media - a.target_seconds) / a.target_seconds) * 100) : null;
        return { name: a.name, target: a.target_seconds, media, registros: real?.registros ?? 0, deltaPct };
      });
  }, [activities, metrics.avgByActivity]);

  // ---------- Cobertura de rodízio ----------
  const coverage = useMemo(() => {
    return operators.map((op) => {
      const opEntries = dateFilteredEntries.filter((e) => e.operator_code === op.code);
      const counts = {};
      activities.forEach((a) => {
        counts[a.name] = opEntries.filter((e) => e.activity === a.name).length;
      });
      const done = activities.filter((a) => counts[a.name] > 0).length;
      return { operator: op, counts, done, total: activities.length };
    });
  }, [operators, activities, dateFilteredEntries]);

  // ---------- Tendência semanal ----------
  const weeklyTrend = useMemo(() => computeWeeklyTrend(dateFilteredEntries, activities), [dateFilteredEntries, activities]);

  // ---------- Erros de separação ----------
  const dateFilteredErrors = useMemo(() => {
    return separationErrors.filter((e) => {
      const d = new Date(e.created_at);
      if (dateFrom && d < new Date(dateFrom + "T00:00:00")) return false;
      if (dateTo && d > new Date(dateTo + "T23:59:59")) return false;
      return true;
    });
  }, [separationErrors, dateFrom, dateTo]);

  const errorsByType = useMemo(() => {
    const byType = {};
    dateFilteredErrors.forEach((e) => {
      byType[e.error_type] = (byType[e.error_type] || 0) + 1;
    });
    return Object.entries(byType)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total);
  }, [dateFilteredErrors]);

  function exportErrorsCSV() {
    const header = "Operador,Codigo,Tipo,Observacao,Data,Hora\n";
    const rows = dateFilteredErrors.map((e) =>
      [e.operator_name, e.operator_code, e.error_type, (e.note || "").replace(/,/g, ";"), fmtDate(e.created_at), fmtClock(e.created_at)].join(",")
    );
    const csv = header + rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `erros_separacao_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ---------- Comparação mês a mês ----------
  const monthlyBuckets = useMemo(() => computeMonthlyBuckets(entries, activities), [entries, activities]);
  const availableMonths = useMemo(() => Object.keys(monthlyBuckets).sort(), [monthlyBuckets]);
  const [monthA, setMonthA] = useState("");
  const [monthB, setMonthB] = useState("");

  useEffect(() => {
    if (availableMonths.length === 0) return;
    if (!monthA && !monthB) {
      const last = availableMonths[availableMonths.length - 1];
      const prev = availableMonths[availableMonths.length - 2] || last;
      setMonthA(prev);
      setMonthB(last);
    }
  }, [availableMonths, monthA, monthB]);

  const monthComparisonRows = useMemo(() => {
    if (!monthA || !monthB) return [];
    const statsA = monthlyBuckets[monthA];
    const statsB = monthlyBuckets[monthB];
    if (!statsA || !statsB) return [];
    return activities.map((act) => {
      const a = statsA.avgByActivity.find((x) => x.name === act.name);
      const b = statsB.avgByActivity.find((x) => x.name === act.name);
      const mediaA = a?.media ?? 0;
      const mediaB = b?.media ?? 0;
      const deltaPct = mediaA > 0 && mediaB > 0 ? Math.round(((mediaB - mediaA) / mediaA) * 100) : null;
      return { name: act.name, mediaA, registrosA: a?.registros ?? 0, mediaB, registrosB: b?.registros ?? 0, deltaPct };
    });
  }, [monthA, monthB, monthlyBuckets, activities]);

  function clearFilters() {
    setFilterOperator("");
    setFilterActivity("");
    setFilterShift("");
    setFilterStation("");
    setDateFrom("");
    setDateTo("");
  }

  function exportCSV() {
    const header = "Operador,Codigo,Atividade,Data,Turno,Estacao,Inicio,Fim,Duracao(s),Manual,Pedido,Cliente,TipoTransferencia,Veiculo,Placa\n";
    const rows = filteredEntries.map((e) =>
      [e.operator_name, e.operator_code, e.activity, fmtDate(e.start_time), e.shift, e.station || "", fmtClock(e.start_time), fmtClock(e.end_time), e.duration_seconds, e.manual_entry ? "sim" : "não", e.order_number || "", e.customer_name || "", e.transfer_type || "", e.vehicle || "", e.plate || ""].join(",")
    );
    const csv = header + rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `apontamentos_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copyDailySummary() {
    const today = todayLocalISODate();
    const todayEntries = entries.filter((e) => e.start_time.slice(0, 10) === today);
    const todayMetrics = computeMetrics(todayEntries, activities);

    const lines = [];
    lines.push(`Resumo do dia — ${fmtDate(new Date())} — Aponta CD Hidráulica Tropeiro`);
    lines.push("");
    lines.push(`Total de registros: ${todayEntries.length}`);
    lines.push(`Tempo médio geral: ${fmtDuration(Math.round(meanM(todayEntries.map((e) => e.duration_seconds))))}`);
    lines.push("");
    lines.push("Por atividade:");
    todayMetrics.avgByActivity
      .filter((a) => a.registros > 0)
      .forEach((a) => lines.push(`  • ${a.name}: ${a.registros} registro(s), média ${fmtDuration(a.media)}`));
    lines.push("");
    lines.push("Por operador:");
    todayMetrics.opStats.forEach((o) => lines.push(`  • ${o.name}: ${o.registros} registro(s), total ${fmtDuration(o.total)}`));

    const todayErrors = separationErrors.filter((e) => e.created_at.slice(0, 10) === today);
    if (todayErrors.length > 0) {
      lines.push("");
      lines.push(`Erros de separação hoje: ${todayErrors.length}`);
      const byType = {};
      todayErrors.forEach((e) => { byType[e.error_type] = (byType[e.error_type] || 0) + 1; });
      Object.entries(byType).forEach(([type, count]) => lines.push(`  • ${type}: ${count}`));
    }

    if (activityAlerts.length > 0) {
      lines.push("");
      lines.push("Alertas (atividades em andamento além do esperado):");
      activityAlerts.forEach((a) => lines.push(`  • ${a.operator_name} — ${a.activity} — ${fmtDuration(a.elapsed)}`));
    }

    const text = lines.join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopyLabel("Copiado! ✓");
    } catch {
      setCopyLabel("Não foi possível copiar");
    }
    setTimeout(() => setCopyLabel("Copiar resumo do dia"), 2500);
  }

  function openPrintableReport() {
    const period = dateFrom || dateTo ? `${dateFrom ? fmtDate(dateFrom + "T12:00:00") : "início"} até ${dateTo ? fmtDate(dateTo + "T12:00:00") : "hoje"}` : "todo o histórico";
    const esc = (s) => String(s ?? "").replace(/</g, "&lt;");

    const activityRows = metrics.avgByActivity
      .filter((a) => a.registros > 0)
      .map((a) => `<tr><td>${esc(a.name)}</td><td>${a.registros}</td><td>${esc(fmtDuration(a.media))}</td></tr>`)
      .join("");

    const opRows = metrics.opStats
      .map((o) => `<tr><td>${esc(o.name)}</td><td>${o.registros}</td><td>${esc(fmtDuration(o.media))}</td><td>${esc(fmtDuration(o.total))}</td></tr>`)
      .join("");

    const coverageHeaders = activities.map((a) => `<th>${esc(a.name)}</th>`).join("");
    const coverageRows = coverage
      .map((row) => {
        const cells = activities.map((a) => `<td style="text-align:center">${row.counts[a.name] > 0 ? row.counts[a.name] : "—"}</td>`).join("");
        return `<tr><td>${esc(row.operator.name)}</td>${cells}<td style="text-align:center">${row.done}/${row.total}</td></tr>`;
      })
      .join("");

    const errorRows = errorsByType.map((e) => `<tr><td>${esc(e.name)}</td><td>${e.total}</td></tr>`).join("");

    const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório Aponta CD</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; color: #14171a; padding: 32px; }
  header { display: flex; align-items: center; gap: 14px; border-bottom: 3px solid #FFB020; padding-bottom: 14px; margin-bottom: 20px; }
  header img { width: 48px; height: 48px; border-radius: 50%; }
  h1 { font-size: 20px; margin: 0; }
  h2 { font-size: 14px; margin: 26px 0 8px 0; border-left: 4px solid #FFB020; padding-left: 8px; }
  p.meta { color: #555; font-size: 12px; margin: 2px 0 0 0; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 6px; }
  th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
  th { background: #f2f2f2; }
  footer { margin-top: 30px; font-size: 10px; color: #888; text-align: center; }
  @media print { body { padding: 12px; } }
</style></head>
<body>
  <header>
    <img src="${window.location.origin}${logo}" alt="" />
    <div>
      <h1>Relatório de Atividades — Aponta CD</h1>
      <p class="meta">Hidráulica Tropeiro · Período: ${esc(period)} · Gerado em ${esc(fmtDate(new Date()))} às ${esc(fmtClock(new Date()))}</p>
    </div>
  </header>

  <h2>Resumo</h2>
  <table>
    <tr><th>Registros no período</th><td>${filteredEntries.length}</td></tr>
    <tr><th>Tempo médio geral</th><td>${esc(fmtDuration(Math.round(meanM(filteredEntries.map((e) => e.duration_seconds)))))}</td></tr>
    <tr><th>Registros fora do padrão</th><td>${metrics.outliers.length}</td></tr>
  </table>

  <h2>Tempo médio por atividade</h2>
  <table><tr><th>Atividade</th><th>Registros</th><th>Tempo médio</th></tr>${activityRows || '<tr><td colspan="3">Sem registros</td></tr>'}</table>

  <h2>Produtividade por operador</h2>
  <table><tr><th>Operador</th><th>Registros</th><th>Tempo médio</th><th>Tempo total</th></tr>${opRows || '<tr><td colspan="4">Sem registros</td></tr>'}</table>

  <h2>Cobertura de rodízio</h2>
  <table><tr><th>Operador</th>${coverageHeaders}<th>Cobertura</th></tr>${coverageRows || `<tr><td colspan="${activities.length + 2}">Sem operadores</td></tr>`}</table>

  ${errorsByType.length > 0 ? `<h2>Erros de separação</h2><table><tr><th>Tipo</th><th>Ocorrências</th></tr>${errorRows}</table>` : ""}

  <footer>Aponta CD · Hidráulica Tropeiro — relatório gerado automaticamente</footer>
</body></html>`;

    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.onload = () => win.print();
  }

  async function confirmReset() {
    if (resetPhrase.trim().toUpperCase() !== "ZERAR") return;
    setResetting(true);
    await onResetEntries?.();
    setResetting(false);
    setConfirmingReset(false);
    setResetPhrase("");
  }

  const hasFilters = filterOperator || filterActivity || filterShift || filterStation || dateFrom || dateTo;

  return (
    <div>
      <div className="page-header-row" style={{ marginBottom: 22 }}>
        <div>
          <h1 className="page-title">Painel de métricas</h1>
          <p className="page-sub" style={{ marginBottom: 0 }}>
            {filteredEntries.length} de {entries.length} registros · {activeSessions.length} em andamento agora
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn-small" onClick={copyDailySummary}>{copyLabel}</button>
          <button className="btn-small" onClick={openPrintableReport}>Gerar relatório (PDF)</button>
          <button className="btn-small" onClick={exportCSV}>Exportar CSV</button>
          <button className="btn-danger-outline" onClick={() => setConfirmingReset((v) => !v)}>
            Zerar resultados
          </button>
        </div>
      </div>

      {confirmingReset && (
        <div className="confirm-box" style={{ marginBottom: 22 }}>
          <strong style={{ color: "var(--danger)", fontSize: 14 }}>Isso apaga todo o histórico de registros, permanentemente.</strong>
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "6px 0 12px 0" }}>
            Não afeta a lista de operadores nem de atividades. Para confirmar, digite <strong>ZERAR</strong> abaixo.
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              className="field"
              style={{ flex: 1 }}
              placeholder="Digite ZERAR"
              value={resetPhrase}
              onChange={(e) => setResetPhrase(e.target.value)}
            />
            <button
              className="btn-danger-outline"
              onClick={confirmReset}
              disabled={resetPhrase.trim().toUpperCase() !== "ZERAR" || resetting}
            >
              {resetting ? "Apagando..." : "Confirmar exclusão"}
            </button>
            <button className="btn-small" onClick={() => { setConfirmingReset(false); setResetPhrase(""); }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {activityAlerts.length > 0 && (
        <div className="confirm-box alert-box-pulsing" style={{ marginBottom: 22 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <strong style={{ color: "var(--danger)", fontSize: 15 }}>
              ⚠ {activityAlerts.length} atividade(s) em andamento há mais tempo que o esperado
            </strong>
            <button className="btn-small" onClick={toggleSound}>
              {soundEnabled ? "🔔 Alerta sonoro ativado" : "🔕 Ativar alerta sonoro"}
            </button>
          </div>
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
            {activityAlerts.map((a) => (
              <div key={a.operator_code} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span>{a.operator_name} — {a.activity}</span>
                <span style={{ fontFamily: "var(--font-mono)", color: "var(--danger)" }}>{fmtDuration(a.elapsed)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {activityAlerts.length === 0 && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
          <button className="btn-small" onClick={toggleSound}>
            {soundEnabled ? "🔔 Alerta sonoro ativado" : "🔕 Ativar alerta sonoro"}
          </button>
        </div>
      )}

      <div className="stat-strip">
        <div className="stat-cell">
          <div className="stat-num">{filteredEntries.length}</div>
          <div className="stat-label">Registros no período</div>
        </div>
        <div className="stat-cell">
          <div className="stat-num">{fmtDuration(Math.round(meanM(filteredEntries.map((e) => e.duration_seconds))))}</div>
          <div className="stat-label">Tempo médio geral</div>
        </div>
        <div className="stat-cell">
          <div className="stat-num accent">{volumeLeader?.name?.split(" ")[0] || "-"}</div>
          <div className="stat-label">Maior volume ({volumeLeader?.registros ?? 0} registros)</div>
        </div>
        <div className="stat-cell">
          <div className="stat-num danger">{metrics.outliers.length}</div>
          <div className="stat-label">Fora do padrão</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">Tempo médio por atividade (segundos)</div>
        <ResponsiveContainer width="100%" height={230}>
          <BarChart data={metrics.avgByActivity}>
            <CartesianGrid stroke="#262B31" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: "#8D95A0", fontSize: 11 }} />
            <YAxis tick={{ fill: "#8D95A0", fontSize: 11 }} />
            <Tooltip contentStyle={{ background: "#16191D", border: "1px solid #343B42", fontSize: 12, borderRadius: 8 }} labelStyle={{ color: "#F4F5F6" }} />
            <Bar dataKey="media" radius={[3, 3, 0, 0]}>
              {metrics.avgByActivity.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">Tendência semanal por atividade (segundos, média)</div>
        {weeklyTrend.length > 1 ? (
          <ResponsiveContainer width="100%" height={230}>
            <LineChart data={weeklyTrend}>
              <CartesianGrid stroke="#262B31" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "#8D95A0", fontSize: 11 }} />
              <YAxis tick={{ fill: "#8D95A0", fontSize: 11 }} />
              <Tooltip contentStyle={{ background: "#16191D", border: "1px solid #343B42", fontSize: 12, borderRadius: 8 }} labelStyle={{ color: "#F4F5F6" }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {activities.map((a, i) => (
                <Line key={a.name} type="monotone" dataKey={a.name} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={{ r: 3 }} connectNulls />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p style={{ fontSize: 12.5, color: "var(--text-faint)" }}>
            Ainda não há dados de mais de uma semana no período filtrado para mostrar uma tendência.
          </p>
        )}
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="page-header-row" style={{ marginBottom: 14 }}>
          <div className="card-title" style={{ marginBottom: 0 }}>Comparação mês a mês</div>
          {availableMonths.length > 1 && (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <select className="field" value={monthA} onChange={(e) => setMonthA(e.target.value)}>
                {availableMonths.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
              </select>
              <span style={{ color: "var(--text-faint)", fontSize: 12 }}>vs</span>
              <select className="field" value={monthB} onChange={(e) => setMonthB(e.target.value)}>
                {availableMonths.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
              </select>
            </div>
          )}
        </div>
        {availableMonths.length > 1 ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>Atividade</th>
                <th>{monthLabel(monthA)}</th>
                <th>{monthLabel(monthB)}</th>
                <th>Diferença</th>
              </tr>
            </thead>
            <tbody>
              {monthComparisonRows.map((r) => (
                <tr key={r.name}>
                  <td style={{ fontFamily: "var(--font-display)" }}>{r.name}</td>
                  <td>{r.registrosA > 0 ? fmtDuration(r.mediaA) : "sem registros"}</td>
                  <td>{r.registrosB > 0 ? fmtDuration(r.mediaB) : "sem registros"}</td>
                  <td style={{ color: r.deltaPct === null ? "var(--text-faint)" : r.deltaPct < 0 ? "var(--ok)" : "var(--danger)" }}>
                    {r.deltaPct === null ? "—" : `${r.deltaPct > 0 ? "+" : ""}${r.deltaPct}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p style={{ fontSize: 12.5, color: "var(--text-faint)" }}>
            Ainda não há registros de mais de um mês para comparar.
          </p>
        )}
      </div>

      {targetComparison.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-title">Meta vs. real por atividade</div>
          <table className="data-table">
            <thead><tr><th>Atividade</th><th>Meta</th><th>Real (média)</th><th>Diferença</th></tr></thead>
            <tbody>
              {targetComparison.map((t) => (
                <tr key={t.name}>
                  <td style={{ fontFamily: "var(--font-display)" }}>{t.name}</td>
                  <td>{fmtDuration(t.target)}</td>
                  <td>{t.registros > 0 ? fmtDuration(t.media) : "sem registros"}</td>
                  <td style={{ color: t.deltaPct === null ? "var(--text-faint)" : t.deltaPct > 0 ? "var(--danger)" : "var(--ok)" }}>
                    {t.deltaPct === null ? "—" : `${t.deltaPct > 0 ? "+" : ""}${t.deltaPct}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">Comparação por turno (segundos, média)</div>
        <ResponsiveContainer width="100%" height={170}>
          <BarChart data={metrics.shiftData} layout="vertical">
            <CartesianGrid stroke="#262B31" horizontal={false} />
            <XAxis type="number" tick={{ fill: "#8D95A0", fontSize: 11 }} />
            <YAxis type="category" dataKey="name" tick={{ fill: "#8D95A0", fontSize: 12 }} width={60} />
            <Tooltip contentStyle={{ background: "#16191D", border: "1px solid #343B42", fontSize: 12, borderRadius: 8 }} labelStyle={{ color: "#F4F5F6" }} />
            <Bar dataKey="media" fill="#60A5FA" radius={[0, 3, 3, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">Produtividade por operador</div>
        <table className="data-table">
          <thead>
            <tr><th>Operador</th><th>Registros</th><th>Tempo médio</th><th>Tempo total</th></tr>
          </thead>
          <tbody>
            {metrics.opStats.map((o) => (
              <tr key={o.name}>
                <td style={{ fontFamily: "var(--font-display)" }}>{o.name}</td>
                <td>{o.registros}</td>
                <td>{fmtDuration(o.media)}</td>
                <td>{fmtDuration(o.total)}</td>
              </tr>
            ))}
            {metrics.opStats.length === 0 && <tr><td colSpan={4}>Nenhum registro no período.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">Cobertura de rodízio no período</div>
        <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: -6, marginBottom: 14 }}>
          Quantas vezes cada operador já passou por cada atividade — útil para garantir que todos aprendam
          todas as funções. Células em branco significam que a pessoa ainda não fez aquela atividade no
          período filtrado.
        </p>
        <div style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Operador</th>
                {activities.map((a) => <th key={a.name}>{a.name}</th>)}
                <th>Cobertura</th>
              </tr>
            </thead>
            <tbody>
              {coverage.map((row) => (
                <tr key={row.operator.code}>
                  <td style={{ fontFamily: "var(--font-display)" }}>{row.operator.name}</td>
                  {activities.map((a) => (
                    <td key={a.name} style={{ textAlign: "center", color: row.counts[a.name] > 0 ? "var(--text)" : "var(--text-faint)" }}>
                      {row.counts[a.name] > 0 ? row.counts[a.name] : "—"}
                    </td>
                  ))}
                  <td style={{ color: row.done === row.total ? "var(--ok)" : "var(--text-muted)" }}>
                    {row.done}/{row.total}
                  </td>
                </tr>
              ))}
              {coverage.length === 0 && <tr><td colSpan={activities.length + 2}>Nenhum operador cadastrado.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="page-header-row" style={{ marginBottom: 14 }}>
          <div className="card-title" style={{ marginBottom: 0 }}>Erros de separação no período</div>
          <button className="btn-small" onClick={exportErrorsCSV}>Exportar CSV</button>
        </div>
        {errorsByType.length > 0 ? (
          <>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={errorsByType}>
                <CartesianGrid stroke="#262B31" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: "#8D95A0", fontSize: 10.5 }} />
                <YAxis tick={{ fill: "#8D95A0", fontSize: 11 }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "#16191D", border: "1px solid #343B42", fontSize: 12, borderRadius: 8 }} labelStyle={{ color: "#F4F5F6" }} />
                <Bar dataKey="total" fill="#F87171" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <table className="data-table" style={{ marginTop: 14 }}>
              <thead><tr><th>Operador</th><th>Tipo</th><th>Observação</th><th>Data</th><th>Hora</th></tr></thead>
              <tbody>
                {dateFilteredErrors.slice(0, 100).map((e) => (
                  <tr key={e.id}>
                    <td style={{ fontFamily: "var(--font-display)" }}>{e.operator_name}</td>
                    <td>{e.error_type}</td>
                    <td style={{ color: "var(--text-muted)" }}>{e.note || "—"}</td>
                    <td>{fmtDate(e.created_at)}</td>
                    <td>{fmtClock(e.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : (
          <p style={{ fontSize: 12.5, color: "var(--text-faint)" }}>Nenhum erro registrado no período filtrado.</p>
        )}
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">Ranking por atividade (mais rápido → mais lento)</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 16 }}>
          {activities.map((act) => (
            <div key={act.name}>
              <div style={{ fontSize: 12.5, color: "var(--accent)", fontWeight: 600, marginBottom: 6 }}>{act.name}</div>
              {(metrics.rankByActivity[act.name] || []).slice(0, 5).map((r, i) => (
                <div key={r.name} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "3px 0", borderBottom: "1px solid var(--border)" }}>
                  <span>{i + 1}. {r.name}</span>
                  <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>{fmtDuration(r.media)}</span>
                </div>
              ))}
              {(!metrics.rankByActivity[act.name] || metrics.rankByActivity[act.name].length === 0) && (
                <div style={{ fontSize: 12, color: "var(--text-faint)" }}>Sem registros</div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
          <select className="field" value={filterOperator} onChange={(e) => setFilterOperator(e.target.value)}>
            <option value="">Todos operadores</option>
            {operators.map((o) => <option key={o.code} value={o.code}>{o.name}</option>)}
          </select>
          <select className="field" value={filterActivity} onChange={(e) => setFilterActivity(e.target.value)}>
            <option value="">Todas atividades</option>
            {activities.map((a) => <option key={a.name} value={a.name}>{a.name}</option>)}
          </select>
          <select className="field" value={filterShift} onChange={(e) => setFilterShift(e.target.value)}>
            <option value="">Ambos turnos</option>
            <option value="Manhã">Manhã</option>
            <option value="Tarde">Tarde</option>
          </select>
          {knownStations.length > 0 && (
            <select className="field" value={filterStation} onChange={(e) => setFilterStation(e.target.value)}>
              <option value="">Todas estações</option>
              {knownStations.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
          <span style={{ color: "var(--text-faint)", fontSize: 12 }}>de</span>
          <input type="date" className="field" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          <span style={{ color: "var(--text-faint)", fontSize: 12 }}>até</span>
          <input type="date" className="field" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          {hasFilters && (
            <button className="btn-small" onClick={clearFilters}>Limpar filtros</button>
          )}
        </div>
        <table className="data-table">
          <thead>
            <tr><th>Data</th><th>Operador</th><th>Atividade</th><th>Turno</th><th>Estação</th><th>Início</th><th>Fim</th><th>Duração</th></tr>
          </thead>
          <tbody>
            {filteredEntries.slice(0, 150).map((e) => {
              const isOutlier = metrics.outliers.some((o) => o.id === e.id);
              return (
                <tr key={e.id}>
                  <td>{fmtDate(e.start_time)}</td>
                  <td style={{ fontFamily: "var(--font-display)" }}>{e.operator_name}</td>
                  <td>
                    {e.activity}
                    {(e.transfer_type || e.customer_name || e.order_number) && (
                      <div style={{ fontSize: 10.5, color: "var(--text-faint)" }}>
                        {e.transfer_type || e.customer_name}{e.order_number ? ` · #${e.order_number}` : ""}
                      </div>
                    )}
                    {e.vehicle && (
                      <div style={{ fontSize: 10.5, color: "var(--text-faint)" }}>
                        {e.vehicle}{e.plate ? ` · ${e.plate}` : ""}
                      </div>
                    )}
                  </td>
                  <td>{e.shift}</td>
                  <td style={{ color: "var(--text-muted)" }}>{e.station || "—"}</td>
                  <td>{fmtClock(e.start_time)}</td>
                  <td>{fmtClock(e.end_time)}</td>
                  <td>
                    {fmtDuration(e.duration_seconds)}
                    {isOutlier && <span className="outlier-tag">fora do padrão</span>}
                    {e.manual_entry && <span className="outlier-tag" style={{ background: "var(--accent-dim)", color: "var(--accent)" }}>manual</span>}
                    {e.note && <span title={e.note} style={{ marginLeft: 6, cursor: "help" }}>📝</span>}
                  </td>
                </tr>
              );
            })}
            {filteredEntries.length === 0 && <tr><td colSpan={8}>Nenhum registro encontrado.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
