import React, { useState } from "react";
import { addRotationTask, updateRotationTask } from "../lib/rotation";
import { WEEKDAY_LABELS } from "../lib/rotation";
import { IconX, IconCheck } from "./Icons";

const CATEGORIES = ["Carregamento", "Separação", "Limpeza", "Recebimento", "Conferência"];

export default function RotationTaskModal({ task = null, categoriesInUse = [], onClose, onSaved }) {
  const isEditing = !!task;

  const [name, setName] = useState(task?.name || "");
  const [category, setCategory] = useState(task?.category || categoriesInUse[0] || "Carregamento");
  const [kind, setKind] = useState(task?.kind || "rotativa");
  const [days, setDays] = useState(task?.days_of_week || [1, 2, 3, 4, 5]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function toggleDay(d) {
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));
  }

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) return setError("Digite o nome da tarefa.");
    if (days.length === 0) return setError("Escolha pelo menos um dia da semana.");

    setBusy(true);
    setError("");

    if (isEditing) {
      const { error: err } = await updateRotationTask(task.id, {
        name: trimmed,
        category,
        kind,
        days_of_week: days,
      });
      setBusy(false);
      if (err) return setError(err.message);
    } else {
      const { error: err } = await addRotationTask({
        name: trimmed,
        category,
        kind,
        daysOfWeek: days,
        sortOrder: 100,
      });
      setBusy(false);
      if (err) return setError(err.message);
    }
    onSaved?.();
    onClose();
  }

  return (
    <div className="kiosk-modal-backdrop" onClick={onClose}>
      <div className="kiosk-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <div className="kiosk-modal-header">
          <div>
            <div className="kiosk-modal-title">
              {isEditing ? "Editar tarefa" : "Nova tarefa de rotação"}
            </div>
            <div className="kiosk-modal-sub">
              {kind === "equipe_fixa"
                ? "Uma equipe fixa por recurso (ex: caminhão). Mesmos operadores em todos os dias."
                : "Os operadores rodam entre as tarefas ao longo da semana."}
            </div>
          </div>
          <button className="kiosk-modal-close" onClick={onClose} aria-label="Fechar">
            <IconX size={18} />
          </button>
        </div>

        <div className="kiosk-modal-body">
          <div style={{ marginBottom: 14 }}>
            <label className="schedule-modal-label">Nome da tarefa *</label>
            <input
              className="schedule-modal-field"
              placeholder='Ex: "BTZ-8E99 · Volkswagen" ou "Frente da loja"'
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={busy}
              autoFocus
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
            <div>
              <label className="schedule-modal-label">Categoria *</label>
              <select
                className="schedule-modal-field"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                disabled={busy}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="schedule-modal-label">Tipo *</label>
              <select
                className="schedule-modal-field"
                value={kind}
                onChange={(e) => setKind(e.target.value)}
                disabled={busy}
              >
                <option value="rotativa">Rotativa</option>
                <option value="equipe_fixa">Equipe fixa</option>
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label className="schedule-modal-label">Dias da semana</label>
            <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
              {WEEKDAY_LABELS.map((label, idx) => {
                const active = days.includes(idx);
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => toggleDay(idx)}
                    disabled={busy}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: `1px solid ${active ? "var(--accent)" : "var(--border-strong)"}`,
                      background: active ? "var(--accent-soft)" : "transparent",
                      color: active ? "var(--accent)" : "var(--text-muted)",
                      fontWeight: active ? 700 : 500,
                      cursor: "pointer",
                      fontFamily: "inherit",
                      fontSize: 12.5,
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {error && (
            <p style={{ color: "var(--danger)", fontSize: 12.5, marginTop: 10, marginBottom: 0 }}>
              {error}
            </p>
          )}
        </div>

        <div className="kiosk-modal-footer">
          <button className="kiosk-btn kiosk-btn-secondary" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button className="kiosk-btn kiosk-btn-primary" onClick={save} disabled={busy}>
            <IconCheck size={14} /> {busy ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}