import React, { useEffect, useMemo, useState } from "react";
import {
  fetchGoalsForCurrentPeriod,
  upsertGoal,
  deleteGoal,
  getGoalPeriodKey,
  formatGoalPeriod,
  computeGoalProgress,
  filterEntriesByGoalPeriod,
} from "../lib/goals";
import { fetchEntries } from "../lib/api";
import { supabase } from "../supabaseClient";
import { fmtDuration } from "../lib/format";
import {
  IconTarget,
  IconPlus,
  IconTrash,
  IconEdit,
  IconCheck,
  IconX,
  IconRefresh,
  IconTrendingUp,
} from "./Icons";

const PERIOD_TYPES = [
  { value: "dia", label: "Diária" },
  { value: "semana", label: "Semanal" },
  { value: "mes", label: "Mensal" },
];

export default function GoalsManager({ operators, isAdmin }) {
  const [goals, setGoals] = useState([]);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [periodType, setPeriodType] = useState("mes");

  // Form
  const [newOperator, setNewOperator] = useState("");
  const [newGoalCount, setNewGoalCount] = useState("");
  const [newGoalAvg, setNewGoalAvg] = useState("");
  const [newNote, setNewNote] = useState("");

  // Edit
  const [editingId, setEditingId] = useState(null);
  const [editValues, setEditValues] = useState({ goalCount: "", goalAvg: "", note: "" });

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
      .channel("goals-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "operator_goals" }, loadAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "entries" }, loadAll)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, []);

  const filteredGoals = useMemo(
    () => goals.filter((g) => g.period_type === periodType && g.period_key === periodKey),
    [goals, periodType, periodKey]
  );

  async function runAction(action, onSuccess) {
    setError("");
    setBusy(true);
    try {
      const { error: err } = await action();
      if (err) {
        setError(err.message || "Erro ao salvar.");
        return false;
      }
      await loadAll();
      onSuccess?.();
      return true;
    } finally {
      setBusy(false);
    }
  }

  async function handleAdd() {
    const op = operators.find((o) => o.code === newOperator);
    if (!op) return setError("Selecione um operador.");
    const count = newGoalCount.trim() ? Number(newGoalCount) : null;
    const avgMin = newGoalAvg.trim() ? Number(newGoalAvg) : null;
    if (!count && !avgMin) return setError("Defina pelo menos uma meta (quantidade ou tempo médio).");

    await runAction(
      () => upsertGoal({
        operatorCode: op.code,
        operatorName: op.name,
        periodType,
        periodKey,
        goalCount: count,
        goalAvgSeconds: avgMin ? avgMin * 60 : null,
        note: newNote,
      }),
      () => {
        setNewOperator("");
        setNewGoalCount("");
        setNewGoalAvg("");
        setNewNote("");
      }
    );
  }

  function startEdit(g) {
    setEditingId(g.id);
    setEditValues({
      goalCount: g.goal_count != null ? String(g.goal_count) : "",
      goalAvg: g.goal_avg_seconds != null ? String(Math.round(g.goal_avg_seconds / 60)) : "",
      note: g.note || "",
    });
  }

  function cancelEdit() { setEditingId(null); }

  async function saveEdit(g) {
    const count = editValues.goalCount.trim() ? Number(editValues.goalCount) : null;
    const avgMin = editValues.goalAvg.trim() ? Number(editValues.goalAvg) : null;
    if (!count && !avgMin) return setError("Defina pelo menos uma meta.");

    await runAction(
      () => upsertGoal({
        operatorCode: g.operator_code,
        operatorName: g.operator_name,
        periodType: g.period_type,
        periodKey: g.period_key,
        goalCount: count,
        goalAvgSeconds: avgMin ? avgMin * 60 : null,
        note: editValues.note,
      }),
      () => setEditingId(null)
    );
  }

  async function handleRemove(g) {
    if (!window.confirm(`Remover meta de ${g.operator_name}?`)) return;
    await runAction(() => deleteGoal(g.id));
  }

  return (
    <div>
      <div className="page-header-row" style={{ marginBottom: 22 }}>
        <div>
          <h1 className="page-title">Metas individuais</h1>
          <p className="page-sub" style={{ marginBottom: 0 }}>
            Defina metas de quantidade e/ou tempo médio por operador
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

      {/* Filtro de período */}
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
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.015em" }}>
            {formatGoalPeriod(periodKey, periodType)}
          </div>
          <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 3 }}>
            {filteredGoals.length} meta(s) definida(s)
          </div>
        </div>
      </div>

      {/* Adicionar meta */}
      {isAdmin && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <IconPlus size={16} /> Nova meta
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <select
              className="field"
              style={{ flex: 1, minWidth: 200 }}
              value={newOperator}
              onChange={(e) => setNewOperator(e.target.value)}
              disabled={busy}
            >
              <option value="">Selecione o operador...</option>
              {operators.map((o) => <option key={o.code} value={o.code}>{o.name} #{o.code}</option>)}
            </select>
            <input
              className="field"
              style={{ width: 140, fontFamily: "var(--font-mono)", textAlign: "center" }}
              placeholder="Nº registros"
              type="number"
              min="1"
              value={newGoalCount}
              onChange={(e) => setNewGoalCount(e.target.value.replace(/\D/g, ""))}
              disabled={busy}
              title="Meta de quantidade"
            />
            <input
              className="field"
              style={{ width: 140, fontFamily: "var(--font-mono)", textAlign: "center" }}
              placeholder="Média (min)"
              type="number"
              min="1"
              value={newGoalAvg}
              onChange={(e) => setNewGoalAvg(e.target.value.replace(/\D/g, ""))}
              disabled={busy}
              title="Meta de tempo médio"
            />
            <input
              className="field"
              style={{ flex: 2, minWidth: 200 }}
              placeholder="Observação (opcional)"
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              disabled={busy}
            />
            <button className="btn-small btn-excel" onClick={handleAdd} disabled={busy}>
              <IconPlus size={14} /> Adicionar
            </button>
          </div>
        </div>
      )}

      {/* Lista de metas */}
      {loading ? (
        <div className="schedule-empty">
          <div className="loading-spinner" style={{ margin: "0 auto 14px auto" }} />
          <div>Carregando...</div>
        </div>
      ) : filteredGoals.length === 0 ? (
        <div className="card">
          <div className="schedule-empty">
            <div className="schedule-empty-icon"><IconTarget size={36} /></div>
            <div>Nenhuma meta definida nesse período.</div>
            {isAdmin && <p style={{ marginTop: 8, fontSize: 12.5 }}>Adicione acima pra começar.</p>}
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {filteredGoals.map((g) => {
            const periodEntries = filterEntriesByGoalPeriod(entries, g.period_type, g.period_key);
            const progress = computeGoalProgress(g, periodEntries);
            const isEditing = editingId === g.id;

            const countPct = g.goal_count ? Math.min(100, Math.round((progress.count / g.goal_count) * 100)) : null;
            const avgPct = g.goal_avg_seconds && progress.avgSeconds > 0
              ? Math.min(100, Math.round((g.goal_avg_seconds / progress.avgSeconds) * 100))
              : null;

            return (
              <div key={g.id} className="card">
                {isEditing ? (
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>
                      Editar meta de {g.operator_name}
                    </div>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
                      <input
                        className="field"
                        style={{ width: 150, fontFamily: "var(--font-mono)", textAlign: "center" }}
                        placeholder="Nº registros"
                        type="number"
                        value={editValues.goalCount}
                        onChange={(e) => setEditValues((v) => ({ ...v, goalCount: e.target.value.replace(/\D/g, "") }))}
                        disabled={busy}
                      />
                      <input
                        className="field"
                        style={{ width: 150, fontFamily: "var(--font-mono)", textAlign: "center" }}
                        placeholder="Média (min)"
                        type="number"
                        value={editValues.goalAvg}
                        onChange={(e) => setEditValues((v) => ({ ...v, goalAvg: e.target.value.replace(/\D/g, "") }))}
                        disabled={busy}
                      />
                      <input
                        className="field"
                        style={{ flex: 1, minWidth: 180 }}
                        placeholder="Observação"
                        value={editValues.note}
                        onChange={(e) => setEditValues((v) => ({ ...v, note: e.target.value }))}
                        disabled={busy}
                      />
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button className="btn-small btn-excel" onClick={() => saveEdit(g)} disabled={busy}>
                        <IconCheck size={14} /> Salvar
                      </button>
                      <button className="btn-small" onClick={cancelEdit} disabled={busy}>Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
                      <div>
                        <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.015em" }}>
                          {g.operator_name} <span style={{ color: "var(--text-faint)", fontWeight: 400, fontSize: 13 }}>#{g.operator_code}</span>
                        </div>
                        {g.note && (
                          <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 4, fontStyle: "italic" }}>
                            {g.note}
                          </div>
                        )}
                      </div>
                      {isAdmin && (
                        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                          <button className="btn-small" style={{ padding: "6px 10px" }} onClick={() => startEdit(g)} disabled={busy} title="Editar">
                            <IconEdit size={13} />
                          </button>
                          <button className="btn-small" style={{ padding: "6px 10px", color: "var(--danger)", borderColor: "var(--danger)" }} onClick={() => handleRemove(g)} disabled={busy} title="Remover">
                            <IconTrash size={13} />
                          </button>
                        </div>
                      )}
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
                      {g.goal_count != null && (
                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 6 }}>
                            <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>Quantidade</span>
                            <span style={{ fontFamily: "var(--font-mono)" }}>
                              {progress.count} / {g.goal_count}
                            </span>
                          </div>
                          <div style={{ height: 8, background: "var(--surface-sunken)", borderRadius: 4, overflow: "hidden" }}>
                            <div
                              style={{
                                height: "100%",
                                width: `${countPct}%`,
                                background: progress.goalsMet.count ? "var(--ok)" : countPct >= 80 ? "var(--warning)" : "var(--accent)",
                                borderRadius: 4,
                                transition: "width 0.4s ease",
                              }}
                            />
                          </div>
                          <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 5 }}>
                            {countPct}% {progress.goalsMet.count && "· meta atingida"}
                          </div>
                        </div>
                      )}

                      {g.goal_avg_seconds != null && (
                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 6 }}>
                            <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>Tempo médio</span>
                            <span style={{ fontFamily: "var(--font-mono)" }}>
                              {progress.avgSeconds > 0 ? fmtDuration(progress.avgSeconds) : "—"} / {fmtDuration(g.goal_avg_seconds)}
                            </span>
                          </div>
                          <div style={{ height: 8, background: "var(--surface-sunken)", borderRadius: 4, overflow: "hidden" }}>
                            <div
                              style={{
                                height: "100%",
                                width: `${avgPct || 0}%`,
                                background: progress.goalsMet.avg ? "var(--ok)" : avgPct >= 80 ? "var(--warning)" : "var(--accent)",
                                borderRadius: 4,
                                transition: "width 0.4s ease",
                              }}
                            />
                          </div>
                          <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 5 }}>
                            {progress.avgSeconds > 0
                              ? progress.goalsMet.avg ? "dentro da meta" : "fora da meta"
                              : "sem registros ainda"}
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}