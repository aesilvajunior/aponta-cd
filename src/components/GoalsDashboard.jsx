import React, { useEffect, useMemo, useState } from "react";
import {
  fetchGoalsForCurrentPeriod,
  getGoalPeriodKey,
  formatGoalPeriod,
  computeGoalProgress,
  filterEntriesByGoalPeriod,
} from "../lib/goals";
import { fetchEntries } from "../lib/api";
import { supabase } from "../supabaseClient";
import { fmtDuration } from "../lib/format";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend,
} from "recharts";
import {
  IconTarget,
  IconTrendingUp,
  IconAlertTriangle,
  IconAward,
  IconRefresh,
  IconCheck,
  IconX,
} from "./Icons";

const PERIOD_TYPES = [
  { value: "dia", label: "Hoje" },
  { value: "semana", label: "Esta semana" },
  { value: "mes", label: "Este mês" },
];

const COLORS = ["#1e3a5f", "#4a7ba7", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444"];

export default function GoalsDashboard() {
  const [goals, setGoals] = useState([]);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [periodType, setPeriodType] = useState("mes");

  const periodKey = useMemo(() => getGoalPeriodKey(periodType), [periodType]);

  async function loadAll() {
    setLoading(true);
    const [{ data: g, error: e1 }, { data: e, error: e2 }] = await Promise.all([
      fetchGoalsForCurrentPeriod(),
      fetchEntries({ limit: 5000 }),
    ]);
    if (e1 || e2) {
      setError((e1 || e2).message);
      setLoading(false);
      return;
    }
    setGoals(g || []);
    setEntries(e || []);
    setError("");
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    const ch = supabase
      .channel("goals-dashboard-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "operator_goals" }, loadAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "entries" }, loadAll)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, []);

  const filteredGoals = useMemo(
    () => goals.filter((g) => g.period_type === periodType && g.period_key === periodKey),
    [goals, periodType, periodKey]
  );

  const periodEntries = useMemo(
    () => filterEntriesByGoalPeriod(entries, periodType, periodKey),
    [entries, periodType, periodKey]
  );

  const goalsWithProgress = useMemo(() => {
    return filteredGoals.map((g) => {
      const progress = computeGoalProgress(g, periodEntries);
      const totalGoals = (g.goal_count != null ? 1 : 0) + (g.goal_avg_seconds != null ? 1 : 0);
      const metGoals = (progress.goalsMet.count ? 1 : 0) + (progress.goalsMet.avg ? 1 : 0);
      const pctTotal = totalGoals > 0 ? Math.round((metGoals / totalGoals) * 100) : 0;

      const countPct = g.goal_count ? Math.min(100, Math.round((progress.count / g.goal_count) * 100)) : null;
      const avgPct = g.goal_avg_seconds && progress.avgSeconds > 0
        ? Math.min(100, Math.round((g.goal_avg_seconds / progress.avgSeconds) * 100))
        : null;

      return {
        ...g,
        progress,
        totalGoals,
        metGoals,
        pctTotal,
        countPct,
        avgPct,
      };
    });
  }, [filteredGoals, periodEntries]);

  const stats = useMemo(() => {
    const total = goalsWithProgress.length;
    const full = goalsWithProgress.filter((g) => g.pctTotal === 100).length;
    const risk = goalsWithProgress.filter((g) => g.pctTotal > 0 && g.pctTotal < 50).length;
    const noGoal = goalsWithProgress.filter((g) => g.pctTotal === 0 && g.totalGoals > 0).length;
    return { total, full, risk, noGoal };
  }, [goalsWithProgress]);

  const chartData = useMemo(() => {
    return goalsWithProgress
      .filter((g) => g.countPct != null)
      .map((g) => ({
        name: g.operator_name.split(" ")[0],
        Realizado: g.progress.count,
        Meta: g.goal_count,
        fullName: g.operator_name,
      }))
      .sort((a, b) => b.Realizado - a.Realizado)
      .slice(0, 12);
  }, [goalsWithProgress]);

  const ranking = useMemo(() => {
    return [...goalsWithProgress].sort((a, b) => {
      if (b.pctTotal !== a.pctTotal) return b.pctTotal - a.pctTotal;
      return b.progress.count - a.progress.count;
    });
  }, [goalsWithProgress]);

  const alerts = useMemo(() => {
    const list = [];
    goalsWithProgress.forEach((g) => {
      if (g.totalGoals === 0) return;
      if (g.pctTotal === 0 && g.progress.count === 0) {
        list.push({
          severity: "alta",
          icon: <IconAlertTriangle size={16} />,
          text: `${g.operator_name} ainda não começou a meta do período`,
        });
      } else if (g.pctTotal < 50 && g.progress.count > 0) {
        list.push({
          severity: "media",
          icon: <IconAlertTriangle size={16} />,
          text: `${g.operator_name} está em ${g.pctTotal}% da meta`,
        });
      }
    });
    return list.slice(0, 8);
  }, [goalsWithProgress]);

  return (
    <div>
      <div className="page-header-row" style={{ marginBottom: 22 }}>
        <div>
          <h1 className="page-title">Dashboard de metas</h1>
          <p className="page-sub" style={{ marginBottom: 0 }}>
            Acompanhamento consolidado das metas individuais por operador
          </p>
        </div>
        <button className="btn-small" onClick={loadAll}>
          <IconRefresh size={14} /> Atualizar
        </button>
      </div>

      {error && (
        <div className="alert-card alert-danger" style={{ marginBottom: 20 }}>
          {error}
          <button className="btn-small" style={{ marginLeft: 12 }} onClick={() => setError("")}>Fechar</button>
        </div>
      )}

      <div className="quick-filters" style={{ marginBottom: 20 }}>
        <span className="quick-filters-label">Período:</span>
        {PERIOD_TYPES.map((p) => (
          <button
            key={p.value}
            className={`quick-filter-btn ${periodType === p.value ? "active" : ""}`}
            onClick={() => setPeriodType(p.value)}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="card" style={{ marginBottom: 20, textAlign: "center" }}>
        <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.015em" }}>
          {formatGoalPeriod(periodKey, periodType)}
        </div>
      </div>

      {/* KPIs */}
      <div className="stat-strip" style={{ marginBottom: 20 }}>
        <div className="stat-cell">
          <div className="stat-num accent">{stats.total}</div>
          <div className="stat-label">Metas definidas</div>
        </div>
        <div className="stat-cell">
          <div className="stat-num" style={{ color: "var(--ok)" }}>{stats.full}</div>
          <div className="stat-label">Metas atingidas</div>
        </div>
        <div className="stat-cell">
          <div className="stat-num" style={{ color: "var(--warning)" }}>{stats.risk}</div>
          <div className="stat-label">Em risco (&lt;50%)</div>
        </div>
        <div className="stat-cell">
          <div className="stat-num danger">{stats.noGoal}</div>
          <div className="stat-label">Sem progresso</div>
        </div>
      </div>

      {/* Alertas */}
      {alerts.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <IconAlertTriangle size={16} /> Alertas do período
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {alerts.map((a, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 14px",
                  background: a.severity === "alta" ? "var(--danger-soft)" : "var(--warning-soft)",
                  border: `1px solid ${a.severity === "alta" ? "var(--danger)" : "var(--warning)"}`,
                  borderRadius: 10,
                  color: a.severity === "alta" ? "var(--danger)" : "var(--text)",
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                {a.icon}
                {a.text}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Gráfico de barras */}
      {chartData.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <IconTrendingUp size={16} /> Realizado vs meta (quantidade)
          </div>
          <ResponsiveContainer width="100%" height={Math.max(240, chartData.length * 32)}>
            <BarChart data={chartData} layout="vertical">
              <CartesianGrid stroke="var(--border)" horizontal={false} />
              <XAxis type="number" tick={{ fill: "var(--text-muted)", fontSize: 11 }} allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={{ fill: "var(--text-muted)", fontSize: 11 }} width={90} />
              <Tooltip
                contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", fontSize: 12, borderRadius: 10 }}
                labelStyle={{ color: "var(--text)" }}
                formatter={(value, name, props) => [value, name === "Realizado" ? "Realizado" : "Meta"]}
                labelFormatter={(label, payload) => payload && payload[0]?.payload?.fullName || label}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Meta" fill="var(--border-strong)" radius={[0, 4, 4, 0]} />
              <Bar dataKey="Realizado" radius={[0, 4, 4, 0]}>
                {chartData.map((d, i) => (
                  <Cell key={i} fill={d.Realizado >= d.Meta ? "#10b981" : "#4a7ba7"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Ranking */}
      {ranking.length > 0 && (
        <div className="card">
          <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <IconAward size={16} /> Ranking de metas
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Posição</th>
                  <th>Operador</th>
                  <th>Metas</th>
                  <th>Progresso</th>
                  <th>Registros</th>
                  <th>Tempo médio</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((g, i) => (
                  <tr key={g.id}>
                    <td style={{ fontWeight: 700, color: i < 3 ? "var(--accent)" : "var(--text-muted)" }}>
                      {i + 1}º
                    </td>
                    <td style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}>
                      {g.operator_name} <span style={{ color: "var(--text-faint)", fontWeight: 400 }}>#{g.operator_code}</span>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                        {g.goal_count != null && (
                          <span title={`Quantidade: ${g.goal_count}`} style={{ background: "var(--accent-soft)", color: "var(--accent)", padding: "2px 8px", borderRadius: 5, fontSize: 11, fontWeight: 700 }}>
                            {g.goal_count} reg
                          </span>
                        )}
                        {g.goal_avg_seconds != null && (
                          <span title={`Tempo médio: ${fmtDuration(g.goal_avg_seconds)}`} style={{ background: "var(--accent-2-soft)", color: "var(--accent-2)", padding: "2px 8px", borderRadius: 5, fontSize: 11, fontWeight: 700 }}>
                            {fmtDuration(g.goal_avg_seconds)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 140 }}>
                        <div style={{ flex: 1, height: 6, background: "var(--surface-sunken)", borderRadius: 3, overflow: "hidden" }}>
                          <div
                            style={{
                              height: "100%",
                              width: `${g.pctTotal}%`,
                              background: g.pctTotal === 100 ? "var(--ok)" : g.pctTotal >= 50 ? "var(--warning)" : "var(--accent)",
                              borderRadius: 3,
                              transition: "width 0.4s ease",
                            }}
                          />
                        </div>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, fontWeight: 700 }}>
                          {g.pctTotal}%
                        </span>
                      </div>
                    </td>
                    <td style={{ fontFamily: "var(--font-mono)" }}>
                      {g.progress.count}{g.goal_count != null ? ` / ${g.goal_count}` : ""}
                    </td>
                    <td style={{ fontFamily: "var(--font-mono)" }}>
                      {g.progress.avgSeconds > 0 ? fmtDuration(g.progress.avgSeconds) : "—"}
                    </td>
                    <td>
                      {g.pctTotal === 100 ? (
                        <span style={{ color: "var(--ok)", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <IconCheck size={12} /> Atingida
                        </span>
                      ) : g.pctTotal === 0 && g.progress.count === 0 ? (
                        <span style={{ color: "var(--danger)", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <IconX size={12} /> Sem progresso
                        </span>
                      ) : g.pctTotal >= 50 ? (
                        <span style={{ color: "var(--accent)", fontWeight: 600 }}>Em andamento</span>
                      ) : (
                        <span style={{ color: "var(--warning)", fontWeight: 600 }}>Em risco</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {ranking.length === 0 && !loading && (
        <div className="card">
          <div className="schedule-empty">
            <div className="schedule-empty-icon"><IconTarget size={36} /></div>
            <div>Nenhuma meta definida para esse período.</div>
            <p style={{ marginTop: 10, fontSize: 12.5 }}>
              Peça ao administrador para configurar as metas em "Metas individuais".
            </p>
          </div>
        </div>
      )}
    </div>
  );
}