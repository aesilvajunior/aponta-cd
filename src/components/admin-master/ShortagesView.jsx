import React from "react";
import { useMemo } from "react";
import { fmtDate } from "../../lib/format";
import { IconPackage, IconEdit, IconTrash } from "../Icons";
import { SelectionHeader, SelectionCell } from "./shared";

export default function ShortagesView({ shortages, entries, onEdit, onDelete, selected, onToggle, onToggleAll }) {
  const entryById = useMemo(() => {
    const map = {};
    entries.forEach((e) => { map[e.id] = e; });
    return map;
  }, [entries]);

  if (shortages.length === 0) {
    return (
      <div className="card">
        <div className="schedule-empty">
          <div className="schedule-empty-icon"><IconPackage size={36} /></div>
          <div>Nenhuma falta encontrada com esses filtros.</div>
        </div>
      </div>
    );
  }
  return (
    <div className="card">
      <div className="card-title">Faltas de material ({shortages.length})</div>
      <div style={{ overflowX: "auto" }}>
        <table className="data-table">
          <thead>
            <tr>
              <SelectionHeader selected={selected} allItems={shortages} onToggleAll={onToggleAll} />
              <th>Data</th><th>Produto</th><th>Qtd.</th><th>Pedido</th><th>Cliente</th><th>Operador</th><th>Atividade</th>
              <th style={{ width: 110 }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {shortages.slice(0, 300).map((s) => {
              const e = entryById[s.entry_id];
              return (
                <tr key={s.id} style={{ background: selected.has(s.id) ? "var(--accent-soft)" : undefined }}>
                  <SelectionCell id={s.id} selected={selected} onToggle={onToggle} />
                  <td>{s.created_at ? fmtDate(s.created_at) : "—"}</td>
                  <td style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>{s.product_code}</td>
                  <td style={{ color: "var(--danger)", fontWeight: 600 }}>{s.quantity}</td>
                  <td style={{ fontFamily: "var(--font-mono)" }}>{e?.order_number || "—"}</td>
                  <td style={{ color: "var(--text-muted)" }}>{e?.customer_name || "—"}</td>
                  <td>{e?.operator_name || "—"}</td>
                  <td>{e?.activity || "—"}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button className="btn-small" style={{ padding: "5px 9px", marginRight: 4 }} onClick={() => onEdit(s)} title="Editar">
                      <IconEdit size={12} />
                    </button>
                    <button className="btn-small" style={{ padding: "5px 9px", color: "var(--danger)", borderColor: "var(--danger)" }} onClick={() => onDelete(s)} title="Excluir">
                      <IconTrash size={12} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
