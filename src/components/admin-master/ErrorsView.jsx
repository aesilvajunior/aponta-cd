import React from "react";
import { fmtDate } from "../../lib/format";
import { IconAlertTriangle, IconEdit, IconTrash } from "../Icons";
import { SelectionHeader, SelectionCell } from "./shared";

export default function ErrorsView({ errors, operators, onEdit, onDelete, selected, onToggle, onToggleAll }) {
  if (errors.length === 0) {
    return (
      <div className="card">
        <div className="schedule-empty">
          <div className="schedule-empty-icon"><IconAlertTriangle size={36} /></div>
          <div>Nenhum erro encontrado com esses filtros.</div>
        </div>
      </div>
    );
  }
  return (
    <div className="card">
      <div className="card-title">Erros de separação ({errors.length})</div>
      <div style={{ overflowX: "auto" }}>
        <table className="data-table">
          <thead>
            <tr>
              <SelectionHeader selected={selected} allItems={errors} onToggleAll={onToggleAll} />
              <th>Data</th><th>Pedido/Transf.</th><th>Tipo de erro</th><th>Quem errou</th><th>Quem apontou</th><th>Observação</th>
              <th style={{ width: 110 }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {errors.slice(0, 300).map((e) => {
              const opErr = operators.find((x) => x.code === e.error_operator_code);
              const opApo = operators.find((x) => x.code === e.operator_code);
              return (
                <tr key={e.id} style={{ background: selected.has(e.id) ? "var(--accent-soft)" : undefined }}>
                  <SelectionCell id={e.id} selected={selected} onToggle={onToggle} />
                  <td>{fmtDate(e.created_at)}</td>
                  <td style={{ fontFamily: "var(--font-mono)" }}>{e.order_number || "—"}</td>
                  <td>{e.error_type}</td>
                  <td style={{ color: "var(--danger)", fontWeight: 600 }}>{opErr?.name || e.error_operator_name || "—"}</td>
                  <td style={{ color: "var(--text-muted)" }}>{opApo?.name || e.operator_name}</td>
                  <td style={{ color: "var(--text-muted)" }}>{e.note || "—"}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button className="btn-small" style={{ padding: "5px 9px", marginRight: 4 }} onClick={() => onEdit(e)} title="Editar">
                      <IconEdit size={12} />
                    </button>
                    <button className="btn-small" style={{ padding: "5px 9px", color: "var(--danger)", borderColor: "var(--danger)" }} onClick={() => onDelete(e)} title="Excluir">
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
