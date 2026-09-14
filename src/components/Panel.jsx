import React, { useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  AreaChart, Area, PieChart, Pie, Legend,
} from "recharts";
import * as XLSX from "xlsx";
import { fmtClock, fmtDate, fmtDuration, isLongSession, minutesSince, LONG_SESSION_MINUTES } from "../lib/format";
import { computeMetrics, mean as meanM } from "../lib/metrics";

const COLORS = ["#FFB020", "#34D399", "#F87171", "#60A5FA", "#C084FC", "#FB923C", "#22D3EE", "#A3A3A3"];

export default function Panel({
  entries, activities, operators, activeSessions, onResetEntries,
  notifPermission, onRequestNotifPermission,
}) {
  const [filterOperator, setFilterOperator] = useState("");
  const [filterActivity, setFilterActivity] = useState("");
  const [filterShift, setFilterShift] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [confirmingReset, setConfirmingReset] = useState(false);
  const [resetPhrase, setResetPhrase] = useState("");
  const [resetting, setResetting] = useState(false);

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

  // Registros por dia (para o gráfico de tendência) — últimos 30 dias do
  // período filtrado.
  const byDay = useMemo(() => {
    const map = {};
    dateFilteredEntries.forEach((e) => {
      const key = fmtDate(e.start_time);
      map[key] = (map[key] || 0) + 1;
    });
    return Object.entries(map)
      .map(([name, registros]) => ({ name, registros, sortKey: name.split("/").reverse().join("-") }))
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
      .slice(-30);
  }, [dateFilteredEntries]);

  // Distribuição de registros por atividade (contagem, não tempo médio).
  const byActivityCount = useMemo(() => {
    const map = {};
    dateFilteredEntries.forEach((e) => {
      map[e.activity] = (map[e.activity] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [dateFilteredEntries]);

  const longSessions = activeSessions.filter((s) => isLongSession(s));

  const filteredEntries = useMemo(() => {
    return dateFilteredEntries
      .filter((e) => !filterOperator || e.operator_code === filterOperator)
      .filter((e) => !filterActivity || e.activity === filterActivity)
      .filter((e) => !filterShift || e.shift === filterShift)
      .sort((a, b) => new Date(b.start_time) - new Date(a.start_time));
  }, [dateFilteredEntries, filterOperator, filterActivity, filterShift]);

  function clearFilters() {
    setFilterOperator("");
    setFilterActivity("");
    setFilterShift("");
    setDateFrom("");
    setDateTo("");
  }

  function exportCSV() {
    const header = "Operador,Codigo,Atividade,Detalhe,Data,Turno,Inicio,Fim,Duracao(s)\n";
    const rows = filteredEntries.map((e) =>
      [e.operator_name, e.operator_code, e.activity, e.detail || "", fmtDate(e.start_time), e.shift, fmtClock(e.start_time), fmtClock(e.end_time), e.duration_seconds].join(",")
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

  function exportExcel() {
    const rows = filteredEntries.map((e) => ({
      Operador: e.operator_name,
      Código: e.operator_code,
      Atividade: e.activity,
      Detalhe: e.detail || "",
      Data: fmtDate(e.start_time),
      Turno: e.shift,
      Início: fmtClock(e.start_time),
      Fim: fmtClock(e.end_time),
      "Duração (s)": e.duration_seconds,
      "Duração": fmtDuration(e.duration_seconds),
    }));
    const resumo = metrics.opStats.map((o) => ({
      Operador: o.name,
      Registros: o.registros,
      "Tempo médio": fmtDuration(o.media),
      "Tempo total": fmtDuration(o.total),
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Registros");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumo), "Resumo por operador");
    XLSX.writeFile(wb, `apontamentos_${Date.now()}.xlsx`);
  }

  function exportPDF() {
    window.print();
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
        <div style={{ display: "flex", gap: 8 }} className="no-print">
          {notifPermission !== "granted" && notifPermission !== "unsupported" && (
            <button className="btn-small" onClick={onRequestNotifPermission}>
              Ativar notificações
            </button>
          )}
          <button className="btn-small" onClick={exportCSV}>CSV</button>
          <button className="btn-small" onClick={exportExcel}>Excel</button>
          <button className="btn-small" onClick={exportPDF}>PDF</button>
          <button className="btn-danger-outline" onClick={() => setConfirmingReset((v) => !v)}>
            Zerar resultados
          </button>
        </div>
      </div>

      {longSessions.length > 0 && (
        <div className="confirm-box no-print" style={{ marginBottom: 22 }}>
          <strong style={{ color: "var(--danger)", fontSize: 14 }}>
            {longSessions.length} atividade{longSessions.length > 1 ? "s" : ""} em aberto há mais de {LONG_SESSION_MINUTES} minutos
          </strong>
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
            {longSessions.map((s) => (
              <div key={s.operator_code} style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
                <span style={{ color: "var(--text)", fontFamily: "var(--font-display)" }}>{s.operator_name}</span>
                {" — "}{s.activity}{s.detail ? ` · ${s.detail}` : ""}{" · "}
                <span style={{ color: "var(--danger)" }}>{Math.floor(minutesSince(s.start_time))} min</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {confirmingReset && (
        <div className="confirm-box no-print" style={{ marginBottom: 22 }}>
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
          <div className="stat-num accent">{metrics.opStats[0]?.name?.split(" ")[0] || "-"}</div>
          <div className="stat-label">Maior volume</div>
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

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 20, marginBottom: 20 }}>
        <div className="card">
          <div className="card-title">Registros por dia</div>
          <ResponsiveContainer width="100%" height={190}>
            <AreaChart data={byDay}>
              <CartesianGrid stroke="#262B31" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: "#8D95A0", fontSize: 10 }} />
              <YAxis tick={{ fill: "#8D95A0", fontSize: 11 }} allowDecimals={false} />
              <Tooltip contentStyle={{ background: "#16191D", border: "1px solid #343B42", fontSize: 12, borderRadius: 8 }} labelStyle={{ color: "#F4F5F6" }} />
              <Area type="monotone" dataKey="registros" stroke="#FFB020" fill="#FFB02033" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="card-title">Volume por atividade</div>
          <ResponsiveContainer width="100%" height={190}>
            <PieChart>
              <Pie data={byActivityCount} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70}>
                {byActivityCount.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: "#16191D", border: "1px solid #343B42", fontSize: 12, borderRadius: 8 }} labelStyle={{ color: "#F4F5F6" }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
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

      {Object.keys(metrics.detailBreakdown).length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-title">Detalhamento por local / veículo</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 16 }}>
            {Object.entries(metrics.detailBreakdown).map(([activity, rows]) => (
              <div key={activity}>
                <div style={{ fontSize: 12.5, color: "var(--accent)", fontWeight: 600, marginBottom: 6 }}>{activity}</div>
                {rows.map((r) => (
                  <div key={r.name} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "3px 0", borderBottom: "1px solid var(--border)" }}>
                    <span>{r.name}</span>
                    <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                      {r.registros}× · {fmtDuration(r.media)} méd.
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <div className="no-print" style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
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
                  <td>
                    {e.activity}
                    {e.detail && (
                      <span style={{ color: "var(--text-muted)", fontSize: 11.5 }}> · {e.detail}</span>
                    )}
                  </td>
                  <td>{e.shift}</td>
                  <td>{fmtClock(e.start_time)}</td>
                  <td>{fmtClock(e.end_time)}</td>
                  <td>
                    {fmtDuration(e.duration_seconds)}
                    {isOutlier && <span className="outlier-tag">fora do padrão</span>}
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
