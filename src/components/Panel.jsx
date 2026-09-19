import React, { useEffect, useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { fmtClock, fmtDate, fmtDuration } from "../lib/format";
import { computeMetrics, mean as meanM } from "../lib/metrics";

const COLORS = ["#FFB020", "#34D399", "#F87171", "#60A5FA", "#C084FC", "#FB923C", "#22D3EE", "#A3A3A3"];
const DEFAULT_ALERT_SECONDS = 45 * 60;

function todayLocalISODate() {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d - tz).toISOString().slice(0, 10);
}

export default function Panel({ entries, activities, operators, activeSessions, onResetEntries }) {
  const [filterOperator, setFilterOperator] = useState("");
  const [filterActivity, setFilterActivity] = useState("");
  const [filterShift, setFilterShift] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [confirmingReset, setConfirmingReset] = useState(false);
  const [resetPhrase, setResetPhrase] = useState("");
  const [resetting, setResetting] = useState(false);

  const [copyLabel, setCopyLabel] = useState("Copiar resumo do dia");

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
      .sort((a, b) => new Date(b.start_time) - new Date(a.start_time));
  }, [dateFilteredEntries, filterOperator, filterActivity, filterShift]);

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

  function clearFilters() {
    setFilterOperator("");
    setFilterActivity("");
    setFilterShift("");
    setDateFrom("");
    setDateTo("");
  }

  function exportCSV() {
    const header = "Operador,Codigo,Atividade,Data,Turno,Inicio,Fim,Duracao(s),Manual\n";
    const rows = filteredEntries.map((e) =>
      [e.operator_name, e.operator_code, e.activity, fmtDate(e.start_time), e.shift, fmtClock(e.start_time), fmtClock(e.end_time), e.duration_seconds, e.manual_entry ? "sim" : "não"].join(",")
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

  async function confirmReset() {
    if (resetPhrase.trim().toUpperCase() !== "ZERAR") return;
    setResetting(true);
    await onResetEntries?.();
    setResetting(false);
    setConfirmingReset(false);
    setResetPhrase("");
  }

  const hasFilters = filterOperator || filterActivity || filterShift || dateFrom || dateTo;

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
        <div className="confirm-box" style={{ marginBottom: 22 }}>
          <strong style={{ color: "var(--danger)", fontSize: 14 }}>
            ⚠ {activityAlerts.length} atividade(s) em andamento há mais tempo que o esperado
          </strong>
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
            <tr><th>Data</th><th>Operador</th><th>Atividade</th><th>Turno</th><th>Início</th><th>Fim</th><th>Duração</th></tr>
          </thead>
          <tbody>
            {filteredEntries.slice(0, 150).map((e) => {
              const isOutlier = metrics.outliers.some((o) => o.id === e.id);
              return (
                <tr key={e.id}>
                  <td>{fmtDate(e.start_time)}</td>
                  <td style={{ fontFamily: "var(--font-display)" }}>{e.operator_name}</td>
                  <td>{e.activity}</td>
                  <td>{e.shift}</td>
                  <td>{fmtClock(e.start_time)}</td>
                  <td>{fmtClock(e.end_time)}</td>
                  <td>
                    {fmtDuration(e.duration_seconds)}
                    {isOutlier && <span className="outlier-tag">fora do padrão</span>}
                    {e.manual_entry && <span className="outlier-tag" style={{ background: "var(--accent-dim)", color: "var(--accent)" }}>manual</span>}
                  </td>
                </tr>
              );
            })}
            {filteredEntries.length === 0 && <tr><td colSpan={7}>Nenhum registro encontrado.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
