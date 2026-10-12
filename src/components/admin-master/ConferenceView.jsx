import React from "react";
import { fmtDuration } from "../../lib/format";
import { IconAlertTriangle, IconEdit, IconTrash, IconRotateCcw, IconCheck } from "../Icons";
import { fmtDateTime } from "./helpers";
import { SelectionHeader, SelectionCell } from "./shared";

export default function ConferenceView({ queue, history, onEdit, onDelete, onReset, selected, onToggle, onToggleAll }) {
  const all = [...queue, ...history];
  return (
    <>
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">Aguardando / Em conferência ({queue.length})</div>
        {queue.length === 0 ? (
          <div className="schedule-empty" style={{ padding: "20px 0" }}>
            <div style={{ fontSize: 13 }}>Mesa vazia.</div>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <SelectionHeader selected={selected} allItems={all} onToggleAll={onToggleAll} />
                  <th>Status</th><th>Pedido/Transf.</th><th>Cliente</th><th>Separado por</th><th>Separado em</th><th>Conferindo</th>
                  <th style={{ width: 170 }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {queue.map((c) => (
                  <tr key={c.id} style={{ background: selected.has(c.id) ? "var(--accent-soft)" : undefined }}>
                    <SelectionCell id={c.id} selected={selected} onToggle={onToggle} />
                    <td>
                      {c.status === "aguardando" ? (
                        <span style={{ color: "var(--warning)", fontWeight: 600 }}>Aguardando</span>
                      ) : (
                        <span style={{ color: "var(--accent)", fontWeight: 600 }}>Em conferência</span>
                      )}
                    </td>
                    <td style={{ fontFamily: "var(--font-mono)" }}>
                      {c.transfer_type ? `${c.transfer_type} #${c.transfer_number || ""}` : c.order_number ? `#${c.order_number}` : "—"}
                    </td>
                    <td style={{ color: "var(--text-muted)" }}>{c.customer_name || "—"}</td>
                    <td>{c.separated_by_name || "—"}</td>
                    <td>{fmtDateTime(c.separated_at)}</td>
                    <td>{c.conference_started_by_name || "—"}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <button className="btn-small" style={{ padding: "5px 9px", marginRight: 4 }} onClick={() => onEdit(c)} title="Editar">
                        <IconEdit size={12} />
                      </button>
                      {c.status === "em_conferencia" && (
                        <button className="btn-small" style={{ padding: "5px 9px", marginRight: 4 }} onClick={() => onReset(c)} title="Volta para Aguardando">
                          <IconRotateCcw size={12} />
                        </button>
                      )}
                      <button className="btn-small" style={{ padding: "5px 9px", color: "var(--danger)", borderColor: "var(--danger)" }} onClick={() => onDelete(c)} title="Excluir">
                        <IconTrash size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-title">Histórico de conferências ({history.length})</div>
        {history.length === 0 ? (
          <div className="schedule-empty" style={{ padding: "20px 0" }}>
            <div style={{ fontSize: 13 }}>Nenhuma conferência registrada.</div>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <SelectionHeader selected={selected} allItems={all} onToggleAll={onToggleAll} />
                  <th>Status</th><th>Pedido/Transf.</th><th>Cliente</th><th>Separado por</th><th>Conferido por</th><th>Finalizado em</th><th>Duração</th>
                  <th style={{ width: 110 }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {history.slice(0, 200).map((c) => (
                  <tr key={c.id} style={{ background: selected.has(c.id) ? "var(--accent-soft)" : undefined }}>
                    <SelectionCell id={c.id} selected={selected} onToggle={onToggle} />
                    <td>
                      {c.status === "conferido" ? (
                        <span style={{ color: "var(--ok)", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <IconCheck size={12} /> OK
                        </span>
                      ) : (
                        <span style={{ color: "var(--danger)", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <IconAlertTriangle size={12} /> {c.problem_reason || "Problema"}
                        </span>
                      )}
                    </td>
                    <td style={{ fontFamily: "var(--font-mono)" }}>
                      {c.transfer_type ? `${c.transfer_type} #${c.transfer_number || ""}` : c.order_number ? `#${c.order_number}` : "—"}
                    </td>
                    <td style={{ color: "var(--text-muted)" }}>{c.customer_name || "—"}</td>
                    <td>{c.separated_by_name || "—"}</td>
                    <td>{c.conference_finished_by_name || "—"}</td>
                    <td>{c.conference_finished_at ? fmtDateTime(c.conference_finished_at) : "—"}</td>
                    <td>{c.duration_seconds ? fmtDuration(c.duration_seconds) : "—"}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <button className="btn-small" style={{ padding: "5px 9px", marginRight: 4 }} onClick={() => onEdit(c)} title="Editar">
                        <IconEdit size={12} />
                      </button>
                      <button className="btn-small" style={{ padding: "5px 9px", color: "var(--danger)", borderColor: "var(--danger)" }} onClick={() => onDelete(c)} title="Excluir">
                        <IconTrash size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
