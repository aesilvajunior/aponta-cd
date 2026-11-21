import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import { fmtClock, fmtDate, todayLocalISODate } from "../lib/format";
import { playSound } from "../lib/sounds";
import {
  IconCheck,
  IconRefresh,
  IconPlus,
  IconTrash,
  IconClipboardCheck,
  IconCloudSun,
  IconMoon,
  IconX,
} from "./Icons";

const CODE_LENGTH = 3;

export default function CdChecklist({ operators, isAdmin, currentOperator = null }) {
  const [items, setItems] = useState([]);
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [checklistType, setChecklistType] = useState(() => {
    const h = new Date().getHours();
    return h < 14 ? "abertura" : "fechamento";
  });

  const [codeInput, setCodeInput] = useState("");
  const [loggedOperator, setLoggedOperator] = useState(currentOperator || null);
  const [manualSwitch, setManualSwitch] = useState(false);
  const [loginError, setLoginError] = useState("");

  useEffect(() => {
    if (currentOperator && !manualSwitch) {
      setLoggedOperator(currentOperator);
    }
  }, [currentOperator, manualSwitch]);

  const [runId, setRunId] = useState(null);
  const [completed, setCompleted] = useState(new Set());
  const [note, setNote] = useState("");

  const [newItemLabel, setNewItemLabel] = useState("");
  const [editingItems, setEditingItems] = useState(false);

  const codeInputRef = useRef(codeInput);
  codeInputRef.current = codeInput;

  const today = todayLocalISODate();

  async function loadItems() {
    const { data, error: err } = await supabase
      .from("cd_checklists")
      .select("*")
      .eq("active", true)
      .order("item_order");
    if (err) { setError(err.message); return; }
    setItems(data || []);
  }

  async function loadRuns() {
    const { data, error: err } = await supabase
      .from("cd_checklist_runs")
      .select("*")
      .eq("checklist_date", today)
      .order("started_at", { ascending: false });
    if (err) { setError(err.message); return; }
    setRuns(data || []);
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([loadItems(), loadRuns()]);
      setLoading(false);
    })();
    const ch = supabase
      .channel("checklist-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "cd_checklists" }, loadItems)
      .on("postgres_changes", { event: "*", schema: "public", table: "cd_checklist_runs" }, loadRuns)
      .subscribe();
    return () => supabase.removeChannel(ch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentItems = useMemo(
    () => items.filter((i) => i.checklist_type === checklistType),
    [items, checklistType]
  );

  const currentRun = useMemo(
    () => runs.find((r) => r.checklist_type === checklistType && !r.finished_at),
    [runs, checklistType]
  );

  const finishedToday = useMemo(
    () => runs.filter((r) => r.checklist_type === checklistType && r.finished_at),
    [runs, checklistType]
  );

  useEffect(() => {
    if (currentRun) {
      setRunId(currentRun.id);
      setCompleted(new Set(currentRun.completed_items || []));
      setNote(currentRun.note || "");
    } else {
      setRunId(null);
      setCompleted(new Set());
      setNote("");
    }
  }, [currentRun]);

  // Ao trocar entre Abertura e Fechamento, preserva o operador se já estiver logado na sessão principal
  function switchType(nextType) {
    if (nextType === checklistType) return;
    setChecklistType(nextType);
    if (!currentOperator) {
      setLoggedOperator(null);
    }
    setCodeInput("");
    setLoginError("");
  }

  // Se o operador já entrou na tela inicial e não há run aberta para este tipo, inicia o rascunho automaticamente
  useEffect(() => {
    if (loading || !loggedOperator || currentRun) return;
    let cancelled = false;
    (async () => {
      const { data, error: err } = await supabase
        .from("cd_checklist_runs")
        .insert({
          checklist_date: today,
          checklist_type: checklistType,
          operator_code: loggedOperator.code,
          operator_name: loggedOperator.name,
          completed_items: [],
        })
        .select()
        .single();
      if (cancelled) return;
      if (err) {
        setError(err.message);
        return;
      }
      if (data) {
        setRunId(data.id);
        setRuns((prev) => [data, ...prev]);
      }
    })();
    return () => { cancelled = true; };
  }, [loading, loggedOperator, currentRun, today, checklistType]);

  const handleDigit = useCallback((d) => {
    setLoginError("");
    setCodeInput((prev) => (prev.length < CODE_LENGTH ? prev + d : prev));
  }, []);

  const handleBackspace = useCallback(() => {
    setLoginError("");
    setCodeInput((prev) => prev.slice(0, -1));
  }, []);

  const handleLogin = useCallback(async (overrideCode = null) => {
    const code = (overrideCode ?? codeInputRef.current).trim();
    if (code.length < CODE_LENGTH) return;
    const op = operators.find((o) => o.code === code);
    if (!op) {
      setLoginError("Código não encontrado.");
      setCodeInput("");
      return;
    }
    setLoggedOperator(op);
    setLoginError("");
    setCodeInput("");
    if (!currentRun) {
      const { data, error: err } = await supabase
        .from("cd_checklist_runs")
        .insert({
          checklist_date: today,
          checklist_type: checklistType,
          operator_code: op.code,
          operator_name: op.name,
          completed_items: [],
        })
        .select()
        .single();
      if (err) { setError(err.message); return; }
      setRunId(data.id);
      setRuns((prev) => [data, ...prev]);
    }
  }, [operators, currentRun, today, checklistType]);

  // Suporte completo ao teclado físico e teclado numérico (Numpad0..9, Enter, Backspace, Escape)
  useEffect(() => {
    if (loggedOperator) return undefined;

    function onKeyDown(e) {
      const tag = (e.target && e.target.tagName) || "";
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      // Aceita tanto a fileira superior quanto o teclado numérico (Numpad)
      let digit = null;
      if (e.key >= "0" && e.key <= "9") {
        digit = e.key;
      } else if (e.code && /^Numpad[0-9]$/.test(e.code)) {
        digit = e.code.slice(6);
      }

      if (digit !== null) {
        e.preventDefault();
        handleDigit(digit);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === "Enter" || e.code === "NumpadEnter") {
        e.preventDefault();
        handleLogin();
      } else if (e.key === "Escape") {
        e.preventDefault();
        setCodeInput("");
        setLoginError("");
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [loggedOperator, handleDigit, handleBackspace, handleLogin]);

  // Sair corretamente: fecha a tela ativa do checklist (sem ficar preso por causa de currentRun)
  async function logout() {
    if (busy) return;
    // Se nenhum item foi marcado ainda e o checklist foi recém-aberto, remove o rascunho vazio
    if (runId && completed.size === 0 && !note.trim()) {
      setBusy(true);
      await supabase.from("cd_checklist_runs").delete().eq("id", runId);
      setRuns((prev) => prev.filter((r) => r.id !== runId));
      setRunId(null);
      setBusy(false);
    }
    setManualSwitch(true);
    setLoggedOperator(null);
    setCodeInput("");
    setLoginError("");
  }

  async function toggleItem(itemKey) {
    if (!runId) return;
    const next = new Set(completed);
    if (next.has(itemKey)) next.delete(itemKey);
    else next.add(itemKey);
    setCompleted(next);
    const { error: err } = await supabase
      .from("cd_checklist_runs")
      .update({ completed_items: Array.from(next) })
      .eq("id", runId);
    if (err) setError(err.message);
  }

  async function finishChecklist() {
    if (!runId) return;
    if (completed.size < currentItems.length) {
      if (!window.confirm(`Faltam ${currentItems.length - completed.size} item(ns). Finalizar mesmo assim?`)) return;
    }
    setBusy(true);
    const { error: err } = await supabase
      .from("cd_checklist_runs")
      .update({
        finished_at: new Date().toISOString(),
        note: note.trim() || null,
      })
      .eq("id", runId);
    setBusy(false);
    if (err) return setError(err.message);
    playSound("success");
    if (!currentOperator) {
      setLoggedOperator(null);
    }
    setRunId(null);
    setCompleted(new Set());
    setNote("");
    await loadRuns();
  }

  async function addItem() {
    const label = newItemLabel.trim();
    if (!label) return;
    const key = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 40);
    const order = currentItems.length + 1;
    const { error: err } = await supabase
      .from("cd_checklists")
      .insert({ checklist_type: checklistType, item_key: key, item_label: label, item_order: order });
    if (err) return setError(err.message);
    setNewItemLabel("");
    await loadItems();
  }

  async function removeItem(id) {
    if (!window.confirm("Remover este item?")) return;
    await supabase.from("cd_checklists").delete().eq("id", id);
    await loadItems();
  }

  if (loading) {
    return (
      <div className="card">
        <div className="schedule-empty">Carregando...</div>
      </div>
    );
  }

  const dots = Array.from({ length: CODE_LENGTH }, (_, i) => i < codeInput.length);

  return (
    <div className="anim-fade-up">
      <div className="page-header-row" style={{ marginBottom: 22 }}>
        <div>
          <h1 className="page-title">Checklist do CD</h1>
          <p className="page-sub" style={{ marginBottom: 0 }}>
            Abertura e fechamento diário · {fmtDate(new Date())}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {isAdmin && (
            <button className="btn-small" onClick={() => setEditingItems((v) => !v)}>
              {editingItems ? <><IconX size={14} /> Fechar edição</> : "Editar itens"}
            </button>
          )}
          <button className="btn-small" onClick={() => { loadItems(); loadRuns(); }}>
            <IconRefresh size={14} /> Atualizar
          </button>
        </div>
      </div>

      {error && (
        <div className="alert-card alert-danger" style={{ marginBottom: 20 }}>
          {error}
        </div>
      )}

      <div className="quick-filters" style={{ marginBottom: 20 }}>
        <span className="quick-filters-label">Tipo:</span>
        <button
          className={`quick-filter-btn ${checklistType === "abertura" ? "active" : ""}`}
          onClick={() => switchType("abertura")}
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <IconCloudSun size={15} /> Abertura
        </button>
        <button
          className={`quick-filter-btn ${checklistType === "fechamento" ? "active" : ""}`}
          onClick={() => switchType("fechamento")}
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <IconMoon size={14} /> Fechamento
        </button>
      </div>

      {finishedToday.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <IconCheck size={16} /> Concluído hoje ({finishedToday.length})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {finishedToday.map((r) => (
              <div
                key={r.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 16px",
                  background: "var(--ok-soft)",
                  border: "1px solid var(--ok)",
                  borderRadius: 10,
                }}
              >
                <IconCheck size={16} style={{ color: "var(--ok)" }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700 }}>
                    {r.operator_name} finalizou
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 3 }}>
                    {fmtClock(r.started_at)} → {fmtClock(r.finished_at)} ·{" "}
                    {(r.completed_items || []).length} item(ns)
                    {r.note && ` · "${r.note}"`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loggedOperator && (
        <div className="schedule-login-wrap">
          <div className="schedule-login-card">
            <div className="schedule-login-title">
              {checklistType === "abertura" ? "Abrir checklist" : "Fechar checklist"}
            </div>
            <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 14, textAlign: "center" }}>
              {currentRun
                ? `Em andamento por ${currentRun.operator_name} (${(currentRun.completed_items || []).length} marcados) — digite seu código para continuar`
                : "Digite seu código (ou use o teclado numérico) para começar"}
            </div>
            <div className="schedule-login-dots">
              {dots.map((filled, i) => (
                <div key={i} className={`kiosk-dot ${filled ? "filled" : ""}`} />
              ))}
            </div>
            <div className="kiosk-keypad">
              {["1","2","3","4","5","6","7","8","9"].map((d) => (
                <button key={d} type="button" className="kiosk-key" onClick={() => handleDigit(d)}>{d}</button>
              ))}
              <button type="button" className="kiosk-key kiosk-key-muted" onClick={handleBackspace} aria-label="Apagar">←</button>
              <button type="button" className="kiosk-key" onClick={() => handleDigit("0")}>0</button>
              <button type="button" className="kiosk-key kiosk-key-primary" onClick={() => handleLogin()}>OK</button>
            </div>
            {loginError ? (
              <p className="kiosk-terminal-error">{loginError}</p>
            ) : (
              <p className="kiosk-terminal-hint">digite pelo teclado ou toque nos números · Enter confirma</p>
            )}
          </div>
        </div>
      )}

      {loggedOperator && (
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
            <div className="card-title" style={{ marginBottom: 0, display: "flex", alignItems: "center", gap: 8 }}>
              <IconClipboardCheck size={16} />
              {checklistType === "abertura" ? "Itens de abertura" : "Itens de fechamento"}
            </div>
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
              {completed.size} / {currentItems.length} concluídos
              {" · "}<strong>{loggedOperator.name}</strong>
              {currentRun && currentRun.operator_code !== loggedOperator.code && ` (iniciado por ${currentRun.operator_name})`}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {currentItems.map((it) => {
              const isDone = completed.has(it.item_key);
              return (
                <div
                  key={it.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 14px",
                    background: isDone ? "var(--ok-soft)" : "var(--surface-raised)",
                    border: `1px solid ${isDone ? "var(--ok)" : "var(--border)"}`,
                    borderRadius: 10,
                    cursor: "pointer",
                    transition: "all 180ms ease",
                  }}
                  onClick={() => toggleItem(it.item_key)}
                >
                  <div style={{
                    width: 24, height: 24, borderRadius: 6,
                    background: isDone ? "var(--ok)" : "transparent",
                    border: `2px solid ${isDone ? "var(--ok)" : "var(--border-strong)"}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    {isDone && <IconCheck size={14} style={{ color: "#fff" }} />}
                  </div>
                  <span style={{ fontSize: 14, fontWeight: isDone ? 600 : 500, flex: 1 }}>
                    {it.item_label}
                  </span>
                  {editingItems && isAdmin && (
                    <button
                      type="button"
                      className="btn-small"
                      style={{ padding: "5px 9px", color: "var(--danger)", borderColor: "var(--danger)" }}
                      onClick={(e) => { e.stopPropagation(); removeItem(it.id); }}
                    >
                      <IconTrash size={12} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {editingItems && isAdmin && (
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <input
                className="field"
                style={{ flex: 1 }}
                placeholder="Novo item do checklist"
                value={newItemLabel}
                onChange={(e) => setNewItemLabel(e.target.value)}
              />
              <button type="button" className="btn-small btn-excel" onClick={addItem}>
                <IconPlus size={14} /> Adicionar
              </button>
            </div>
          )}

          <div style={{ marginTop: 20 }}>
            <label className="schedule-modal-label">Observação (opcional)</label>
            <textarea
              className="field"
              rows={2}
              style={{ resize: "none", width: "100%" }}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ex: câmera 3 com problema"
            />
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={finishChecklist}
              disabled={busy || completed.size === 0}
              style={{ flex: 1 }}
            >
              {busy ? "Salvando..." : `Finalizar checklist (${completed.size}/${currentItems.length})`}
            </button>
            <button type="button" className="btn-small" onClick={logout} disabled={busy}>
              Sair
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
