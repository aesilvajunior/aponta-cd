import React from "react";
import { IconX } from "../Icons";

export function ModalShell({ title, onClose, children, modalRef, maxWidth = 720 }) {
  return (
    <div className="kiosk-modal-backdrop" onClick={onClose}>
      <div className="kiosk-modal" ref={modalRef} onClick={(e) => e.stopPropagation()} style={{ maxWidth }}>
        <div className="kiosk-modal-header">
          <div className="kiosk-modal-title">{title}</div>
          <button className="kiosk-modal-close" onClick={onClose}>
            <IconX size={18} />
          </button>
        </div>
        <div className="kiosk-modal-body" style={{ maxHeight: "70vh" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

export function ModalFooter({ onCancel, onConfirm, busy, confirmLabel = "Salvar" }) {
  return (
    <div style={{ display: "flex", gap: 10, padding: "18px 26px", borderTop: "1px solid var(--border)", background: "var(--surface-raised)" }}>
      <button className="kiosk-btn kiosk-btn-secondary" onClick={onCancel} disabled={busy}>Cancelar</button>
      <button className="kiosk-btn kiosk-btn-primary" onClick={onConfirm} disabled={busy}>
        {busy ? "Salvando..." : confirmLabel}
      </button>
    </div>
  );
}

export function SelectionHeader({ selected, allItems, onToggleAll }) {
  const allSelected = allItems.length > 0 && allItems.every((item) => selected.has(item.id));
  const someSelected = allItems.some((item) => selected.has(item.id));
  return (
    <th style={{ width: 40, textAlign: "center" }}>
      <input
        type="checkbox"
        checked={allSelected}
        ref={(el) => { if (el) el.indeterminate = !allSelected && someSelected; }}
        onChange={onToggleAll}
        style={{ cursor: "pointer" }}
      />
    </th>
  );
}

export function SelectionCell({ id, selected, onToggle }) {
  return (
    <td style={{ textAlign: "center" }}>
      <input type="checkbox" checked={selected.has(id)} onChange={() => onToggle(id)} style={{ cursor: "pointer" }} />
    </td>
  );
}
