import React from "react";
import { fmtDuration } from "../../lib/format";
import { IconClock, IconEdit, IconTrash, IconCheck } from "../Icons";
import { fmtDateTime } from "./helpers";

export default function SessionsView({ sessions, onEdit, onForceFinish, onCancel }) {
  if (sessions.length === 0) {
    return (
      <div className="card">
        <div className="schedule-empty">
          <div className="schedule-empty-icon"><IconClock size={36} /></div>
          <div>Nenhuma sessão em andamento agora.</div>
        </div>
      </div>
    );
  }
  return (
    <div className="card">
      <div className="card-title">Sessões em andamento ({sessions.length})</div>
      <p style={{ fontSize: 12, color: "var(--text-faint)", marginTop: -6, marginBottom: 14 }}>
        Editar dados da sessão · Forçar finalização (salva no histórico) · Cancelar (não salva)
      </p>
      <div style={{ overflowX: "auto" }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Operador</th><th>Atividade</th><th>Início</th><th>Tempo</th><th>Pedido/Transf.</th><th>Cliente</th>
              <th style={{ width: 200 }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => {
              const elapsed = Math.round((Date.now() - new Date(s.start_time).getTime()) / 1000);
              return (
                <tr key={s.operator_code}>
                  <td style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}>{s.operator_name}</td>
                  <td>{s.activity}</td>
                  <td>{fmtDateTime(s.start_time)}</td>
                  <td style={{ fontFamily: "var(--font-mono)", color: "var(--accent)", fontWeight: 600 }}>
                    {fmtDuration(elapsed)}
                  </td>
                  <td style={{ fontFamily: "var(--font-mono)" }}>
                    {s.transfer_type ? `${s.transfer_type} #${s.transfer_number || ""}` : s.order_number ? `#${s.order_number}` : "—"}
                  </td>
                  <td style={{ color: "var(--text-muted)" }}>{s.customer_name || "—"}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button className="btn-small" style={{ padding: "5px 9px", marginRight: 4 }} onClick={() => onEdit(s)} title="Editar sessão">
                      <IconEdit size={12} />
                    </button>
                    <button
                      className="btn-small"
                      style={{ padding: "5px 9px", marginRight: 4, background: "var(--ok-soft)", borderColor: "var(--ok)", color: "var(--ok)" }}
                      onClick={() => onForceFinish(s)}
                      title="Forçar finalização (salva no histórico)"
                    >
                      <IconCheck size={12} />
                    </button>
                    <button
                      className="btn-small"
                      style={{ padding: "5px 9px", color: "var(--danger)", borderColor: "var(--danger)" }}
                      onClick={() => onCancel(s)}
                      title="Cancelar (não salva)"
                    >
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
