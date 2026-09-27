import React, { useState } from "react";
import {
  addMapItem,
  updateMapItem,
  SIDES,
  DEFAULT_CATEGORIES,
} from "../lib/stockMap";
import { IconX, IconCheck } from "./Icons";

export default function StockMapItemPicker({ area, item, onClose, onSaved }) {
  const isEditing = !!item;

  const [form, setForm] = useState({
    side: item?.side || (area.has_sides ? "par" : null),
    productCode: item?.product_code || "",
    productName: item?.product_name || "",
    category: item?.category || "",
    quantity: item?.quantity ?? "",
    slot: item?.slot || "",
    note: item?.note || "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    const code = form.productCode.trim();
    if (!code) return setError("Digite o código do produto.");

    setBusy(true);
    setError("");

    const payload = {
      side: form.side || null,
      product_code: code,
      product_name: form.productName.trim() || null,
      category: form.category.trim() || null,
      quantity: Number(form.quantity) || 0,
      slot: form.slot.trim() || null,
      note: form.note.trim() || null,
    };

    if (isEditing) {
      const before = {
        productCode: item.product_code,
        productName: item.product_name,
        category: item.category,
        quantity: item.quantity,
        slot: item.slot,
        side: item.side,
        note: item.note,
      };

      const { error: err } = await updateMapItem(item.id, payload);
      setBusy(false);
      if (err) return setError(err.message);

      onSaved?.({
        action: "item_edit",
        item: payload,
        before,
      });
    } else {
      const { error: err } = await addMapItem({
        areaId: area.id,
        side: form.side || null,
        productCode: code,
        productName: form.productName,
        category: form.category,
        quantity: form.quantity,
        slot: form.slot,
        note: form.note,
      });
      setBusy(false);
      if (err) return setError(err.message);

      onSaved?.({
        action: "item_add",
        item: payload,
      });
    }

    onClose();
  }

  return (
    <div className="kiosk-modal-backdrop" onClick={onClose}>
      <div className="kiosk-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 580 }}>
        <div className="kiosk-modal-header">
          <div>
            <div className="kiosk-modal-title">
              {isEditing ? "Editar item" : "Novo item"}
            </div>
            <div className="kiosk-modal-sub">
              {area.code} · {area.label}
            </div>
          </div>
          <button className="kiosk-modal-close" onClick={onClose} aria-label="Fechar">
            <IconX size={18} />
          </button>
        </div>

        <div className="kiosk-modal-body">
          {area.has_sides && (
            <div>
              <label className="schedule-modal-label">Lado *</label>
              <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                {SIDES.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => set("side", s.value)}
                    style={{
                      flex: 1,
                      padding: "12px 14px",
                      background: form.side === s.value ? "var(--accent-soft)" : "var(--surface-raised)",
                      border: `1px solid ${form.side === s.value ? "var(--accent)" : "var(--border-strong)"}`,
                      borderRadius: 10,
                      color: form.side === s.value ? "var(--accent)" : "var(--text)",
                      fontWeight: form.side === s.value ? 700 : 500,
                      cursor: "pointer",
                      fontFamily: "inherit",
                      fontSize: 13,
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div style={{ marginTop: 14 }}>
            <label className="schedule-modal-label">Código do produto *</label>
            <input
              className="schedule-modal-field"
              style={{ fontFamily: "var(--font-mono)" }}
              placeholder="Ex: TRO-1234"
              value={form.productCode}
              onChange={(e) => set("productCode", e.target.value)}
              autoFocus
            />
          </div>

          <div style={{ marginTop: 14 }}>
            <label className="schedule-modal-label">Nome do produto</label>
            <input
              className="schedule-modal-field"
              placeholder="Opcional"
              value={form.productName}
              onChange={(e) => set("productName", e.target.value)}
            />
          </div>

          <div style={{ marginTop: 14 }}>
            <label className="schedule-modal-label">Categoria</label>
            <input
              className="schedule-modal-field"
              placeholder="Ex: Conexões"
              value={form.category}
              onChange={(e) => set("category", e.target.value)}
              list="stock-categories"
            />
            <datalist id="stock-categories">
              {DEFAULT_CATEGORIES.map((c) => <option key={c} value={c} />)}
            </datalist>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}>
            <div>
              <label className="schedule-modal-label">Quantidade</label>
              <input
                type="number"
                min="0"
                className="schedule-modal-field"
                value={form.quantity}
                onChange={(e) => set("quantity", e.target.value)}
              />
            </div>
            <div>
              <label className="schedule-modal-label">Slot</label>
              <input
                className="schedule-modal-field"
                placeholder="Ex: N3"
                value={form.slot}
                onChange={(e) => set("slot", e.target.value)}
              />
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <label className="schedule-modal-label">Observação</label>
            <textarea
              className="schedule-modal-field"
              rows={2}
              style={{ resize: "none" }}
              value={form.note}
              onChange={(e) => set("note", e.target.value)}
            />
          </div>

          {error && (
            <p style={{ color: "var(--danger)", fontSize: 12.5, marginTop: 12, marginBottom: 0 }}>
              {error}
            </p>
          )}
        </div>

        <div className="kiosk-modal-footer">
          <button className="kiosk-btn kiosk-btn-secondary" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button className="kiosk-btn kiosk-btn-primary" onClick={handleSave} disabled={busy}>
            <IconCheck size={14} /> {busy ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}