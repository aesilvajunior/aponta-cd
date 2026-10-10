import React, { useEffect, useRef, useState } from "react";
import { IconAlertTriangle, IconX } from "../Icons";
import { fmtDate } from "../../lib/format";

// Modal de confirmação digitada
export default function DeleteEntryModal({ entry, onClose, onConfirmed }) {
  const [phrase, setPhrase] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 60);
  }, []);

  async function confirm() {
    if (phrase.trim().toUpperCase() !== "APAGAR") return;
    setBusy(true);
    await onConfirmed();
    setBusy(false);
  }

  return (
    <div className="kiosk-modal-backdrop" onClick={onClose}>
      <div className="kiosk-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div className="kiosk-modal-header">
          <div>
            <div className="kiosk-modal-title" style={{ color: "var(--danger)", display: "flex", alignItems: "center", gap: 8 }}>
              <IconAlertTriangle size={18} /> Apagar lançamento
            </div>
            <div className="kiosk-modal-sub">
              {entry.operator_name} — {entry.activity} · {fmtDate(entry.start_time)}
            </div>
          </div>
          <button className="kiosk-modal-close" onClick={onClose} aria-label="Fechar">
            <IconX size={18} />
          </button>
        </div>

        <div className="kiosk-modal-body">
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 0 }}>
            Isso apaga o registro <strong>permanentemente</strong>. A ação fica registrada na auditoria.
          </p>
          <div>
            <label className="schedule-modal-label">
              Digite <strong>APAGAR</strong> para confirmar
            </label>
            <input
              ref={inputRef}
              className="schedule-modal-field"
              style={{ fontFamily: "var(--font-mono)", textAlign: "center", letterSpacing: 3, fontSize: 18, fontWeight: 700 }}
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && confirm()}
              placeholder="APAGAR"
              disabled={busy}
              maxLength={10}
            />
          </div>
        </div>

        <div className="kiosk-modal-footer">
          <button className="kiosk-btn kiosk-btn-secondary" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button
            className="kiosk-btn"
            style={{ background: "var(--danger)", color: "#fff", flex: 1 }}
            onClick={confirm}
            disabled={busy || phrase.trim().toUpperCase() !== "APAGAR"}
          >
            {busy ? "Apagando..." : "Apagar lançamento"}
          </button>
        </div>
      </div>
    </div>
  );
}
