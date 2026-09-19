import React, { useState } from "react";
import { addManualEntry } from "../lib/api";
import { shiftFor } from "../lib/format";

function todayLocalISODate() {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d - tz).toISOString().slice(0, 10);
}

export default function ManualEntry({ operators, activities, refreshEntries }) {
  const [operatorCode, setOperatorCode] = useState("");
  const [activity, setActivity] = useState("");
  const [date, setDate] = useState(todayLocalISODate());
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  function resetForm() {
    setOperatorCode("");
    setActivity("");
    setStartTime("");
    setEndTime("");
  }

  async function handleSubmit() {
    setError("");
    setSuccess("");
    const op = operators.find((o) => o.code === operatorCode);
    if (!op) return setError("Selecione o operador.");
    if (!activity) return setError("Selecione a atividade.");
    if (!date) return setError("Selecione a data.");
    if (!startTime || !endTime) return setError("Preencha horário de início e fim.");

    const startISO = new Date(`${date}T${startTime}:00`).toISOString();
    const endISO = new Date(`${date}T${endTime}:00`).toISOString();
    const durationSeconds = Math.round((new Date(endISO) - new Date(startISO)) / 1000);

    if (durationSeconds <= 0) {
      return setError("O horário de fim precisa ser depois do horário de início (mesmo dia).");
    }

    setSaving(true);
    const { error: insertError } = await addManualEntry({
      operatorCode: op.code,
      operatorName: op.name,
      activity,
      startTime: startISO,
      endTime: endISO,
      durationSeconds,
      shift: shiftFor(startISO),
    });
    setSaving(false);

    if (insertError) {
      setError("Erro ao salvar. Tente novamente.");
      return;
    }
    setSuccess(`Registro de ${op.name} — ${activity} lançado com sucesso.`);
    resetForm();
    refreshEntries?.();
  }

  return (
    <div>
      <h1 className="page-title">Lançar registro retroativo</h1>
      <p className="page-sub">
        Para digitar dados de dias ou meses anteriores (ex: papéis de agosto) direto no histórico, sem
        passar pelo quiosque. Esses registros ficam marcados como "lançado manualmente" no Painel, para
        manter claro o que veio de apontamento real e o que foi digitado depois.
      </p>

      {error && (
        <div className="confirm-box" style={{ marginBottom: 18, maxWidth: 460, padding: "10px 14px" }}>
          <span style={{ color: "var(--danger)", fontSize: 13 }}>{error}</span>
        </div>
      )}
      {success && (
        <div className="card" style={{ borderColor: "var(--ok)", marginBottom: 18, maxWidth: 460, padding: "10px 14px" }}>
          <span style={{ color: "var(--ok)", fontSize: 13 }}>{success}</span>
        </div>
      )}

      <div className="card" style={{ maxWidth: 460 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 5 }}>Operador</label>
            <select className="field" style={{ width: "100%" }} value={operatorCode} onChange={(e) => setOperatorCode(e.target.value)} disabled={saving}>
              <option value="">Selecione...</option>
              {operators.map((o) => (
                <option key={o.code} value={o.code}>{o.name} — #{o.code}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 5 }}>Atividade</label>
            <select className="field" style={{ width: "100%" }} value={activity} onChange={(e) => setActivity(e.target.value)} disabled={saving}>
              <option value="">Selecione...</option>
              {activities.map((a) => (
                <option key={a.name} value={a.name}>{a.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 5 }}>Data</label>
            <input type="date" className="field" style={{ width: "100%" }} value={date} onChange={(e) => setDate(e.target.value)} disabled={saving} />
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 5 }}>Início</label>
              <input type="time" className="field" style={{ width: "100%" }} value={startTime} onChange={(e) => setStartTime(e.target.value)} disabled={saving} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 5 }}>Fim</label>
              <input type="time" className="field" style={{ width: "100%" }} value={endTime} onChange={(e) => setEndTime(e.target.value)} disabled={saving} />
            </div>
          </div>

          <button className="btn btn-primary" onClick={handleSubmit} disabled={saving} style={{ marginTop: 6 }}>
            {saving ? "Salvando..." : "Lançar registro"}
          </button>
        </div>
      </div>
    </div>
  );
}
