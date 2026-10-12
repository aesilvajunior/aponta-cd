import React from "react";
import { fmtClock, fmtDate, fmtDuration } from "../../lib/format";
import { IconActivity, IconEdit, IconTrash } from "../Icons";
import { SelectionHeader, SelectionCell } from "./shared";

export default function EntriesView({ entries, shortagesByEntry, operators, onEdit, onDelete, selected, onToggle, onToggleAll }) {
  if (entries.length === 0) {
    return (
      <div className="card">
        <div className="schedule-empty">
          <div className="schedule-empty-icon"><IconActivity size={36} /></div>
          <div>Nenhum lançamento encontrado com esses filtros.</div>
        </div>
      </div>
    );
  }
  return (
    <div className="card">
      <div className="card-title">Lançamentos ({entries.length})</div>
      <div style={{ overflowX: "auto" }}>
        <table className="data-table">
          <thead>
            <tr>
              <SelectionHeader selected={selected} allItems={entries} onToggleAll={onToggleAll} />
              <th>Data</th><th>Hora</th><th>Operador</th><th>Atividade</th><th>Tipo</th>
              <th>Pedido/Transf.</th><th>Cliente</th><th>Duração</th><th>Faltas</th>
              <th style={{ width: 110 }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {entries.slice(0, 300).map((e) => {
              const faltas = shortagesByEntry[e.id] || [];
              const op = operators.find((x) => x.code === e.operator_code);
              const tipo = e.is_encaixe ? "Encaixe" : e.transfer_type ? `Transferência ${e.transfer_type}` : e.order_number ? "Pedido" : "—";
              const ordem = e.transfer_number || e.order_number || "—";
              return (
                <tr key={e.id} style={{ background: selected.has(e.id) ? "var(--accent-soft)" : undefined }}>
                  <SelectionCell id={e.id} selected={selected} onToggle={onToggle} />
                  <td>{fmtDate(e.start_time)}</td>
                  <td style={{ fontFamily: "var(--font-mono)" }}>{fmtClock(e.start_time).slice(0, 5)}</td>
                  <td style={{ fontFamily: "var(--font-display)" }}>{op?.name || e.operator_name}</td>
                  <td>{e.activity}</td>
                  <td>{tipo}</td>
                  <td style={{ fontFamily: "var(--font-mono)" }}>{ordem}</td>
                  <td style={{ color: "var(--text-muted)" }}>{e.customer_name || "—"}</td>
                  <td>{fmtDuration(e.duration_seconds)}</td>
                  <td style={{ color: faltas.length > 0 ? "var(--danger)" : "var(--text-muted)", fontWeight: faltas.length > 0 ? 600 : 400 }}>
                    {faltas.length > 0 ? faltas.length : "—"}
                  </td>
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
