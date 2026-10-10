import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchRoutineConfig,
  fetchRoutineProgress,
  markRoutineStep,
  unmarkRoutineStep,
} from "../lib/api";
import PhysicalChecklist from "./PhysicalChecklist";
import InconsistencyList from "./InconsistencyList";
import RoutineHistory from "./RoutineHistory";

const todayISO = () => {
  const d = new Date();
  const brt = new Date(d.getTime() - 3 * 60 * 60 * 1000);
  return brt.toISOString().slice(0, 10);
};

export default function DailyRoutine({ currentOperator }) {
  const [subTab, setSubTab] = useState("today");   // today | checklist | incons | history
  const [steps, setSteps] = useState([]);
  const [progress, setProgress] = useState({});
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const date = todayISO();

  const load = useCallback(async () => {
    setLoading(true);
    const [cfg, prog] = await Promise.all([
      fetchRoutineConfig(),
      fetchRoutineProgress(date),
    ]);
    if (cfg.data) setSteps(cfg.data.filter((s) => s.active));
    const map = {};
    (prog.data ?? []).forEach((p) => (map[p.step_key] = p));
    setProgress(map);
    setLoading(false);
  }, [date]);

  useEffect(() => { load(); }, [load]);

  async function toggleStep(step) {
    const isDone = !!progress[step.step_key];
    if (isDone) {
      const { error } = await unmarkRoutineStep(date, step.step_key);
      if (error) return setToast({ type: "error", msg: error.message });
      setProgress((p) => { const c = { ...p }; delete c[step.step_key]; return c; });
    } else {
      const { error } = await markRoutineStep({ date, step_key: step.step_key, operator: currentOperator });
      if (error) return setToast({ type: "error", msg: error.message });
      setProgress((p) => ({
        ...p,
        [step.step_key]: {
          step_key: step.step_key,
          completed_at: new Date().toISOString(),
          completed_name: currentOperator?.name,
        },
      }));
    }
    setToast({ type: "ok", msg: isDone ? "Etapa desmarcada" : "Etapa concluída!" });
    setTimeout(() => setToast(null), 2000);
  }

  const doneCount = Object.keys(progress).length;
  const total = steps.length;
  const pct = total ? Math.round((doneCount / total) * 100) : 0;

  return (
    <div className="daily-routine">
      <header className="dr-header">
        <div>
          <h1>Rotina do Líder</h1>
          <p className="dr-date">{new Date(date + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}</p>
        </div>
        <div className="dr-progress-ring" style={{ "--pct": pct }}>
          <span>{doneCount}/{total}</span>
        </div>
      </header>

      <nav className="dr-tabs">
        <button className={subTab === "today" ? "active" : ""} onClick={() => setSubTab("today")}>Hoje</button>
        <button className={subTab === "checklist" ? "active" : ""} onClick={() => setSubTab("checklist")}>Checklist CD</button>
        <button className={subTab === "incons" ? "active" : ""} onClick={() => setSubTab("incons")}>Inconsistências</button>
        <button className={subTab === "history" ? "active" : ""} onClick={() => setSubTab("history")}>Histórico</button>
      </nav>

      {subTab === "today" && (
        <>
          {loading ? (
            <div className="dr-loading">Carregando...</div>
          ) : (
            <ul className="dr-steps">
              {steps.map((s) => {
                const done = progress[s.step_key];
                const late = isLate(s) && !done;
                return (
                  <li key={s.step_key} className={`dr-step ${done ? "done" : ""} ${late ? "late" : ""}`}>
                    <button className="dr-step-main" onClick={() => toggleStep(s)}>
                      <span className="dr-check">{done ? "✓" : ""}</span>
                      <span className="dr-info">
                        <strong>{s.label}</strong>
                        <small>{s.description}</small>
                        <small className="dr-deadline">
                          Prazo: {s.deadline_time}
                          {done && ` • concluído às ${new Date(done.completed_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} por ${done.completed_name ?? "—"}`}
                          {late && " • ⚠ atrasada"}
                        </small>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      {subTab === "checklist" && <PhysicalChecklist currentOperator={currentOperator} />}
      {subTab === "incons" && <InconsistencyList currentOperator={currentOperator} />}
      {subTab === "history" && <RoutineHistory />}

      {toast && <div className={`dr-toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}

function isLate(step) {
  const [dh, dm] = step.deadline_time.split(":").map(Number);
  const now = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const nowMin = now.getUTCHours() * 60 + now.getUTCMinutes();
  return nowMin > dh * 60 + dm + (step.alert_after_min ?? 15);
}