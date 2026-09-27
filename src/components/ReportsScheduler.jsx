import React, { useEffect, useState } from "react";
import {
  fetchScheduledReports,
  addScheduledReport,
  updateScheduledReport,
  deleteScheduledReport,
  toggleScheduledReport,
  describeSchedule,
  REPORT_TYPES,
  FREQUENCIES,
  WEEKDAYS,
} from "../lib/reports";
import { supabase } from "../supabaseClient";
import {
  IconClock,
  IconPlus,
  IconTrash,
  IconRefresh,
  IconCheck,
  IconX,
  IconAlertCircle,
} from "./Icons";

export default function ReportsScheduler() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Form
  const [name, setName] = useState("");
  const [reportType, setReportType] = useState("apontamentos");
  const [frequency, setFrequency] = useState("semanal");
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [hour, setHour] = useState(8);
  const [emailTo, setEmailTo] = useState("");

  async function loadAll() {
    setLoading(true);
    const { data, error: err } = await fetchScheduledReports();
    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
    setReports(data || []);
    setError("");
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    const ch = supabase
      .channel("reports-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "scheduled_reports" }, loadAll)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, []);

  async function runAction(action, onSuccess) {
    setError("");
    setBusy(true);
    try {
      const { error: err } = await action();
      if (err) {
        setError(err.message);
        return;
      }
      await loadAll();
      onSuccess?.();
    } finally {
      setBusy(false);
    }
  }

  async function handleAdd() {
    const n = name.trim();
    const email = emailTo.trim();
    if (!n) return setError("Digite um nome.");
    if (!email || !email.includes("@")) return setError("Email inválido.");
    await runAction(
      () => addScheduledReport({ name: n, reportType, frequency, dayOfWeek, dayOfMonth, hour, emailTo: email }),
      () => {
        setName("");
        setEmailTo("");
      }
    );
  }

  async function handleToggle(r) {
    await runAction(() => toggleScheduledReport(r.id, !r.active));
  }

  async function handleDelete(r) {
    if (!window.confirm(`Remover agendamento "${r.name}"?`)) return;
    await runAction(() => deleteScheduledReport(r.id));
  }

  return (
    <div>
      <div className="page-header-row" style={{ marginBottom: 22 }}>
        <div>
          <h1 className="page-title">Export agendado</h1>
          <p className="page-sub" style={{ marginBottom: 0 }}>
            Configure envios automáticos de relatórios por email
          </p>
        </div>
        <button className="btn-small" onClick={loadAll}>
          <IconRefresh size={14} /> Atualizar
        </button>
      </div>

      <div className="alert-card alert-warning" style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <IconAlertCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <strong>Configuração adicional necessária:</strong> o envio por email depende de uma Edge Function do Supabase configurada com um serviço de email (Resend, SendGrid, etc). O agendamento fica salvo aqui e é processado automaticamente quando a função estiver ativa.
          </div>
        </div>
      </div>

      {error && (
        <div className="alert-card alert-danger" style={{ marginBottom: 20 }}>
          {error}
          <button className="btn-small" style={{ marginLeft: 12 }} onClick={() => setError("")}>Fechar</button>
        </div>
      )}

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <IconPlus size={16} /> Novo agendamento
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
          <input className="field" style={{ flex: 1, minWidth: 180 }} placeholder="Nome (ex: Relatório semanal gerência)" value={name} onChange={(e) => setName(e.target.value)} disabled={busy} />
          <select className="field" style={{ width: 220 }} value={reportType} onChange={(e) => setReportType(e.target.value)} disabled={busy}>
            {REPORT_TYPES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
          <select className="field" style={{ width: 140 }} value={frequency} onChange={(e) => setFrequency(e.target.value)} disabled={busy}>
            {FREQUENCIES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
          {frequency === "semanal" && (
            <select className="field" style={{ width: 140 }} value={dayOfWeek} onChange={(e) => setDayOfWeek(Number(e.target.value))} disabled={busy}>
              {WEEKDAYS.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
            </select>
          )}
          {frequency === "mensal" && (
            <input className="field" type="number" min="1" max="31" style={{ width: 100, fontFamily: "var(--font-mono)", textAlign: "center" }} placeholder="Dia" value={dayOfMonth} onChange={(e) => setDayOfMonth(Number(e.target.value))} disabled={busy} />
          )}
          <input className="field" type="number" min="0" max="23" style={{ width: 100, fontFamily: "var(--font-mono)", textAlign: "center" }} placeholder="Hora" value={hour} onChange={(e) => setHour(Number(e.target.value))} disabled={busy} />
          <input className="field" style={{ flex: 1, minWidth: 220 }} placeholder="Email destino" type="email" value={emailTo} onChange={(e) => setEmailTo(e.target.value)} disabled={busy} />
          <button className="btn-small btn-excel" onClick={handleAdd} disabled={busy}>
            <IconPlus size={14} /> Adicionar
          </button>
        </div>
      </div>

      {loading ? (
        <div className="schedule-empty">
          <div className="loading-spinner" style={{ margin: "0 auto 14px auto" }} />
          <div>Carregando...</div>
        </div>
      ) : reports.length === 0 ? (
        <div className="card">
          <div className="schedule-empty">
            <div className="schedule-empty-icon"><IconClock size={36} /></div>
            <div>Nenhum agendamento configurado.</div>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="card-title">Agendamentos ({reports.length})</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {reports.map((r) => (
              <div
                key={r.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "14px 16px",
                  background: "var(--surface-raised)",
                  border: "1px solid var(--border)",
                  borderLeft: `4px solid ${r.active ? "var(--ok)" : "var(--text-faint)"}`,
                  borderRadius: 12,
                  opacity: r.active ? 1 : 0.6,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{r.name}</div>
                  <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 4 }}>
                    {REPORT_TYPES.find((x) => x.value === r.report_type)?.label || r.report_type} · {describeSchedule(r)}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--accent)", marginTop: 4 }}>
                    → {r.email_to}
                  </div>
                  {r.last_sent_at && (
                    <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 4 }}>
                      Último envio: {new Date(r.last_sent_at).toLocaleString("pt-BR")}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <button
                    className="btn-small"
                    style={{
                      padding: "8px 12px",
                      background: r.active ? "var(--ok-soft)" : "transparent",
                      borderColor: r.active ? "var(--ok)" : "var(--border-strong)",
                      color: r.active ? "var(--ok)" : "var(--text-muted)",
                    }}
                    onClick={() => handleToggle(r)}
                    disabled={busy}
                    title={r.active ? "Desativar" : "Ativar"}
                  >
                    {r.active ? <IconCheck size={13} /> : <IconX size={13} />}
                  </button>
                  <button className="btn-small" style={{ padding: "8px 12px", color: "var(--danger)", borderColor: "var(--danger)" }} onClick={() => handleDelete(r)} disabled={busy} title="Remover">
                    <IconTrash size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}