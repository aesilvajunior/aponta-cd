import React, { useMemo, useState } from "react";
import { fmtDuration } from "../lib/format";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { IconTrendingUp, IconSun, IconMoon } from "./Icons";

function isManha(iso) {
  const h = new Date(iso).getHours();
  return h >= 6 && h < 14;
}

export default function TurnComparison({ entries = [], activities = [], separationErrors = [], shortagesByEntry = {} }) {
  const [period, setPeriod] = useState("mes");

  const filtered = useMemo(() => {
    const now = new Date();
    let from = null;
    if (period === "hoje") {
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (period === "semana") {
      const day = now.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      from = new Date(now);
      from.setDate(now.getDate() + diff);
      from.setHours(0, 0, 0, 0);
    } else {
      from = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    return entries.filter((e) => new Date(e.start_time) >= from);
  }, [entries, period]);

  const stats = useMemo(() => {
    const build = (list) => {
      const total = list.length;
      const totalSec = list.reduce((s, e) => s + (e.duration_seconds || 0), 0);
      const avg = total > 0 ? Math.round(totalSec / total) : 0;
      const encaixes = list.filter((e) => e.is_encaixe).length;
      const comFalta = list.filter((e) => (shortagesByEntry[e.id]?.length || 0) > 0).length;
      return { total, totalSec, avg, encaixes, comFalta };
    };

    const manha = filtered.filter((e) => isManha(e.start_time));
    const tarde = filtered.filter((e) => !isManha(e.start_time));

    const errsManha = separationErrors.filter((e) => isManha(e.created_at));
    const errsTarde = separationErrors.filter((e) => !isManha(e.created_at));

    return {
      manha: { ...build(manha), erros: errsManha.length },
      tarde: { ...build(tarde), erros: errsTarde.length },
    };
  }, [filtered, separationErrors, shortagesByEntry]);

  const chartData = useMemo(() => {
    return activities.map((a) => {
      const listM = filtered.filter((e) => e.activity === a.name && isManha(e.start_time));
      const listT = filtered.filter((e) => e.activity === a.name && !isManha(e.start_time));
      const avgM = listM.length > 0 ? Math.round(listM.reduce((s, e) => s + (e.duration_seconds || 0), 0) / listM.length) : 0;
      const avgT = listT.length > 0 ? Math.round(listT.reduce((s, e) => s + (e.duration_seconds || 0), 0) / listT.length) : 0;
      return { name: a.name, "Manhã": avgM, "Tarde": avgT };
    }).filter((x) => x["Manhã"] > 0 || x["Tarde"] > 0);
  }, [filtered, activities]);

  function delta(m, t) {
    if (m === 0 || t === 0) return null;
    return Math.round(((t - m) / m) * 100);
  }

  return (
    <div>
      <div className="quick-filters" style={{ marginBottom: 16 }}>
        <span className="quick-filters-label">Período:</span>
        <button className={`quick-filter-btn ${period === "hoje" ? "active" : ""}`} onClick={() => setPeriod("hoje")}>Hoje</button>
        <button className={`quick-filter-btn ${period === "semana" ? "active" : ""}`} onClick={() => setPeriod("semana")}>Esta semana</button>
        <button className={`quick-filter-btn ${period === "mes" ? "active" : ""}`} onClick={() => setPeriod("mes")}>Este mês</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
        <div className="card" style={{ borderLeft: "4px solid var(--warning)" }}>
          <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <IconSun size={16} /> Turno Manhã
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Metric label="Registros" value={stats.manha.total} />
            <Metric label="Tempo médio" value={fmtDuration(stats.manha.avg)} />
            <Metric label="Tempo total" value={fmtDuration(stats.manha.totalSec)} />
            <Metric label="Encaixes" value={stats.manha.encaixes} />
            <Metric label="Com falta" value={stats.manha.comFalta} danger />
            <Metric label="Erros" value={stats.manha.erros} danger />
          </div>
        </div>

        <div className="card" style={{ borderLeft: "4px solid var(--accent)" }}>
          <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <IconMoon size={16} /> Turno Tarde
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Metric label="Registros" value={stats.tarde.total} delta={delta(stats.manha.total, stats.tarde.total)} />
            <Metric label="Tempo médio" value={fmtDuration(stats.tarde.avg)} delta={delta(stats.manha.avg, stats.tarde.avg)} invert />
            <Metric label="Tempo total" value={fmtDuration(stats.tarde.totalSec)} delta={delta(stats.manha.totalSec, stats.tarde.totalSec)} />
            <Metric label="Encaixes" value={stats.tarde.encaixes} delta={delta(stats.manha.encaixes, stats.tarde.encaixes)} />
            <Metric label="Com falta" value={stats.tarde.comFalta} delta={delta(stats.manha.comFalta, stats.tarde.comFalta)} invert danger />
            <Metric label="Erros" value={stats.tarde.erros} delta={delta(stats.manha.erros, stats.tarde.erros)} invert danger />
          </div>
        </div>
      </div>

      {chartData.length > 0 && (
        <div className="card">
          <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <IconTrendingUp size={16} /> Tempo médio por atividade e turno
          </div>
          <ResponsiveContainer width="100%" height={Math.max(240, chartData.length * 36)}>
            <BarChart data={chartData} layout="vertical">
              <CartesianGrid stroke="var(--border)" horizontal={false} />
              <XAxis type="number" tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
              <YAxis type="category" dataKey="name" tick={{ fill: "var(--text-muted)", fontSize: 11 }} width={140} />
              <Tooltip
                contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", fontSize: 12, borderRadius: 10 }}
                formatter={(v) => fmtDuration(v)}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Manhã" fill="var(--warning)" radius={[0, 4, 4, 0]} />
              <Bar dataKey="Tarde" fill="var(--accent)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, delta, invert, danger }) {
  const deltaColor = delta === null || delta === undefined
    ? "var(--text-faint)"
    : (invert ? delta < 0 : delta > 0)
    ? "var(--ok)"
    : delta === 0
    ? "var(--text-muted)"
    : "var(--danger)";

  return (
    <div>
      <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: danger && value > 0 ? "var(--danger)" : "var(--text)" }}>
        {value}
        {delta !== null && delta !== undefined && (
          <span style={{ fontSize: 11, marginLeft: 6, fontWeight: 600, color: deltaColor }}>
            {delta > 0 ? "+" : ""}{delta}%
          </span>
        )}
      </div>
    </div>
  );
}