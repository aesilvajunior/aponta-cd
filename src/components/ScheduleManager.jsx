import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  fetchSchedules,
  addSchedule,
  updateSchedule,
  deleteSchedule,
  checkScheduleConflict,
  updateScheduleGoogleEventId,
} from "../lib/api";
import { supabase } from "../supabaseClient";
import useKeyboardNav from "../hooks/useKeyboardNav";

// Cabeçalhos para chamar /api/schedule-event: o servidor só aceita quem está logado.
async function calendarHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}
import {
  IconCalendar,
  IconChevronLeft,
  IconChevronRight,
  IconX,
  IconDelete,
  IconPlus,
  IconAlertTriangle,
  IconEdit,
  IconTrash,
  IconRefresh,
} from "./Icons";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const CODE_LENGTH = 3;
const IDLE_TIMEOUT_MS = 5 * 60 * 1000;
const SESSION_KEY = "aponta_schedule_operator";

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

const MAX_VISIBLE = 2;

export default function ScheduleManager({ operators, isAdmin }) {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [loggedOperator, setLoggedOperator] = useState(null);
  const [codeInput, setCodeInput] = useState("");
  const [loginError, setLoginError] = useState("");
  const [checkingLogin, setCheckingLogin] = useState(false);

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

  const lastInteractionRef = useRef(Date.now());
  const codeInputRef = useRef(codeInput);
  codeInputRef.current = codeInput;
  const loggedOperatorRef = useRef(loggedOperator);
  loggedOperatorRef.current = loggedOperator;
  const mainContainerRef = useRef(null);
  const modalRef = useRef(null);

  function bump() {
    lastInteractionRef.current = Date.now();
  }

  useKeyboardNav({
    containerRef: mainContainerRef,
    enabled: !showModal,
    onEscape: () => {
      if (loginError) setLoginError("");
    },
  });

  useKeyboardNav({
    containerRef: modalRef,
    enabled: showModal,
    onEscape: () => {
      if (!formBusy) closeModal();
    },
  });

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const found = operators.find((o) => o.code === parsed.code);
        if (found && found.can_schedule_delivery) {
          setLoggedOperator(found);
        } else {
          sessionStorage.removeItem(SESSION_KEY);
        }
      }
    } catch {}
  }, [operators]);

  useEffect(() => {
    const iv = setInterval(() => {
      if (!loggedOperator) return;
      if (Date.now() - lastInteractionRef.current > IDLE_TIMEOUT_MS) {
        logout();
      }
    }, 1000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedOperator]);

  useEffect(() => {
    if (loggedOperator || isAdmin) return;
    if (showModal) return;

    function onKeyDown(e) {
      const tag = (e.target && e.target.tagName) || "";
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      bump();
      if (e.key >= "0" && e.key <= "9") {
        if (codeInputRef.current.length < CODE_LENGTH) {
          setCodeInput((prev) => (prev.length < CODE_LENGTH ? prev + e.key : prev));
        }
      } else if (e.key === "Backspace") {
        e.preventDefault();
        setCodeInput((prev) => prev.slice(0, -1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        handleLogin();
      } else if (e.key === "Escape") {
        e.preventDefault();
        setCodeInput("");
        setLoginError("");
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedOperator, isAdmin, showModal, operators]);

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

  function handleDigit(d) {
    bump();
    if (codeInputRef.current.length < CODE_LENGTH) {
      setCodeInput(codeInputRef.current + d);
    }
  }
  function handleBackspace() {
    bump();
    setCodeInput((p) => p.slice(0, -1));
  }
  function handleLogin() {
    if (checkingLogin) return;
    const current = codeInputRef.current.trim();
    if (current.length < CODE_LENGTH) return;
    setCheckingLogin(true);
    const op = operators.find((o) => o.code === current);
    if (!op) {
      setLoginError("Código não encontrado.");
      setCodeInput("");
      setCheckingLogin(false);
      return;
    }
    if (!op.can_schedule_delivery) {
      setLoginError("Você não tem permissão para agendar recebimento. Fale com o administrador.");
      setCodeInput("");
      setCheckingLogin(false);
      return;
    }
    setLoggedOperator(op);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ code: op.code, name: op.name }));
    setCodeInput("");
    setLoginError("");
    setCheckingLogin(false);
    bump();
  }
  function logout() {
    setLoggedOperator(null);
    setCodeInput("");
    setLoginError("");
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {}
  }

  const monthGrid = useMemo(() => buildMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);

  const byDay = useMemo(() => {
    const map = {};
    schedules.forEach((s) => {
      const key = s.scheduled_date;
      if (!map[key]) map[key] = [];
      map[key].push(s);
    });
    Object.values(map).forEach((arr) =>
      arr.sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at))
    );
    return map;
  }, [schedules]);

  const daySchedules = useMemo(() => byDay[selectedDate] || [], [byDay, selectedDate]);

  const upcoming = useMemo(() => {
    const today = todayISO();
    return schedules.filter((s) => s.scheduled_date >= today).slice(0, 8);
  }, [schedules]);

  const canCreate = isAdmin || (loggedOperator?.can_schedule_delivery);
  const operatorCodeForSave = loggedOperator?.code || null;
  const operatorNameForSave = loggedOperator?.name || "Admin";

  function openCreateModal() {
    bump();
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
    bump();
    if (!isAdmin && s.created_by_code !== loggedOperator?.code) {
      alert("Você só pode editar agendamentos que você mesmo criou.");
      return;
    }
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
    bump();
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

    const scheduledAt = new Date(`${formData.scheduled_date}T${formData.scheduled_time}:00`).toISOString();

    const { data: hasConflict, error: conflictErr } = await checkScheduleConflict(scheduledAt, editingId);
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
      createdByCode: operatorCodeForSave,
      createdByName: operatorNameForSave,
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

    try {
      const method = editingId ? "PUT" : "POST";
      const res = await fetch("/api/schedule-event", {
        method,
        headers: await calendarHeaders(),
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
    bump();
    if (!isAdmin && s.created_by_code !== loggedOperator?.code) {
      alert("Você só pode remover agendamentos que você mesmo criou.");
      return;
    }
    if (!window.confirm(`Remover o agendamento de "${s.supplier_name}" em ${fmtDateBR(s.scheduled_date)} às ${fmtTime(s.scheduled_at)}?`)) return;
    try {
      if (s.google_event_id) {
        await fetch("/api/schedule-event", {
          method: "DELETE",
          headers: await calendarHeaders(),
          body: JSON.stringify({ google_event_id: s.google_event_id }),
        });
      }
    } catch {}
    await deleteSchedule(s.id);
    await load();
  }

  const needsLogin = !isAdmin && !loggedOperator;

  if (needsLogin) {
    return (
      <div ref={mainContainerRef}>
        <div className="page-header-row" style={{ marginBottom: 22 }}>
          <div>
            <h1 className="page-title">Agenda</h1>
            <p className="page-sub" style={{ marginBottom: 0 }}>
              Digite seu código para agendar uma entrega
            </p>
          </div>
        </div>

        <div className="schedule-login-wrap">
          <div className="schedule-login-card">
            <div className="schedule-login-title">Digite seu código</div>
            <div className="schedule-login-dots">
              {Array.from({ length: CODE_LENGTH }).map((_, i) => (
                <div key={i} className={`kiosk-dot ${i < codeInput.length ? "filled" : ""}`} />
              ))}
            </div>
            <div
              className="kiosk-keypad"
              style={{ opacity: checkingLogin ? 0.55 : 1, pointerEvents: checkingLogin ? "none" : "auto" }}
            >
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
                <button key={d} className="kiosk-key" onClick={() => handleDigit(d)}>
                  {d}
                </button>
              ))}
              <button className="kiosk-key kiosk-key-muted" onClick={handleBackspace} aria-label="Apagar">
                <IconDelete size={20} />
              </button>
              <button className="kiosk-key" onClick={() => handleDigit("0")}>
                0
              </button>
              <button className="kiosk-key kiosk-key-primary" onClick={handleLogin}>
                {checkingLogin ? "..." : "OK"}
              </button>
            </div>
            {loginError ? (
              <p className="kiosk-terminal-error">{loginError}</p>
            ) : (
              <p className="kiosk-terminal-hint">teclado do computador também funciona</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={mainContainerRef}>
      <div className="page-header-row" style={{ marginBottom: 22 }}>
        <div>
          <h1 className="page-title">Agenda</h1>
          <p className="page-sub" style={{ marginBottom: 0 }}>
            {schedules.length} agendamento{schedules.length !== 1 ? "s" : ""}
            {loggedOperator && (
              <span style={{ marginLeft: 8, color: "var(--accent)", fontWeight: 600 }}>
                · {loggedOperator.name} #{loggedOperator.code}
              </span>
            )}
            {isAdmin && !loggedOperator && (
              <span style={{ marginLeft: 8, color: "var(--accent)", fontWeight: 600 }}>
                · Admin
              </span>
            )}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {canCreate && (
            <button className="btn-small btn-excel" onClick={openCreateModal} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <IconPlus size={14} /> Novo agendamento
            </button>
          )}
          {loggedOperator && (
            <button className="btn-small" onClick={logout}>Sair</button>
          )}
          {isAdmin && (
            <a
              className="btn-small"
              href="https://calendar.google.com"
              target="_blank"
              rel="noopener noreferrer"
              style={{ textDecoration: "none" }}
            >
              Google Calendar
            </a>
          )}
        </div>
      </div>

      {error && (
        <div className="alert-card alert-danger" style={{ marginBottom: 20 }}>
          Erro ao carregar agendamentos: <code>{error}</code>
        </div>
      )}

      <div className="schedule-calendar" onClick={bump}>
        <div className="schedule-calendar-header">
          <div className="schedule-calendar-title">
            {MONTHS[viewMonth]} {viewYear}
          </div>
          <div className="schedule-calendar-nav">
            <button onClick={() => { bump(); if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); } else setViewMonth(viewMonth - 1); }} aria-label="Mês anterior">
              <IconChevronLeft size={16} />
            </button>
            <button className="today-btn" onClick={() => { bump(); const t = new Date(); setViewYear(t.getFullYear()); setViewMonth(t.getMonth()); setSelectedDate(todayISO()); }}>
              Hoje
            </button>
            <button onClick={() => { bump(); if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); } else setViewMonth(viewMonth + 1); }} aria-label="Próximo mês">
              <IconChevronRight size={16} />
            </button>
          </div>
        </div>

        <div className="schedule-weekdays">
          {WEEKDAYS.map((d) => <div key={d} className="schedule-weekday">{d}</div>)}
        </div>

        <div className="schedule-grid">
          {monthGrid.map((cell, i) => {
            if (!cell) return <div key={`empty-${i}`} className="schedule-day empty" />;
            const dayList = byDay[cell.iso] || [];
            const isToday = cell.iso === todayISO();
            const isSelected = cell.iso === selectedDate;
            const hasException = dayList.some((s) => s.is_exception);
            const visible = dayList.slice(0, MAX_VISIBLE);
            const remaining = dayList.length - visible.length;

            return (
              <div
                key={cell.iso}
                className={`schedule-day ${isToday ? "today" : ""} ${isSelected ? "selected" : ""} ${hasException ? "has-exception" : ""}`}
                onClick={() => { bump(); setSelectedDate(cell.iso); }}
              >
                <div className="schedule-day-num">{cell.day}</div>
                {visible.length > 0 && (
                  <div className="schedule-day-events">
                    {visible.map((s) => (
                      <div
                        key={s.id}
                        className={`schedule-day-event ${s.is_exception ? "exception" : ""}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          bump();
                          if (isAdmin || s.created_by_code === loggedOperator?.code) {
                            openEditModal(s);
                          } else {
                            setSelectedDate(cell.iso);
                          }
                        }}
                        title={`${fmtTime(s.scheduled_at)} — ${s.supplier_name} · NF ${s.invoice_number}`}
                      >
                        <div className="schedule-day-event-time">{fmtTime(s.scheduled_at)}</div>
                        <div className="schedule-day-event-name">{s.supplier_name}</div>
                        <div className="schedule-day-event-invoice">NF {s.invoice_number}</div>
                      </div>
                    ))}
                    {remaining > 0 && <div className="schedule-day-more">+{remaining} mais</div>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }} onClick={bump}>
        <div className="card-title">
          {fmtDateBR(selectedDate)} — {daySchedules.length} agendamento{daySchedules.length !== 1 ? "s" : ""}
        </div>

        {loading ? (
          <div className="schedule-empty">Carregando...</div>
        ) : daySchedules.length === 0 ? (
          <div className="schedule-empty">
            <div className="schedule-empty-icon"><IconCalendar size={36} /></div>
            <div>Nenhum agendamento nesse dia.</div>
            {canCreate && (
              <button className="btn-small" style={{ marginTop: 16 }} onClick={openCreateModal}>
                <IconPlus size={14} /> Criar agendamento para {fmtDateBR(selectedDate)}
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
                      <span className="schedule-item-badge exception" style={{ marginLeft: 8, display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <IconAlertTriangle size={11} /> Exceção
                      </span>
                    )}
                  </div>
                  <div className="schedule-item-details">
                    <span>NF {s.invoice_number}</span>
                    {s.carrier && <span>{s.carrier}</span>}
                    {s.purchase_order && <span>Pedido {s.purchase_order}</span>}
                    <span>{s.volume_weight}</span>
                    <span>{s.responsible_name}</span>
                    {s.created_by_name && <span>por {s.created_by_name}</span>}
                  </div>
                  {s.is_exception && s.exception_reason && (
                    <div style={{ fontSize: 12, color: "var(--warning)", marginTop: 8, display: "flex", alignItems: "flex-start", gap: 6 }}>
                      <IconAlertTriangle size={13} style={{ marginTop: 2, flexShrink: 0 }} />
                      <span><strong>Motivo da exceção:</strong> {s.exception_reason}</span>
                    </div>
                  )}
                  {s.observation && (
                    <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 8, fontStyle: "italic" }}>
                      "{s.observation}"
                    </div>
                  )}
                </div>
                {(isAdmin || s.created_by_code === loggedOperator?.code) && (
                  <div className="schedule-item-actions">
                    <button className="btn-small" onClick={() => openEditModal(s)} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                      <IconEdit size={13} /> Editar
                    </button>
                    <button className="btn-danger-outline" onClick={() => removeSchedule(s)} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                      <IconTrash size={13} /> Remover
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {upcoming.length > 0 && (
        <div className="card" onClick={bump}>
          <div className="card-title">Próximos agendamentos</div>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr><th>Data</th><th>Hora</th><th>Fornecedor</th><th>NF</th><th>Responsável</th><th>Status</th></tr>
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
                      {s.is_exception ? <span className="schedule-item-badge exception">Exceção</span> : <span className="schedule-item-badge regular">Regular</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal && (
        <div className="kiosk-modal-backdrop" onClick={closeModal}>
          <div className="kiosk-modal" ref={modalRef} onClick={(e) => e.stopPropagation()} style={{ maxWidth: 660 }}>
            <div className="kiosk-modal-header">
              <div>
                <div className="kiosk-modal-title">{editingId ? "Editar agendamento" : "Novo agendamento"}</div>
                <div className="kiosk-modal-sub">Preencha os dados da entrega do fornecedor</div>
              </div>
              <button className="kiosk-modal-close" onClick={closeModal} aria-label="Fechar">
                <IconX size={18} />
              </button>
            </div>

            <div className="kiosk-modal-body" style={{ maxHeight: "62vh" }}>
              <div className="schedule-modal-grid">
                <div>
                  <label className="schedule-modal-label">Data *</label>
                  <input type="date" className="schedule-modal-field" value={formData.scheduled_date} onChange={(e) => updateField("scheduled_date", e.target.value)} disabled={formBusy} />
                </div>
                <div>
                  <label className="schedule-modal-label">Horário *</label>
                  <input type="time" className="schedule-modal-field" value={formData.scheduled_time} onChange={(e) => updateField("scheduled_time", e.target.value)} disabled={formBusy} />
                </div>
                <div className="schedule-modal-full">
                  <label className="schedule-modal-label">Fornecedor *</label>
                  <input className="schedule-modal-field" placeholder="Nome do fornecedor" value={formData.supplier_name} onChange={(e) => updateField("supplier_name", e.target.value)} disabled={formBusy} />
                </div>
                <div>
                  <label className="schedule-modal-label">Nº da nota fiscal *</label>
                  <input className="schedule-modal-field" placeholder="Ex: 12345" value={formData.invoice_number} onChange={(e) => updateField("invoice_number", e.target.value)} disabled={formBusy} />
                </div>
                <div>
                  <label className="schedule-modal-label">Transportadora</label>
                  <input className="schedule-modal-field" placeholder="Opcional" value={formData.carrier} onChange={(e) => updateField("carrier", e.target.value)} disabled={formBusy} />
                </div>
                <div>
                  <label className="schedule-modal-label">Nº pedido de compra</label>
                  <input className="schedule-modal-field" placeholder="Opcional" value={formData.purchase_order} onChange={(e) => updateField("purchase_order", e.target.value)} disabled={formBusy} />
                </div>
                <div>
                  <label className="schedule-modal-label">Volume / Peso *</label>
                  <input className="schedule-modal-field" placeholder="Ex: 3 pallets · 500kg" value={formData.volume_weight} onChange={(e) => updateField("volume_weight", e.target.value)} disabled={formBusy} />
                </div>
                <div className="schedule-modal-full">
                  <label className="schedule-modal-label">Responsável pelo recebimento *</label>
                  <input className="schedule-modal-field" placeholder="Quem vai receber o caminhão" value={formData.responsible_name} onChange={(e) => updateField("responsible_name", e.target.value)} disabled={formBusy} />
                </div>
                <div className="schedule-modal-full">
                  <label className="schedule-modal-label">Observação</label>
                  <textarea className="schedule-modal-field" placeholder="Opcional" rows={2} style={{ resize: "none" }} value={formData.observation} onChange={(e) => updateField("observation", e.target.value)} disabled={formBusy} />
                </div>
              </div>

              {formData.is_exception && (
                <div className="schedule-exception-box">
                  <div className="title">
                    <IconAlertTriangle size={14} /> Agendamento fora do horário padrão
                  </div>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 12px 0" }}>
                    O horário padrão é <strong>segunda a sexta, 08h às 15h</strong>. Justifique o motivo abaixo.
                  </p>
                  <textarea className="schedule-modal-field" placeholder="Motivo da exceção (obrigatório)" rows={2} style={{ resize: "none" }} value={formData.exception_reason} onChange={(e) => updateField("exception_reason", e.target.value)} disabled={formBusy} />
                </div>
              )}

              {formError && <p style={{ color: "var(--danger)", fontSize: 13, marginTop: 14, marginBottom: 0 }}>{formError}</p>}
            </div>

            <div className="kiosk-modal-footer">
              <button className="kiosk-btn kiosk-btn-secondary" onClick={closeModal} disabled={formBusy}>Cancelar</button>
              <button className="kiosk-btn kiosk-btn-primary" onClick={saveSchedule} disabled={formBusy}>
                {formBusy ? "Salvando..." : editingId ? "Salvar alterações" : "Criar agendamento"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}