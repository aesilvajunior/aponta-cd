import React, { useState } from "react";
import { addManualEntry } from "../lib/api";
import { shiftFor } from "../lib/format";
import {
  IconZap,
  IconAlertTriangle,
  IconPlus,
  IconTrash,
  IconCheck,
} from "./Icons";

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
  const [isEncaixe, setIsEncaixe] = useState(false);
  const [hadShortage, setHadShortage] = useState(false);
  const [shortages, setShortages] = useState([{ productCode: "", quantity: 1 }]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  function resetForm() {
    setOperatorCode("");
    setActivity("");
    setStartTime("");
    setEndTime("");
    setIsEncaixe(false);
    setHadShortage(false);
    setShortages([{ productCode: "", quantity: 1 }]);
  }

  function addShortageRow() {
    setShortages((prev) => [...prev, { productCode: "", quantity: 1 }]);
  }

  function updateShortageRow(i, field, value) {
    setShortages((prev) => {
      const copy = [...prev];
      copy[i] = { ...copy[i], [field]: value };
      return copy;
    });
  }

  function removeShortageRow(i) {
    setShortages((prev) => prev.filter((_, idx) => idx !== i));
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

    let validShortages = [];
    if (hadShortage) {
      validShortages = shortages
        .filter((s) => s.productCode.trim().length > 0)
        .map((s) => ({ productCode: s.productCode.trim(), quantity: Number(s.quantity) || 1 }));
      if (validShortages.length === 0) {
        return setError("Adicione pelo menos uma falta com código do produto.");
      }
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
      isEncaixe,
      shortages: validShortages,
    });
    setSaving(false);

    if (insertError) {
      setError("Erro ao salvar. " + (insertError.message || "Tente novamente."));
      return;
    }
    setSuccess(`Registro de ${op.name} — ${activity} lançado com sucesso.`);
    resetForm();
    refreshEntries?.();
  }

  return (
    <div>
      <h1 className="page-title">Lançamento manual</h1>
      <p className="page-sub">
        Para digitar dados de dias ou meses anteriores direto no histórico, sem passar pelo quiosque.
        Os registros ficam marcados como "lançado manualmente" nos Indicadores.
      </p>

      {error && (
        <div className="alert-card alert-danger" style={{ maxWidth: 640 }}>
          {error}
        </div>
      )}
      {success && (
        <div
          className="alert-card"
          style={{
            borderColor: "var(--ok)",
            background: "var(--ok-soft)",
            color: "var(--ok)",
            maxWidth: 640,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <IconCheck size={16} />
          {success}
        </div>
      )}

      <div className="card" style={{ maxWidth: 640 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label className="schedule-modal-label">Operador</label>
            <select className="field" value={operatorCode} onChange={(e) => setOperatorCode(e.target.value)} disabled={saving}>
              <option value="">Selecione...</option>
              {operators.map((o) => (
                <option key={o.code} value={o.code}>{o.name} — #{o.code}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="schedule-modal-label">Atividade</label>
            <select className="field" value={activity} onChange={(e) => setActivity(e.target.value)} disabled={saving}>
              <option value="">Selecione...</option>
              {activities.map((a) => (
                <option key={a.name} value={a.name}>{a.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="schedule-modal-label">Data</label>
            <input type="date" className="field" value={date} onChange={(e) => setDate(e.target.value)} disabled={saving} />
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label className="schedule-modal-label">Início</label>
              <input type="time" className="field" value={startTime} onChange={(e) => setStartTime(e.target.value)} disabled={saving} />
            </div>
            <div style={{ flex: 1 }}>
              <label className="schedule-modal-label">Fim</label>
              <input type="time" className="field" value={endTime} onChange={(e) => setEndTime(e.target.value)} disabled={saving} />
            </div>
          </div>

          <button
            type="button"
            className="btn-small"
            style={{
              width: "100%",
              padding: "12px 16px",
              background: isEncaixe ? "var(--accent-2-soft)" : undefined,
              borderColor: isEncaixe ? "var(--accent-2)" : undefined,
              color: isEncaixe ? "var(--accent-2)" : undefined,
              fontWeight: isEncaixe ? 700 : 500,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
            onClick={() => setIsEncaixe((v) => !v)}
            disabled={saving}
          >
            <IconZap size={15} />
            {isEncaixe ? "Marcado como encaixe (clique para desmarcar)" : "Marcar como encaixe"}
          </button>

          <div>
            <label className="schedule-modal-label">Houve falta de produto?</label>
            <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
              <button
                type="button"
                className="btn-small"
                style={{
                  flex: 1,
                  padding: "12px 16px",
                  background: !hadShortage ? "var(--ok-soft)" : undefined,
                  borderColor: !hadShortage ? "var(--ok)" : undefined,
                  color: !hadShortage ? "var(--ok)" : undefined,
                  fontWeight: !hadShortage ? 700 : 500,
                  justifyContent: "center",
                }}
                onClick={() => setHadShortage(false)}
                disabled={saving}
              >
                Não houve falta
              </button>
              <button
                type="button"
                className="btn-small"
                style={{
                  flex: 1,
                  padding: "12px 16px",
                  background: hadShortage ? "var(--danger-soft)" : undefined,
                  borderColor: hadShortage ? "var(--danger)" : undefined,
                  color: hadShortage ? "var(--danger)" : undefined,
                  fontWeight: hadShortage ? 700 : 500,
                  justifyContent: "center",
                }}
                onClick={() => setHadShortage(true)}
                disabled={saving}
              >
                Sim, houve falta
              </button>
            </div>
          </div>

          {hadShortage && (
            <div>
              <label className="schedule-modal-label">Faltas</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 6 }}>
                {shortages.map((s, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <input
                      className="field"
                      style={{ flex: 2, fontFamily: "var(--font-mono)" }}
                      placeholder="Código do produto"
                      value={s.productCode}
                      onChange={(e) => updateShortageRow(i, "productCode", e.target.value)}
                      disabled={saving}
                    />
                    <input
                      className="field"
                      style={{ flex: 1, fontFamily: "var(--font-mono)", textAlign: "center" }}
                      type="number"
                      min="1"
                      placeholder="Qtd"
                      value={s.quantity}
                      onChange={(e) => updateShortageRow(i, "quantity", e.target.value)}
                      disabled={saving}
                    />
                    <button
                      type="button"
                      className="btn-small"
                      onClick={() => removeShortageRow(i)}
                      style={{ padding: "10px 12px", color: "var(--danger)", borderColor: "var(--danger)" }}
                      disabled={saving}
                      title="Remover"
                    >
                      <IconTrash size={14} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="btn-small"
                  onClick={addShortageRow}
                  style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 6 }}
                  disabled={saving}
                >
                  <IconPlus size={14} /> Adicionar outra falta
                </button>
              </div>
            </div>
          )}

          <button className="btn btn-primary" onClick={handleSubmit} disabled={saving} style={{ marginTop: 8 }}>
            {saving ? "Salvando..." : "Lançar registro"}
          </button>
        </div>
      </div>
    </div>
  );
}