import React, { useEffect, useMemo, useState } from "react";
import {
  fetchSchedules,
  addSchedule,
  updateSchedule,
  deleteSchedule,
  checkScheduleConflict,
  updateScheduleGoogleEventId,
} from "../lib/api";
import { supabase } from "../supabaseClient";

// ============================================================
// Helpers
// ============================================================

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function todayISO() {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d - tz).toISOString().slice(0, 10);
}

function fmtDateBR(iso) {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

function fmtTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function buildMonthGrid(year, month) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startWeekday = first.getDay();
  const daysInMonth = last.getDate();
  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ day: d, iso });
  }
  return cells;
}

function isWithinBusinessHours(iso) {
  const d = new Date(iso);
  const day = d.getDay();
  const hour = d.getHours();
  const minute = d.getMinutes();
  if (day === 0 || day === 6) return false;
  if (hour < 8) return false;
  if (hour > 15) return false;
  if (hour === 15 && minute > 0) return false;
  return true;
}

// ============================================================
// Componente
// ============================================================

export default function ScheduleManager({ currentOperator, isAdmin, isReceiving }) {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState(todayISO());

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    scheduled_date: todayISO(),
    scheduled_time: "08:00",
    supplier_name: "",
    invoice_number: "",
    carrier: "",
    purchase_order: "",
    volume_weight: "",
    responsible_name: "",
    observation: "",
    is_exception: false,
    exception_reason: "",
  });
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState("");

  async function load() {
    setLoading(true);
    const { data, error } = await fetchSchedules({ limit: 2000 });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    setSchedules(data || []);
    setError("");
    setLoading(false);
  }

  useEffect(() => {
    load();
    const ch = supabase
      .channel("schedules-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "delivery_schedules" }, load)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, []);

  const monthGrid = useMemo(() => buildMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);

  const byDay = useMemo(() => {
    const map = {};
    schedules.forEach((s) => {
      const key = s.scheduled_date;
      if (!map[key]) map[key] = [];
      map[key].push(s);
    });
    return map;
  }, [schedules]);

  const daySchedules = useMemo(() => {
    return (byDay[selectedDate] || []).sort(
      (a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at)
    );
  }, [byDay, selectedDate]);

  const upcoming = useMemo(() => {
    const today = todayISO();
    return schedules
      .filter((s) => s.scheduled_date >= today)
      .slice(0, 8);
  }, [schedules]);

  const canCreate = isAdmin || isReceiving;

  function openCreateModal() {
    setEditingId(null);
    setFormData({
      scheduled_date: selectedDate,
      scheduled_time: "08:00",
      supplier_name: "",
      invoice_number: "",
      carrier: "",
      purchase_order: "",
      volume_weight: "",
      responsible_name: "",
      observation: "",
      is_exception: false,
      exception_reason: "",
    });
    setFormError("");
    setShowModal(true);
  }

  function openEditModal(s) {
    setEditingId(s.id);
    setFormData({
      scheduled_date: s.scheduled_date,
      scheduled_time: s.scheduled_time.slice(0, 5),
      supplier_name: s.supplier_name,
      invoice_number: s.invoice_number,
      carrier: s.carrier || "",
      purchase_order: s.purchase_order || "",
      volume_weight: s.volume_weight,
      responsible_name: s.responsible_name,
      observation: s.observation || "",
      is_exception: s.is_exception,
      exception_reason: s.exception_reason || "",
    });
    setFormError("");
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingId(null);
    setFormError("");
  }

  function updateField(field, value) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  useEffect(() => {
    if (!showModal) return;
    const iso = `${formData.scheduled_date}T${formData.scheduled_time}:00`;
    const within = isWithinBusinessHours(iso);
    if (!within && !formData.is_exception) {
      updateField("is_exception", true);
    } else if (within && formData.is_exception) {
      updateField("is_exception", false);
      updateField("exception_reason", "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.scheduled_date, formData.scheduled_time, showModal]);

  async function saveSchedule() {
    if (!formData.scheduled_date) return setFormError("Data é obrigatória.");
    if (!formData.scheduled_time) return setFormError("Horário é obrigatório.");
    if (!formData.supplier_name.trim()) return setFormError("Fornecedor é obrigatório.");
    if (!formData.invoice_number.trim()) return setFormError("Número da nota fiscal é obrigatório.");
    if (!formData.volume_weight.trim()) return setFormError("Volume/Peso é obrigatório.");
    if (!formData.responsible_name.trim()) return setFormError("Responsável pelo recebimento é obrigatório.");
    if (formData.is_exception && !formData.exception_reason.trim()) {
      return setFormError("Justifique o motivo do agendamento fora do horário padrão.");
    }

    setFormBusy(true);

    const scheduledAt = new Date(
      `${formData.scheduled_date}T${formData.scheduled_time}:00`
    ).toISOString();

    const { data: hasConflict, error: conflictErr } = await checkScheduleConflict(
      scheduledAt,
      editingId
    );
    if (conflictErr) {
      setFormBusy(false);
      setFormError("Erro ao verificar conflito: " + conflictErr.message);
      return;
    }
    if (hasConflict) {
      setFormBusy(false);
      setFormError("Já existe um agendamento nesse horário (janela de 30 min). Escolha outro horário.");
      return;
    }

    const payload = {
      scheduledDate: formData.scheduled_date,
      scheduledTime: formData.scheduled_time,
      scheduledAt,
      supplierName: formData.supplier_name.trim(),
      invoiceNumber: formData.invoice_number.trim(),
      carrier: formData.carrier.trim() || null,
      purchaseOrder: formData.purchase_order.trim() || null,
      volumeWeight: formData.volume_weight.trim(),
      responsibleName: formData.responsible_name.trim(),
      observation: formData.observation.trim() || null,
      isException: formData.is_exception,
      exceptionReason: formData.exception_reason.trim() || null,
      createdByCode: currentOperator?.code || null,
      createdByName: currentOperator?.name || "Admin",
    };

    let savedId = editingId;
    let originalGoogleEventId = null;

    if (editingId) {
      const original = schedules.find((x) => x.id === editingId);
      originalGoogleEventId = original?.google_event_id || null;

      const { error: updErr } = await updateSchedule(editingId, {
        scheduled_date: payload.scheduledDate,
        scheduled_time: payload.scheduledTime,
        scheduled_at: payload.scheduledAt,
        supplier_name: payload.supplierName,
        invoice_number: payload.invoiceNumber,
        carrier: payload.carrier,
        purchase_order: payload.purchaseOrder,
        volume_weight: payload.volumeWeight,
        responsible_name: payload.responsibleName,
        observation: payload.observation,
        is_exception: payload.isException,
        exception_reason: payload.exceptionReason,
      });
      if (updErr) {
        setFormBusy(false);
        setFormError("Erro ao atualizar: " + updErr.message);
        return;
      }
    } else {
      const { data: inserted, error: insErr } = await addSchedule(payload);
      if (insErr) {
        setFormBusy(false);
        setFormError("Erro ao criar: " + insErr.message);
        return;
      }
      savedId = inserted?.id;
    }

    // Chama Edge Function do Google Calendar
    try {
      const method = editingId ? "PUT" : "POST";
      const res = await fetch("/api/schedule-event", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: savedId,
          google_event_id: originalGoogleEventId,
          scheduled_at: payload.scheduledAt,
          supplier_name: payload.supplierName,
          invoice_number: payload.invoiceNumber,
          carrier: payload.carrier,
          purchase_order: payload.purchaseOrder,
          volume_weight: payload.volumeWeight,
          responsible_name: payload.responsibleName,
          observation: payload.observation,
        }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.eventId && savedId) {
          await updateScheduleGoogleEventId(savedId, json.eventId);
        }
      } else {
        const errText = await res.text().catch(() => "");
        console.warn("Edge Function retornou erro:", res.status, errText);
      }
    } catch (e) {
      console.warn("Não foi possível criar evento no Google Calendar:", e);
    }

    setFormBusy(false);
    await load();
    closeModal();
  }

  async function removeSchedule(s) {
    if (!window.confirm(`Remover o agendamento de "${s.supplier_name}" em ${fmtDateBR(s.scheduled_date)} às ${fmtTime(s.scheduled_at)}?`)) {
      return;
    }
    try {
      if (s.google_event_id) {
        await fetch("/api/schedule-event", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ google_event_id: s.google_event_id }),
        });
      }
    } catch {}
    await deleteSchedule(s.id);
    await load();
  }

  return (
    <div>
      <div className="page-header-row" style={{ marginBottom: 22 }}>
        <div>
          <h1 className="page-title">Agendamentos de recebimento</h1>
          <p className="page-sub" style={{ marginBottom: 0 }}>
            {schedules.length} agendamento{schedules.length !== 1 ? "s" : ""} cadastrado{schedules.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {canCreate && (
            <button className="btn-small btn-excel" onClick={openCreateModal}>
              + Novo agendamento
            </button>
          )}
          {isAdmin && (
            <a
              className="btn-small"
              href="https://calendar.google.com"
              target="_blank"
              rel="noopener noreferrer"
              title="Abrir o Google Calendar numa nova aba"
            >
              📅 Abrir Google Calendar
            </a>
          )}
        </div>
      </div>

      {error && (
        <div className="alert-card alert-danger" style={{ marginBottom: 20 }}>
          Erro ao carregar agendamentos: <code>{error}</code>
        </div>
      )}

      {/* Calendário visual */}
      <div className="schedule-calendar">
        <div className="schedule-calendar-header">
          <div className="schedule-calendar-title">
            {MONTHS[viewMonth]} {viewYear}
          </div>
          <div className="schedule-calendar-nav">
            <button
              onClick={() => {
                if (viewMonth === 0) {
                  setViewMonth(11);
                  setViewYear(viewYear - 1);
                } else {
                  setViewMonth(viewMonth - 1);
                }
              }}
              title="Mês anterior"
            >
              ‹
            </button>
            <button
              className="today-btn"
              onClick={() => {
                const t = new Date();
                setViewYear(t.getFullYear());
                setViewMonth(t.getMonth());
                setSelectedDate(todayISO());
              }}
              title="Ir pra hoje"
            >
              Hoje
            </button>
            <button
              onClick={() => {
                if (viewMonth === 11) {
                  setViewMonth(0);
                  setViewYear(viewYear + 1);
                } else {
                  setViewMonth(viewMonth + 1);
                }
              }}
              title="Próximo mês"
            >
              ›
            </button>
          </div>
        </div>

        <div className="schedule-weekdays">
          {WEEKDAYS.map((d) => (
            <div key={d} className="schedule-weekday">{d}</div>
          ))}
        </div>

        <div className="schedule-grid">
          {monthGrid.map((cell, i) => {
            if (!cell) return <div key={`empty-${i}`} className="schedule-day empty" />;
            const daySchedulesForCell = byDay[cell.iso] || [];
            const isToday = cell.iso === todayISO();
            const isSelected = cell.iso === selectedDate;
            return (
              <div
                key={cell.iso}
                className={`schedule-day ${isToday ? "today" : ""} ${isSelected ? "selected" : ""}`}
                onClick={() => setSelectedDate(cell.iso)}
              >
                <div className="schedule-day-num">{cell.day}</div>
                {daySchedulesForCell.length > 0 && (
                  <>
                    <div className="schedule-day-dots">
                      {daySchedulesForCell.slice(0, 3).map((s, idx) => (
                        <div
                          key={idx}
                          className={`schedule-day-dot ${s.is_exception ? "exception" : ""}`}
                        />
                      ))}
                    </div>
                    <div className="schedule-day-count">{daySchedulesForCell.length}</div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Lista do dia */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">
          📅 {fmtDateBR(selectedDate)} — {daySchedules.length} agendamento{daySchedules.length !== 1 ? "s" : ""}
        </div>

        {loading ? (
          <div className="schedule-empty">Carregando…</div>
        ) : daySchedules.length === 0 ? (
          <div className="schedule-empty">
            <div className="schedule-empty-icon">📭</div>
            <div>Nenhum agendamento nesse dia.</div>
            {canCreate && (
              <button
                className="btn-small"
                style={{ marginTop: 14 }}
                onClick={openCreateModal}
              >
                + Criar agendamento pra {fmtDateBR(selectedDate)}
              </button>
            )}
          </div>
        ) : (
          <div className="schedule-list">
            {daySchedules.map((s) => (
              <div key={s.id} className="schedule-item">
                <div className="schedule-item-time">{fmtTime(s.scheduled_at)}</div>

                <div className="schedule-item-content">
                  <div className="schedule-item-supplier">
                    {s.supplier_name}
                    {s.is_exception && (
                      <span className="schedule-item-badge exception" style={{ marginLeft: 8 }}>
                        ⚠ Exceção
                      </span>
                    )}
                  </div>
                  <div className="schedule-item-details">
                    <span>📄 NF {s.invoice_number}</span>
                    {s.carrier && <span>🚚 {s.carrier}</span>}
                    {s.purchase_order && <span>🛒 Pedido {s.purchase_order}</span>}
                    <span>📦 {s.volume_weight}</span>
                    <span>👤 {s.responsible_name}</span>
                    {s.created_by_name && <span>✍ {s.created_by_name}</span>}
                  </div>
                  {s.is_exception && s.exception_reason && (
                    <div style={{ fontSize: 12, color: "var(--warning)", marginTop: 6 }}>
                      <strong>Motivo da exceção:</strong> {s.exception_reason}
                    </div>
                  )}
                  {s.observation && (
                    <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 6, fontStyle: "italic" }}>
                      "{s.observation}"
                    </div>
                  )}
                </div>

                {(isAdmin || s.created_by_code === currentOperator?.code) && (
                  <div className="schedule-item-actions">
                    <button className="btn-small" onClick={() => openEditModal(s)}>
                      Editar
                    </button>
                    <button className="btn-danger-outline" onClick={() => removeSchedule(s)}>
                      Remover
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Próximos agendamentos */}
      {upcoming.length > 0 && (
        <div className="card">
          <div className="card-title">⏭ Próximos agendamentos</div>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Hora</th>
                  <th>Fornecedor</th>
                  <th>NF</th>
                  <th>Responsável</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {upcoming.map((s) => (
                  <tr key={s.id} style={{ cursor: "pointer" }} onClick={() => setSelectedDate(s.scheduled_date)}>
                    <td>{fmtDateBR(s.scheduled_date)}</td>
                    <td style={{ fontFamily: "var(--font-mono)" }}>{fmtTime(s.scheduled_at)}</td>
                    <td style={{ fontFamily: "var(--font-display)" }}>{s.supplier_name}</td>
                    <td style={{ fontFamily: "var(--font-mono)" }}>{s.invoice_number}</td>
                    <td>{s.responsible_name}</td>
                    <td>
                      {s.is_exception ? (
                        <span className="schedule-item-badge exception">Exceção</span>
                      ) : (
                        <span className="schedule-item-badge regular">Regular</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="kiosk-modal-backdrop" onClick={closeModal}>
          <div className="kiosk-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 620 }}>
            <div className="kiosk-modal-header">
              <div>
                <div className="kiosk-modal-title">
                  {editingId ? "Editar agendamento" : "Novo agendamento"}
                </div>
                <div className="kiosk-modal-sub">
                  Preencha os dados da entrega do fornecedor
                </div>
              </div>
              <button className="kiosk-modal-close" onClick={closeModal}>✕</button>
            </div>

            <div className="kiosk-modal-body" style={{ maxHeight: "60vh" }}>
              <div className="schedule-modal-grid">
                <div>
                  <label className="schedule-modal-label">Data *</label>
                  <input
                    type="date"
                    className="schedule-modal-field"
                    value={formData.scheduled_date}
                    onChange={(e) => updateField("scheduled_date", e.target.value)}
                    disabled={formBusy}
                  />
                </div>
                <div>
                  <label className="schedule-modal-label">Horário *</label>
                  <input
                    type="time"
                    className="schedule-modal-field"
                    value={formData.scheduled_time}
                    onChange={(e) => updateField("scheduled_time", e.target.value)}
                    disabled={formBusy}
                  />
                </div>

                <div className="schedule-modal-full">
                  <label className="schedule-modal-label">Fornecedor *</label>
                  <input
                    className="schedule-modal-field"
                    placeholder="Nome do fornecedor"
                    value={formData.supplier_name}
                    onChange={(e) => updateField("supplier_name", e.target.value)}
                    disabled={formBusy}
                  />
                </div>

                <div>
                  <label className="schedule-modal-label">Nº da nota fiscal *</label>
                  <input
                    className="schedule-modal-field"
                    placeholder="Ex: 12345"
                    value={formData.invoice_number}
                    onChange={(e) => updateField("invoice_number", e.target.value)}
                    disabled={formBusy}
                  />
                </div>
                <div>
                  <label className="schedule-modal-label">Transportadora</label>
                  <input
                    className="schedule-modal-field"
                    placeholder="Opcional"
                    value={formData.carrier}
                    onChange={(e) => updateField("carrier", e.target.value)}
                    disabled={formBusy}
                  />
                </div>

                <div>
                  <label className="schedule-modal-label">Nº pedido de compra</label>
                  <input
                    className="schedule-modal-field"
                    placeholder="Opcional"
                    value={formData.purchase_order}
                    onChange={(e) => updateField("purchase_order", e.target.value)}
                    disabled={formBusy}
                  />
                </div>
                <div>
                  <label className="schedule-modal-label">Volume / Peso *</label>
                  <input
                    className="schedule-modal-field"
                    placeholder="Ex: 3 pallets · 500kg"
                    value={formData.volume_weight}
                    onChange={(e) => updateField("volume_weight", e.target.value)}
                    disabled={formBusy}
                  />
                </div>

                <div className="schedule-modal-full">
                  <label className="schedule-modal-label">Responsável pelo recebimento *</label>
                  <input
                    className="schedule-modal-field"
                    placeholder="Quem vai receber o caminhão"
                    value={formData.responsible_name}
                    onChange={(e) => updateField("responsible_name", e.target.value)}
                    disabled={formBusy}
                  />
                </div>

                <div className="schedule-modal-full">
                  <label className="schedule-modal-label">Observação</label>
                  <textarea
                    className="schedule-modal-field"
                    placeholder="Opcional"
                    rows={2}
                    style={{ resize: "none" }}
                    value={formData.observation}
                    onChange={(e) => updateField("observation", e.target.value)}
                    disabled={formBusy}
                  />
                </div>
              </div>

              {formData.is_exception && (
                <div className="schedule-exception-box">
                  <div className="title">
                    ⚠ Agendamento fora do horário padrão
                  </div>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 10px 0" }}>
                    O horário padrão de recebimento é <strong>segunda a sexta, das 08h às 15h</strong>. Justifique o motivo abaixo.
                  </p>
                  <textarea
                    className="schedule-modal-field"
                    placeholder="Motivo da exceção (obrigatório)"
                    rows={2}
                    style={{ resize: "none" }}
                    value={formData.exception_reason}
                    onChange={(e) => updateField("exception_reason", e.target.value)}
                    disabled={formBusy}
                  />
                </div>
              )}

              {formError && (
                <p style={{ color: "var(--danger)", fontSize: 13, marginTop: 12, marginBottom: 0 }}>
                  {formError}
                </p>
              )}
            </div>

            <div className="kiosk-modal-footer">
              <button className="kiosk-btn kiosk-btn-secondary" onClick={closeModal} disabled={formBusy}>
                Cancelar
              </button>
              <button
                className="kiosk-btn kiosk-btn-primary"
                onClick={saveSchedule}
                disabled={formBusy}
              >
                {formBusy ? "Salvando..." : editingId ? "Salvar alterações" : "Criar agendamento"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}