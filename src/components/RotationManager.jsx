import React, { useEffect, useMemo, useState } from "react";
import {
  fetchRotationTasks,
  addRotationTask,
  updateRotationTask,
  deleteRotationTask,
  fetchRotationAssignments,
  updateAssignmentStatus,
  deleteRotationAssignment,
  autoRotateAssignments,
  getPeriodKey,
  formatPeriodKey,
  getPreviousPeriodKey,
} from "../lib/rotation";
import { supabase } from "../supabaseClient";
import {
  IconPlus,
  IconEdit,
  IconTrash,
  IconCheck,
  IconX,
  IconRefresh,
  IconRotateCcw,
  IconActivity,
  IconUsers,
  IconChevronLeft,
  IconChevronRight,
  IconAlertTriangle,
} from "./Icons";

const FREQUENCIES = [
  { value: "diaria", label: "Diária" },
  { value: "semanal", label: "Semanal" },
  { value: "mensal", label: "Mensal" },
];

const STATUS = {
  pendente: { label: "Pendente", color: "var(--warning)" },
  concluida: { label: "Concluída", color: "var(--ok)" },
  pulada: { label: "Pulada", color: "var(--text-muted)" },
};

export default function RotationManager({ operators, isAdmin }) {
  const [tasks, setTasks] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [frequencyFilter, setFrequencyFilter] = useState("semanal");
  const [periodKey, setPeriodKey] = useState(() => getPeriodKey("semanal"));

  // Form nova tarefa
  const [newTaskName, setNewTaskName] = useState("");
  const [newTaskDesc, setNewTaskDesc] = useState("");
  const [newTaskFreq, setNewTaskFreq] = useState("semanal");

  // Edição tarefa
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editTaskValues, setEditTaskValues] = useState({ name: "", description: "", frequency: "semanal" });

  async function loadAll() {
    setLoading(true);
    const [{ data: t, error: e1 }, { data: a, error: e2 }] = await Promise.all([
      fetchRotationTasks(),
      fetchRotationAssignments(periodKey),
    ]);
    if (e1 || e2) {
      setError((e1 || e2).message);
      setLoading(false);
      return;
    }
    setTasks(t || []);
    setAssignments(a || []);
    setError("");
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    const ch = supabase
      .channel("rotation-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "rotation_tasks" }, loadAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "rotation_assignments" }, loadAll)
      .subscribe();
    return () => supabase.removeChannel(ch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodKey]);

  // Ajusta periodKey quando o filtro muda
  useEffect(() => {
    setPeriodKey(getPeriodKey(frequencyFilter));
  }, [frequencyFilter]);

  const tasksOfFrequency = useMemo(
    () => tasks.filter((t) => t.frequency === frequencyFilter && t.active),
    [tasks, frequencyFilter]
  );

  const assignmentsByTask = useMemo(() => {
    const map = {};
    assignments.forEach((a) => {
      if (!map[a.task_id]) map[a.task_id] = [];
      map[a.task_id].push(a);
    });
    return map;
  }, [assignments]);

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

  function nextSortOrder() {
    return tasks.length > 0 ? Math.max(...tasks.map((t) => t.sort_order || 0)) + 1 : 0;
  }

  async function handleAddTask() {
    const name = newTaskName.trim();
    if (!name) return setError("Digite o nome da tarefa.");
    await runAction(
      () => addRotationTask({ name, description: newTaskDesc, frequency: newTaskFreq, sortOrder: nextSortOrder() }),
      () => { setNewTaskName(""); setNewTaskDesc(""); }
    );
  }

  function startEditTask(t) {
    setEditingTaskId(t.id);
    setEditTaskValues({ name: t.name, description: t.description || "", frequency: t.frequency });
  }

  function cancelEditTask() {
    setEditingTaskId(null);
  }

  async function saveEditTask(t) {
    const name = editTaskValues.name.trim();
    if (!name) return setError("Nome não pode ficar em branco.");
    await runAction(
      () => updateRotationTask(t.id, {
        name,
        description: editTaskValues.description.trim() || null,
        frequency: editTaskValues.frequency,
      }),
      () => setEditingTaskId(null)
    );
  }

  async function handleRemoveTask(t) {
    if (!window.confirm(`Remover a tarefa "${t.name}"? As atribuições existentes serão apagadas também.`)) return;
    await runAction(() => deleteRotationTask(t.id));
  }

  async function handleAutoRotate() {
    if (operators.length === 0) return setError("Nenhum operador cadastrado.");
    if (tasksOfFrequency.length === 0) return setError("Nenhuma tarefa ativa nessa frequência.");
    if (!window.confirm(`Gerar rotação automática para o período atual? Isso substitui as atribuições existentes.`)) return;
    await runAction(() =>
      autoRotateAssignments({
        periodKey,
        frequency: frequencyFilter,
        taskIds: tasksOfFrequency.map((t) => t.id),
        operators,
      })
    );
  }

  async function cycleStatus(assignment) {
    const order = ["pendente", "concluida", "pulada"];
    const currentIdx = order.indexOf(assignment.status);
    const nextStatus = order[(currentIdx + 1) % order.length];
    await runAction(() => updateAssignmentStatus(assignment.id, nextStatus));
  }

  async function handleRemoveAssignment(a) {
    if (!window.confirm(`Remover atribuição de ${a.operator_name}?`)) return;
    await runAction(() => deleteRotationAssignment(a.id));
  }

  function changePeriod(direction) {
    if (direction === -1) {
      setPeriodKey(getPreviousPeriodKey(frequencyFilter, periodKey));
    } else {
      // Próximo período
      setPeriodKey(getPeriodKey(frequencyFilter, new Date(Date.now() + 1000)));
    }
  }

  return (
    <div>
      <div className="page-header-row" style={{ marginBottom: 22 }}>
        <div>
          <h1 className="page-title">Rotação de atividades</h1>
          <p className="page-sub" style={{ marginBottom: 0 }}>
            Distribui tarefas periódicas (limpezas, organizações, inventários) entre a equipe
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

      {/* Filtro de frequência */}
      <div className="quick-filters" style={{ marginBottom: 20 }}>
        <span className="quick-filters-label">Frequência:</span>
        {FREQUENCIES.map((f) => (
          <button
            key={f.value}
            className={`quick-filter-btn ${frequencyFilter === f.value ? "active" : ""}`}
            onClick={() => setFrequencyFilter(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Navegação de período */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <button className="btn-small" onClick={() => changePeriod(-1)}>
            <IconChevronLeft size={14} /> Período anterior
          </button>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.015em" }}>
              {formatPeriodKey(periodKey, frequencyFilter)}
            </div>
            <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 3 }}>
              {assignments.length} atribuições · {assignments.filter((a) => a.status === "concluida").length} concluídas
            </div>
          </div>
          <button className="btn-small" onClick={() => changePeriod(1)}>
            Próximo período <IconChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Adicionar tarefa (só admin) */}
      {isAdmin && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <IconPlus size={16} /> Nova tarefa
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <input
              className="field"
              style={{ flex: 1, minWidth: 180 }}
              placeholder="Nome (ex: Limpeza corredor A)"
              value={newTaskName}
              onChange={(e) => setNewTaskName(e.target.value)}
              disabled={busy}
            />
            <input
              className="field"
              style={{ flex: 2, minWidth: 220 }}
              placeholder="Descrição (opcional)"
              value={newTaskDesc}
              onChange={(e) => setNewTaskDesc(e.target.value)}
              disabled={busy}
            />
            <select
              className="field"
              style={{ width: 140 }}
              value={newTaskFreq}
              onChange={(e) => setNewTaskFreq(e.target.value)}
              disabled={busy}
            >
              {FREQUENCIES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
            <button className="btn-small btn-excel" onClick={handleAddTask} disabled={busy}>
              <IconPlus size={14} /> Adicionar
            </button>
          </div>
        </div>
      )}

      {/* Ações do período */}
      {isAdmin && tasksOfFrequency.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-title">Ações do período</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <button className="btn-small btn-excel" onClick={handleAutoRotate} disabled={busy}>
              <IconRotateCcw size={14} /> Rotação automática
            </button>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
              Distribui as {tasksOfFrequency.length} tarefas ativas em round-robin entre {operators.length} operadores
            </span>
          </div>
        </div>
      )}

      {/* Lista de tarefas com atribuições */}
      {loading ? (
        <div className="schedule-empty">
          <div className="loading-spinner" style={{ margin: "0 auto 14px auto" }} />
          <div>Carregando...</div>
        </div>
      ) : tasksOfFrequency.length === 0 ? (
        <div className="card">
          <div className="schedule-empty">
            <div className="schedule-empty-icon"><IconActivity size={36} /></div>
            <div>Nenhuma tarefa {FREQUENCIES.find((f) => f.value === frequencyFilter)?.label.toLowerCase()} cadastrada.</div>
            {isAdmin && <p style={{ marginTop: 8, fontSize: 12.5 }}>Crie uma acima pra começar.</p>}
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {tasksOfFrequency.map((task) => {
            const taskAssignments = assignmentsByTask[task.id] || [];
            const isEditing = editingTaskId === task.id;
            const doneCount = taskAssignments.filter((a) => a.status === "concluida").length;
            return (
              <div key={task.id} className="card">
                {isEditing ? (
                  <div>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
                      <input
                        className="field"
                        style={{ flex: 1, minWidth: 180 }}
                        value={editTaskValues.name}
                        onChange={(e) => setEditTaskValues((v) => ({ ...v, name: e.target.value }))}
                        disabled={busy}
                      />
                      <input
                        className="field"
                        style={{ flex: 2, minWidth: 220 }}
                        placeholder="Descrição"
                        value={editTaskValues.description}
                        onChange={(e) => setEditTaskValues((v) => ({ ...v, description: e.target.value }))}
                        disabled={busy}
                      />
                      <select
                        className="field"
                        style={{ width: 140 }}
                        value={editTaskValues.frequency}
                        onChange={(e) => setEditTaskValues((v) => ({ ...v, frequency: e.target.value }))}
                        disabled={busy}
                      >
                        {FREQUENCIES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                      </select>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button className="btn-small btn-excel" onClick={() => saveEditTask(task)} disabled={busy}>
                        <IconCheck size={14} /> Salvar
                      </button>
                      <button className="btn-small" onClick={cancelEditTask} disabled={busy}>Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.015em" }}>
                          {task.name}
                        </div>
                        {task.description && (
                          <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
                            {task.description}
                          </div>
                        )}
                        <div style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 6 }}>
                          {taskAssignments.length} pessoa(s) atribuída(s) · {doneCount} concluída(s)
                        </div>
                      </div>
                      {isAdmin && (
                        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                          <button className="btn-small" style={{ padding: "6px 10px" }} onClick={() => startEditTask(task)} disabled={busy} title="Editar">
                            <IconEdit size={13} />
                          </button>
                          <button className="btn-small" style={{ padding: "6px 10px", color: "var(--danger)", borderColor: "var(--danger)" }} onClick={() => handleRemoveTask(task)} disabled={busy} title="Remover">
                            <IconTrash size={13} />
                          </button>
                        </div>
                      )}
                    </div>

                    {taskAssignments.length === 0 ? (
                      <div style={{ fontSize: 13, color: "var(--text-faint)", padding: "8px 0" }}>
                        Ninguém atribuído nesse período.
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {taskAssignments.map((a) => {
                          const st = STATUS[a.status] || STATUS.pendente;
                          return (
                            <div
                              key={a.id}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 12,
                                padding: "10px 14px",
                                background: "var(--surface-raised)",
                                border: "1px solid var(--border)",
                                borderLeft: `3px solid ${st.color}`,
                                borderRadius: 10,
                              }}
                            >
                              <div style={{
                                width: 30,
                                height: 30,
                                borderRadius: "50%",
                                background: "var(--accent-soft)",
                                color: "var(--accent)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: 12,
                                fontWeight: 700,
                                flexShrink: 0,
                              }}>
                                {a.operator_name.charAt(0).toUpperCase()}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13.5, fontWeight: 600 }}>{a.operator_name}</div>
                                {a.completed_at && (
                                  <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 2 }}>
                                    Concluída em {new Date(a.completed_at).toLocaleString("pt-BR")}
                                  </div>
                                )}
                                {a.note && (
                                  <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2, fontStyle: "italic" }}>
                                    {a.note}
                                  </div>
                                )}
                              </div>
                              <button
                                onClick={() => cycleStatus(a)}
                                disabled={busy}
                                style={{
                                  background: st.color,
                                  color: "#fff",
                                  border: "none",
                                  borderRadius: 8,
                                  padding: "6px 12px",
                                  fontSize: 11.5,
                                  fontWeight: 700,
                                  cursor: "pointer",
                                  fontFamily: "inherit",
                                  textTransform: "uppercase",
                                  letterSpacing: "0.04em",
                                }}
                                title="Clique para alternar status"
                              >
                                {st.label}
                              </button>
                              {isAdmin && (
                                <button className="btn-small" style={{ padding: "6px 9px", color: "var(--danger)", borderColor: "var(--danger)" }} onClick={() => handleRemoveAssignment(a)} disabled={busy} title="Remover">
                                  <IconX size={12} />
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
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