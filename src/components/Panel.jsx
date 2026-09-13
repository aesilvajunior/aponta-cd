import React, { useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { fmtClock, fmtDate, fmtDuration } from "../lib/format";
import { computeMetrics, mean as meanM } from "../lib/metrics";

const COLORS = ["#F5C518", "#4A90A4", "#E2574C", "#7FA650", "#B98CD6", "#D98A3D", "#5C9EAD", "#C9634F"];

export default function Panel({ entries, activities, operators, activeSessions }) {
  const [filterOperator, setFilterOperator] = useState("");
  const [filterActivity, setFilterActivity] = useState("");
  const [filterShift, setFilterShift] = useState("");

  const metrics = useMemo(() => computeMetrics(entries, activities), [entries, activities]);

  const filteredEntries = useMemo(() => {
    return entries
      .filter((e) => !filterOperator || e.operator_code === filterOperator)
      .filter((e) => !filterActivity || e.activity === filterActivity)
      .filter((e) => !filterShift || e.shift === filterShift)
      .sort((a, b) => new Date(b.start_time) - new Date(a.start_time));
  }, [entries, filterOperator, filterActivity, filterShift]);

  function exportCSV() {
    const header = "Operador,Codigo,Atividade,Data,Turno,Inicio,Fim,Duracao(s)\n";
    const rows = entries.map((e) =>
      [e.operator_name, e.operator_code, e.activity, fmtDate(e.start_time), e.shift, fmtClock(e.start_time), fmtClock(e.end_time), e.duration_seconds].join(",")
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

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1 className="page-title">Painel de métricas</h1>
          <p className="page-sub">
            {entries.length} registros no total · {activeSessions.length} em andamento agora
          </p>
        </div>
        <button className="btn-small" onClick={exportCSV}>
          Exportar CSV
        </button>
      </div>

      <div className="metric-grid">
        <div className="card">
          <div className="metric-num">{entries.length}</div>
          <div className="metric-label">Registros totais</div>
        </div>
        <div className="card">
          <div className="metric-num">{fmtDuration(Math.round(meanM(entries.map((e) => e.duration_seconds))))}</div>
          <div className="metric-label">Tempo médio geral</div>
        </div>
        <div className="card">
          <div className="metric-num">{metrics.opStats[0]?.name?.split(" ")[0] || "-"}</div>
          <div className="metric-label">Maior volume de registros</div>
        </div>
        <div className="card">
          <div className="metric-num" style={{ color: "var(--danger)" }}>{metrics.outliers.length}</div>
          <div className="metric-label">Registros fora do padrão</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">Tempo médio por atividade (segundos)</div>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={metrics.avgByActivity}>
            <CartesianGrid stroke="#2A2E32" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: "#8B939B", fontSize: 11 }} />
            <YAxis tick={{ fill: "#8B939B", fontSize: 11 }} />
            <Tooltip contentStyle={{ background: "#1E2226", border: "1px solid #33383D", fontSize: 12 }} labelStyle={{ color: "#ECEEF0" }} />
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
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={metrics.shiftData} layout="vertical">
            <CartesianGrid stroke="#2A2E32" horizontal={false} />
            <XAxis type="number" tick={{ fill: "#8B939B", fontSize: 11 }} />
            <YAxis type="category" dataKey="name" tick={{ fill: "#8B939B", fontSize: 12 }} width={60} />
            <Tooltip contentStyle={{ background: "#1E2226", border: "1px solid #33383D", fontSize: 12 }} labelStyle={{ color: "#ECEEF0" }} />
            <Bar dataKey="media" fill="#4A90A4" radius={[0, 3, 3, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">Produtividade por operador</div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Operador</th>
              <th>Registros</th>
              <th>Tempo médio</th>
              <th>Tempo total</th>
            </tr>
          </thead>
          <tbody>
            {metrics.opStats.map((o) => (
              <tr key={o.name}>
                <td>{o.name}</td>
                <td>{o.registros}</td>
                <td>{fmtDuration(o.media)}</td>
                <td>{fmtDuration(o.total)}</td>
              </tr>
            ))}
            {metrics.opStats.length === 0 && (
              <tr>
                <td colSpan={4}>Nenhum registro ainda.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">Ranking por atividade (mais rápido → mais lento)</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 16 }}>
          {activities.map((act) => (
            <div key={act.name}>
              <div style={{ fontSize: 13, color: "var(--accent)", fontFamily: "var(--font-display)", marginBottom: 6 }}>
                {act.name}
              </div>
              {(metrics.rankByActivity[act.name] || []).slice(0, 5).map((r, i) => (
                <div
                  key={r.name}
                  style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "3px 0", borderBottom: "1px solid var(--border)" }}
                >
                  <span>{i + 1}. {r.name}</span>
                  <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>{fmtDuration(r.media)}</span>
                </div>
              ))}
              {(!metrics.rankByActivity[act.name] || metrics.rankByActivity[act.name].length === 0) && (
                <div style={{ fontSize: 12, color: "#5F5E5A" }}>Sem registros</div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
          <select className="field" value={filterOperator} onChange={(e) => setFilterOperator(e.target.value)}>
            <option value="">Todos operadores</option>
            {operators.map((o) => (
              <option key={o.code} value={o.code}>{o.name}</option>
            ))}
          </select>
          <select className="field" value={filterActivity} onChange={(e) => setFilterActivity(e.target.value)}>
            <option value="">Todas atividades</option>
            {activities.map((a) => (
              <option key={a.name} value={a.name}>{a.name}</option>
            ))}
          </select>
          <select className="field" value={filterShift} onChange={(e) => setFilterShift(e.target.value)}>
            <option value="">Ambos turnos</option>
            <option value="Manhã">Manhã</option>
            <option value="Tarde">Tarde</option>
          </select>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Operador</th>
              <th>Atividade</th>
              <th>Turno</th>
              <th>Início</th>
              <th>Fim</th>
              <th>Duração</th>
            </tr>
          </thead>
          <tbody>
            {filteredEntries.slice(0, 150).map((e) => {
              const isOutlier = metrics.outliers.some((o) => o.id === e.id);
              return (
                <tr key={e.id}>
                  <td>{fmtDate(e.start_time)}</td>
                  <td>{e.operator_name}</td>
                  <td>{e.activity}</td>
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
            {filteredEntries.length === 0 && (
              <tr>
                <td colSpan={7}>Nenhum registro encontrado.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
