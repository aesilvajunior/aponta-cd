import React, { useMemo, useState } from "react";
import { setCellAssignments } from "../lib/rotation";
import { IconX, IconCheck, IconTrash } from "./Icons";

export default function RotationCellEditor({
  task,
  dateISO,
  initialOperators = [],
  availableOperators = [],
  onClose,
  onSaved,
}) {
  const [selected, setSelected] = useState(
    initialOperators.map((op) => ({ code: op.operator_code, name: op.operator_name }))
  );
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return availableOperators;
    return availableOperators.filter(
      (op) => op.name.toLowerCase().includes(q) || String(op.code).includes(q)
    );
  }, [availableOperators, search]);

  function toggle(op) {
    if (selected.some((s) => s.code === op.code)) {
      setSelected(selected.filter((s) => s.code !== op.code));
    } else {
      setSelected([...selected, { code: op.code, name: op.name }]);
    }
  }

  async function save() {
    setBusy(true);
    setError("");
    const { error: err } = await setCellAssignments({
      taskId: task.id,
      scheduledDate: dateISO,
      operators: selected.map((s) => ({ code: s.code, name: s.name })),
    });
    setBusy(false);
    if (err) return setError(err.message);
    onSaved?.();
    onClose();
  }

  async function clearAll() {
    if (!window.confirm("Remover todos os operadores desse dia?")) return;
    setBusy(true);
    const { error: err } = await setCellAssignments({
      taskId: task.id,
      scheduledDate: dateISO,
      operators: [],
    });
    setBusy(false);
    if (err) return setError(err.message);
    onSaved?.();
    onClose();
  }

  const dt = new Date(dateISO + "T12:00:00");
  const dateLabel = dt.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" });

  return (
    <div className="kiosk-modal-backdrop" onClick={onClose}>
      <div className="kiosk-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <div className="kiosk-modal-header">
          <div>
            <div className="kiosk-modal-title">{task.name}</div>
            <div className="kiosk-modal-sub" style={{ textTransform: "capitalize" }}>
              {dateLabel} · {task.category}
            </div>
          </div>
          <button className="kiosk-modal-close" onClick={onClose} aria-label="Fechar">
            <IconX size={18} />
          </button>
        </div>

        <div className="kiosk-modal-body" style={{ maxHeight: "60vh" }}>
          <div style={{ marginBottom: 14 }}>
            <label className="schedule-modal-label">
              Operadores atribuídos ({selected.length})
            </label>
            {selected.length === 0 ? (
              <p style={{ fontSize: 12.5, color: "var(--text-faint)", marginTop: 6 }}>
                Ninguém atribuído neste dia.
              </p>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                {selected.map((s) => (
                  <span
                    key={s.code}
                    style={{
                      background: "var(--accent-soft)",
                      color: "var(--accent)",
                      padding: "5px 10px",
                      borderRadius: 6,
                      fontSize: 12.5,
                      fontWeight: 700,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    {s.name}
                    <button
                      onClick={() => setSelected(selected.filter((x) => x.code !== s.code))}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "inherit",
                        cursor: "pointer",
                        padding: 0,
                        display: "flex",
                      }}
                    >
                      <IconX size={11} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div style={{ marginBottom: 10 }}>
            <label className="schedule-modal-label">
              Adicionar operador
              {task.category && (
                <span style={{ fontWeight: 400, fontSize: 11, color: "var(--text-faint)" }}>
                  {" "}· só aparecem operadores com papel compatível
                </span>
              )}
            </label>
            <input
              className="schedule-modal-field"
              placeholder="Buscar por nome ou código..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ marginTop: 6 }}
            />
          </div>

          <div
            style={{
              maxHeight: 220,
              overflowY: "auto",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: 6,
            }}
          >
            {filtered.length === 0 ? (
              <p style={{ fontSize: 12.5, color: "var(--text-faint)", padding: 12, textAlign: "center" }}>
                Nenhum operador compatível encontrado.
              </p>
            ) : (
              filtered.map((op) => {
                const isSelected = selected.some((s) => s.code === op.code);
                return (
                  <div
                    key={op.code}
                    onClick={() => toggle(op)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "8px 10px",
                      borderRadius: 6,
                      cursor: "pointer",
                      background: isSelected ? "var(--accent-soft)" : "transparent",
                    }}
                  >
                    <div
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 5,
                        border: `2px solid ${isSelected ? "var(--accent)" : "var(--border-strong)"}`,
                        background: isSelected ? "var(--accent)" : "transparent",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      {isSelected && <IconCheck size={12} style={{ color: "#fff" }} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600 }}>{op.name}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        #{op.code}
                        {op.roles && op.roles.length > 0 && ` · ${op.roles.join(", ")}`}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {error && (
            <p style={{ color: "var(--danger)", fontSize: 12.5, marginTop: 12, marginBottom: 0 }}>
              {error}
            </p>
          )}
        </div>

        <div className="kiosk-modal-footer">
          <button
            className="kiosk-btn kiosk-btn-secondary"
            onClick={clearAll}
            disabled={busy || selected.length === 0}
            style={{ color: "var(--danger)", borderColor: "var(--danger)" }}
          >
            <IconTrash size={14} /> Limpar
          </button>
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