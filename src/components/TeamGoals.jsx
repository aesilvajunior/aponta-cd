import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import { fetchEntries, fetchTeamGoals, upsertTeamGoal, deleteTeamGoal } from "../lib/api";
import { fmtDuration, todayLocalISODate } from "../lib/format";
import { IconTarget, IconPlus, IconTrash, IconRefresh, IconCheck, IconEdit } from "./Icons";

const PERIOD_TYPES = [
  { value: "dia", label: "Hoje" },
  { value: "semana", label: "Esta semana" },
  { value: "mes", label: "Este mês" },
];

function getPeriodKey(type) {
  const d = new Date();
  if (type === "dia") return todayLocalISODate();
  if (type === "mes") {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  // semana ISO
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  return `sem_${todayLocalISODate()}`;
}

export default function TeamGoals({ teams = [] }) {
  const [periodType, setPeriodType] = useState("mes");
  const [goals, setGoals] = useState([]);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [newTeam, setNewTeam] = useState("");
  const [newCount, setNewCount] = useState("");
  const [newAvg, setNewAvg] = useState("");
  const [newProblem, setNewProblem] = useState("");
  const [busy, setBusy] = useState(false);

  const periodKey = useMemo(() => getPeriodKey(periodType), [periodType]);

  async function load() {
    setLoading(true);
    const [{ data: g }, { data: e }] = await Promise.all([
      fetchTeamGoals({ periodType, periodKey }),
      fetchEntries({ limit: 5000 }),
    ]);
    setGoals(g || []);
    setEntries(e || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const ch = supabase
      .channel("team-goals")
      .on("postgres_changes", { event: "*", schema: "public", table: "team_goals" }, load)
      .subscribe();
    return () => supabase.removeChannel(ch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodType, periodKey]);

  async function add() {
    const name = newTeam.trim();
    if (!name) return setError("Digite o nome da equipe.");
    const count = newCount ? Number(newCount) : null;
    const avg = newAvg ? Number(newAvg) * 60 : null;
    const prob = newProblem ? Number(newProblem) : null;
    if (!count && !avg) return setError("Defina pelo menos uma meta.");

    setBusy(true);
    setError("");
    const { error: err } = await upsertTeamGoal({
      teamName: name,
      periodType,
      periodKey,
      goalCount: count,
      goalAvgSeconds: avg,
      goalMaxProblemRate: prob,
      note: null,
    });
    setBusy(false);
    if (err) return setError(err.message);
    setNewTeam(""); setNewCount(""); setNewAvg(""); setNewProblem("");
    await load();
  }

  async function remove(g) {
    if (!window.confirm(`Remover meta da equipe "${g.team_name}"?`)) return;
    await deleteTeamGoal(g.id);
    await load();
  }

  // Calcula progresso. Assumimos que "equipe" é o campo `team_name` que pode ser casado
  // por `role` do operador ou qualquer outra regra. Aqui usamos o `role` como time.
  function progressFor(teamName, goal) {
    const inPeriod = entries.filter((e) => {
      const d = new Date(e.start_time);
      if (periodType === "dia") return todayLocalISODate() === todayLocalISODate(d);
      if (periodType === "mes") {
        const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        return k === periodKey;
      }
      // semana: últimos 7 dias
      return (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24) <= 7;
    });

    // Considera todos os registros (não temos mapeamento direto team x operador)
    // Se você tem `role` de operador = nome do time, filtra aqui.
    const filtered = inPeriod;

    const count = filtered.length;
    const avgSec = count > 0 ? filtered.reduce((s, e) => s + (e.duration_seconds || 0), 0) / count : 0;
    const countPct = goal.goal_count ? Math.min(100, Math.round((count / goal.goal_count) * 100)) : null;
    const avgPct = goal.goal_avg_seconds && avgSec > 0
      ? Math.min(100, Math.round((goal.goal_avg_seconds / avgSec) * 100))
      : null;
    return { count, avgSec, countPct, avgPct };
  }

  return (
    <div>
      <div className="page-header-row" style={{ marginBottom: 20 }}>
        <div>
          <h1 className="page-title">Metas por equipe</h1>
          <p className="page-sub" style={{ marginBottom: 0 }}>
            Metas coletivas com acompanhamento ao vivo
          </p>
        </div>
        <button className="btn-small" onClick={load}><IconRefresh size={14} /> Atualizar</button>
      </div>

      {error && <div className="alert-card alert-danger" style={{ marginBottom: 20 }}>{error}</div>}

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

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <IconPlus size={16} /> Nova meta
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input
            className="field"
            style={{ flex: 1, minWidth: 180 }}
            placeholder="Nome da equipe (ex: Manhã, Tarde, AP)"
            value={newTeam}
            onChange={(e) => setNewTeam(e.target.value)}
            disabled={busy}
          />
          <input
            className="field"
            style={{ width: 130, fontFamily: "var(--font-mono)", textAlign: "center" }}
            placeholder="Nº registros"
            type="number"
            value={newCount}
            onChange={(e) => setNewCount(e.target.value.replace(/\D/g, ""))}
            disabled={busy}
          />
          <input
            className="field"
            style={{ width: 130, fontFamily: "var(--font-mono)", textAlign: "center" }}
            placeholder="Média (min)"
            type="number"
            value={newAvg}
            onChange={(e) => setNewAvg(e.target.value.replace(/\D/g, ""))}
            disabled={busy}
          />
          <input
            className="field"
            style={{ width: 140, fontFamily: "var(--font-mono)", textAlign: "center" }}
            placeholder="Máx. % prob."
            type="number"
            value={newProblem}
            onChange={(e) => setNewProblem(e.target.value.replace(/\D/g, ""))}
            disabled={busy}
          />
          <button className="btn-small btn-excel" onClick={add} disabled={busy}>
            <IconPlus size={14} /> Adicionar
          </button>
        </div>
      </div>

      {loading ? (
        <div className="schedule-empty">Carregando...</div>
      ) : goals.length === 0 ? (
        <div className="card">
          <div className="schedule-empty">
            <div className="schedule-empty-icon"><IconTarget size={36} /></div>
            <div>Nenhuma meta de equipe definida neste período.</div>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {goals.map((g) => {
            const prog = progressFor(g.team_name, g);
            const completedCount = prog.countPct === 100;
            const completedAvg = prog.avgPct === 100;
            const isDone = (g.goal_count ? completedCount : true) && (g.goal_avg_seconds ? completedAvg : true);

            return (
              <div key={g.id} className="card" style={{ borderLeft: `4px solid ${isDone ? "var(--ok)" : "var(--accent)"}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14, gap: 12 }}>
                  <div style={{ fontSize: 17, fontWeight: 700 }}>{g.team_name}</div>
                  <button
                    className="btn-small"
                    style={{ padding: "5px 10px", color: "var(--danger)", borderColor: "var(--danger)" }}
                    onClick={() => remove(g)}
                    title="Remover"
                  >
                    <IconTrash size={12} />
                  </button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
                  {g.goal_count != null && (
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 6 }}>
                        <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>Quantidade</span>
                        <span style={{ fontFamily: "var(--font-mono)" }}>{prog.count} / {g.goal_count}</span>
                      </div>
                      <div style={{ height: 8, background: "var(--surface-sunken)", borderRadius: 4, overflow: "hidden" }}>
                        <div style={{
                          height: "100%", width: `${prog.countPct}%`,
                          background: completedCount ? "var(--ok)" : prog.countPct >= 80 ? "var(--warning)" : "var(--accent)",
                          transition: "width 0.4s ease",
                        }} />
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 5 }}>
                        {prog.countPct}% {completedCount && "· meta atingida"}
                      </div>
                    </div>
                  )}

                  {g.goal_avg_seconds != null && (
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 6 }}>
                        <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>Tempo médio</span>
                        <span style={{ fontFamily: "var(--font-mono)" }}>
                          {prog.avgSec > 0 ? fmtDuration(Math.round(prog.avgSec)) : "—"} / {fmtDuration(g.goal_avg_seconds)}
                        </span>
                      </div>
                      <div style={{ height: 8, background: "var(--surface-sunken)", borderRadius: 4, overflow: "hidden" }}>
                        <div style={{
                          height: "100%", width: `${prog.avgPct || 0}%`,
                          background: completedAvg ? "var(--ok)" : prog.avgPct >= 80 ? "var(--warning)" : "var(--accent)",
                          transition: "width 0.4s ease",
                        }} />
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 5 }}>
                        {prog.avgSec > 0 ? (completedAvg ? "dentro da meta" : "fora da meta") : "sem registros"}
                      </div>
                    </div>
                  )}
                </div>

                {isDone && (
                  <div style={{ marginTop: 14, padding: "8px 12px", background: "var(--ok-soft)", border: "1px solid var(--ok)", borderRadius: 8, color: "var(--ok)", fontSize: 13, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <IconCheck size={14} /> Meta da equipe atingida
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}