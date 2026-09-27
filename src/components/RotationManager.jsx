import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import {
  fetchRotationTasks,
  fetchRotationAssignments,
  clearWeekAssignments,
  persistRotation,
  generateRotation,
  operatorsForCategory,
  getMondayOfWeek,
  addDays,
  isoDate,
  weekDates,
  WEEKDAY_LABELS,
  WEEKDAY_LONG,
  rotationToCsv,
} from "../lib/rotation";
import { deleteRotationTask } from "../lib/rotation";
import { fmtDate } from "../lib/format";
import RotationTaskModal from "./RotationTaskModal";
import RotationCellEditor from "./RotationCellEditor";
import {
  IconPlus,
  IconRefresh,
  IconTrash,
  IconEdit,
  IconChevronLeft,
  IconChevronRight,
  IconDownload,
  IconRotateCcw,
  IconAlertTriangle,
  IconCheck,
  IconTarget,
} from "./Icons";

export default function RotationManager({ operators = [], isAdmin }) {
  const [tasks, setTasks] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [monday, setMonday] = useState(() => getMondayOfWeek(new Date()));
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [cellEditor, setCellEditor] = useState(null);

  const dates = useMemo(() => weekDates(monday), [monday]);
  const fromDate = dates[0];
  const toDate = dates[6];

  async function load() {
    setLoading(true);
    const [{ data: t }, { data: a }] = await Promise.all([
      fetchRotationTasks(),
      fetchRotationAssignments({ from: fromDate, to: toDate }),
    ]);
    setTasks(t || []);
    setAssignments(a || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const ch = supabase
      .channel("rotation-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "rotation_tasks" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "rotation_assignments" }, load)
      .subscribe();
    return () => supabase.removeChannel(ch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromDate, toDate]);

  // Mapa: "taskId|dateISO" -> [assignments]
  const assignmentMap = useMemo(() => {
    const m = {};
    assignments.forEach((a) => {
      const key = `${a.task_id}|${a.scheduled_date}`;
      if (!m[key]) m[key] = [];
      m[key].push(a);
    });
    return m;
  }, [assignments]);

  // Categorias em uso
  const categoriesInUse = useMemo(() => {
    const set = new Set(tasks.map((t) => t.category));
    return Array.from(set).sort();
  }, [tasks]);

  function changeWeek(delta) {
    setMonday((m) => addDays(m, delta * 7));
  }

  function goToToday() {
    setMonday(getMondayOfWeek(new Date()));
  }

  // ---------- Ações ----------
  async function handleGenerateWeek() {
    if (!window.confirm(
      "Preencher automaticamente a semana?\n\n" +
      "Isso substitui as atribuições já existentes nesta semana. As edições manuais feitas célula a célula serão perdidas."
    )) return;

    setBusy(true);
    setError("");

    // Limpa a semana
    const { error: clearErr } = await clearWeekAssignments(fromDate, toDate);
    if (clearErr) {
      setBusy(false);
      return setError(clearErr.message);
    }

    // Gera
    const rows = generateRotation({
      tasks,
      operators,
      mondayISO: fromDate,
    });

    if (rows.length === 0) {
      setBusy(false);
      return setError("Nada foi gerado. Verifique se há operadores com papéis compatíveis cadastrados em Cadastros.");
    }

    const { error: insErr } = await persistRotation(rows);
    setBusy(false);
    if (insErr) return setError(insErr.message);
    await load();
  }

  async function handleClearWeek() {
    if (!window.confirm("Apagar TODAS as atribuições desta semana?")) return;
    setBusy(true);
    await clearWeekAssignments(fromDate, toDate);
    setBusy(false);
    await load();
  }

  async function handleRemoveTask(task) {
    if (!window.confirm(`Remover a tarefa "${task.name}"? As atribuições dela nesta semana somem também.`)) return;
    setBusy(true);
    await deleteRotationTask(task.id);
    setBusy(false);
    await load();
  }

  function openNewTask() {
    setEditingTask(null);
    setTaskModalOpen(true);
  }

  function openEditTask(task) {
    setEditingTask(task);
    setTaskModalOpen(true);
  }

  function openCellEditor(task, dateISO) {
    const key = `${task.id}|${dateISO}`;
    const initial = assignmentMap[key] || [];
    const available = operatorsForCategory(operators, task.category);
    setCellEditor({ task, dateISO, initial, available });
  }

  function handleExportCsv() {
    const csv = rotationToCsv({
      tasks,
      dates,
      assignmentMap: Object.fromEntries(
        Object.entries(assignmentMap).map(([k, v]) => [k, v])
      ),
      categories: categoriesInUse,
    });
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rotacao_${fromDate}_a_${toDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ---------- Render ----------
  const weekLabel = `${fmtDate(dates[0] + "T12:00:00")} — ${fmtDate(dates[6] + "T12:00:00")}`;

  return (
    <div>
      <div className="page-header-row" style={{ marginBottom: 22 }}>
        <div>
          <h1 className="page-title">Rotação de atividades</h1>
          <p className="page-sub" style={{ marginBottom: 0 }}>
            Distribua as tarefas por dia da semana · {tasks.length} tarefa(s) cadastrada(s)
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn-small" onClick={load}>
            <IconRefresh size={14} /> Atualizar
          </button>
          <button className="btn-small" onClick={handleExportCsv}>
            <IconDownload size={14} /> Exportar CSV
          </button>
        </div>
      </div>

      {error && (
        <div className="alert-card alert-danger" style={{ marginBottom: 16 }}>
          {error}
          <button className="btn-small" style={{ marginLeft: 12 }} onClick={() => setError("")}>Fechar</button>
        </div>
      )}

      {/* Navegação de semana */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <button className="btn-small" onClick={() => changeWeek(-1)}>
            <IconChevronLeft size={14} /> Semana anterior
          </button>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.015em" }}>{weekLabel}</div>
            <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 3 }}>
              {assignments.length} atribuições nesta semana
            </div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button className="btn-small" onClick={goToToday}>Hoje</button>
            <button className="btn-small" onClick={() => changeWeek(1)}>
              Próxima semana <IconChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Ações */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title">Ações da semana</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="btn-small btn-excel" onClick={handleGenerateWeek} disabled={busy}>
            <IconRotateCcw size={14} /> Preencher automaticamente
          </button>
          <button className="btn-small" onClick={openNewTask} disabled={busy}>
            <IconPlus size={14} /> Nova tarefa
          </button>
          <button className="btn-small" onClick={handleClearWeek} disabled={busy} style={{ color: "var(--danger)", borderColor: "var(--danger)" }}>
            <IconTrash size={14} /> Limpar semana
          </button>
          {operatorsForCategory(operators, "Separação").length === 0 && (
            <span style={{ fontSize: 12, color: "var(--warning)", display: "inline-flex", alignItems: "center", gap: 6 }}>
              <IconAlertTriangle size={13} />
              Nenhum operador com papel "Separação" cadastrado
            </span>
          )}
        </div>
      </div>

      {loading ? (
        <div className="schedule-empty">Carregando...</div>
      ) : tasks.length === 0 ? (
        <div className="card">
          <div className="schedule-empty">
            <div className="schedule-empty-icon"><IconTarget size={36} /></div>
            <div>Nenhuma tarefa cadastrada ainda.</div>
            <button className="btn-small btn-excel" style={{ marginTop: 16 }} onClick={openNewTask}>
              <IconPlus size={14} /> Criar primeira tarefa
            </button>
          </div>
        </div>
      ) : (
        categoriesInUse.map((cat) => {
          const catTasks = tasks.filter((t) => t.category === cat);
          if (catTasks.length === 0) return null;
          return (
            <div key={cat} className="card" style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <div
                  className="card-title"
                  style={{ marginBottom: 0, display: "flex", alignItems: "center", gap: 8 }}
                >
                  {cat}
                  <span style={{ fontSize: 11.5, color: "var(--text-faint)", fontWeight: 400 }}>
                    {catTasks.length} tarefa(s)
                  </span>
                </div>
              </div>

              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                  <thead>
                    <tr>
                      <th
                        style={{
                          textAlign: "left",
                          padding: "10px 12px",
                          borderBottom: "1px solid var(--border)",
                          minWidth: 220,
                          position: "sticky",
                          left: 0,
                          background: "var(--surface)",
                          zIndex: 1,
                        }}
                      >
                        Tarefa
                      </th>
                      {dates.map((d) => {
                        const wd = new Date(d + "T12:00:00").getDay();
                        const isWeekend = wd === 0 || wd === 6;
                        return (
                          <th
                            key={d}
                            style={{
                              padding: "10px 8px",
                              borderBottom: "1px solid var(--border)",
                              textAlign: "center",
                              minWidth: 130,
                              color: isWeekend ? "var(--text-faint)" : "var(--text-muted)",
                              fontWeight: 700,
                              fontSize: 11,
                              letterSpacing: "0.04em",
                              textTransform: "uppercase",
                            }}
                          >
                            {WEEKDAY_LABELS[wd]} {d.slice(8, 10)}/{d.slice(5, 7)}
                          </th>
                        );
                      })}
                      <th style={{ width: 80, borderBottom: "1px solid var(--border)" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {catTasks.map((task) => {
                      const days = task.days_of_week || [1, 2, 3, 4, 5];
                      return (
                        <tr key={task.id}>
                          <td
                            style={{
                              padding: "10px 12px",
                              borderBottom: "1px solid var(--border)",
                              fontWeight: 600,
                              fontFamily: "var(--font-display)",
                              position: "sticky",
                              left: 0,
                              background: "var(--surface)",
                              zIndex: 1,
                            }}
                          >
                            {task.name}
                            {task.kind === "equipe_fixa" && (
                              <span
                                style={{
                                  marginLeft: 8,
                                  fontSize: 10,
                                  background: "var(--accent-2-soft)",
                                  color: "var(--accent-2)",
                                  padding: "2px 6px",
                                  borderRadius: 4,
                                  fontWeight: 700,
                                }}
                              >
                                FIXA
                              </span>
                            )}
                          </td>
                          {dates.map((d) => {
                            const wd = new Date(d + "T12:00:00").getDay();
                            const appliesToDay = days.includes(wd);
                            const key = `${task.id}|${d}`;
                            const ops = assignmentMap[key] || [];
                            return (
                              <td
                                key={d}
                                onClick={() => isAdmin && appliesToDay && openCellEditor(task, d)}
                                style={{
                                  padding: "8px 10px",
                                  borderBottom: "1px solid var(--border)",
                                  textAlign: "center",
                                  cursor: isAdmin && appliesToDay ? "pointer" : "default",
                                  background: !appliesToDay
                                    ? "var(--surface-sunken)"
                                    : ops.length === 0
                                    ? "var(--surface)"
                                    : "var(--accent-soft)",
                                  color: !appliesToDay
                                    ? "var(--text-faint)"
                                    : ops.length === 0
                                    ? "var(--text-faint)"
                                    : "var(--text)",
                                  transition: "background 120ms ease",
                                  position: "relative",
                                }}
                                onMouseEnter={(e) => {
                                  if (isAdmin && appliesToDay) e.currentTarget.style.background = "var(--accent-soft)";
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = !appliesToDay
                                    ? "var(--surface-sunken)"
                                    : ops.length === 0
                                    ? "var(--surface)"
                                    : "var(--accent-soft)";
                                }}
                              >
                                {!appliesToDay
                                  ? "—"
                                  : ops.length === 0
                                  ? "+"
                                  : ops.map((o) => o.operator_name).join(", ")}
                              </td>
                            );
                          })}
                          <td style={{ padding: "8px", borderBottom: "1px solid var(--border)", textAlign: "center" }}>
                            {isAdmin && (
                              <>
                                <button
                                  className="btn-small"
                                  style={{ padding: "5px 9px", marginRight: 4 }}
                                  onClick={() => openEditTask(task)}
                                  title="Editar tarefa"
                                >
                                  <IconEdit size={12} />
                                </button>
                                <button
                                  className="btn-small"
                                  style={{ padding: "5px 9px", color: "var(--danger)", borderColor: "var(--danger)" }}
                                  onClick={() => handleRemoveTask(task)}
                                  title="Remover tarefa"
                                >
                                  <IconTrash size={12} />
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })
      )}

      {taskModalOpen && (
        <RotationTaskModal
          task={editingTask}
          categoriesInUse={categoriesInUse}
          onClose={() => { setTaskModalOpen(false); setEditingTask(null); }}
          onSaved={load}
        />
      )}

      {cellEditor && (
        <RotationCellEditor
          task={cellEditor.task}
          dateISO={cellEditor.dateISO}
          initialOperators={cellEditor.initial}
          availableOperators={cellEditor.available}
          onClose={() => setCellEditor(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}