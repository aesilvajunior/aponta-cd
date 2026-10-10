import React, { useEffect, useMemo, useState } from "react";
import {
  fetchEntries,
  verifyAdminPin,
  fetchShortages,
  fetchActiveSessions,
  fetchSeparationErrors,
  fetchConferenceQueue,
  fetchConferenceHistory,
  updateEntry,
  deleteEntry,
  bulkDeleteEntries,
  updateShortage,
  deleteShortage,
  updateConferenceItem,
  deleteConferenceItem,
  resetConferenceItem,
  updateSeparationError,
  deleteSeparationError,
  updateActiveSession,
  forceFinishActiveSession,
  cancelActiveSession,
  logAudit,
} from "../lib/api";
import { supabase } from "../supabaseClient";
import { fmtClock, fmtDate, fmtDuration, shiftFor } from "../lib/format";
import useKeyboardNav from "../hooks/useKeyboardNav";
import {
  IconActivity,
  IconCheckCircle,
  IconPackage,
  IconClock,
  IconAlertTriangle,
  IconEdit,
  IconTrash,
  IconDownload,
  IconX,
  IconRefresh,
  IconRotateCcw,
  IconLock,
  IconCheck,
  IconAlertCircle,
  IconClipboardCheck,
} from "./Icons";

const TABS = [
  { key: "entries", label: "Lançamentos", Icon: IconActivity },
  { key: "conference", label: "Mesa de conferência", Icon: IconCheckCircle },
  { key: "shortages", label: "Faltas de material", Icon: IconPackage },
  { key: "sessions", label: "Sessões em andamento", Icon: IconClock },
  { key: "errors", label: "Erros de separação", Icon: IconAlertTriangle },
];

const CONFERENCE_STATUS = [
  { value: "aguardando", label: "Aguardando" },
  { value: "em_conferencia", label: "Em conferência" },
  { value: "conferido", label: "Conferido" },
  { value: "com_problema", label: "Com problema" },
];

function fmtDateTime(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toLocalInput(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(local) {
  if (!local) return null;
  const d = new Date(local);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

function downloadCsv(lines, filename) {
  const csv = "\ufeff" + lines.join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function csvEscape(v) {
  if (v == null) return "";
  const s = String(v);
  if (/[";\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export default function AdminMaster({ operators }) {
  const [tab, setTab] = useState("entries");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);

  const [entries, setEntries] = useState([]);
  const [shortages, setShortages] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [errors, setErrors] = useState([]);
  const [queue, setQueue] = useState([]);
  const [history, setHistory] = useState([]);

  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filterOperator, setFilterOperator] = useState("");

  const [editingEntry, setEditingEntry] = useState(null);
  const [editingShortage, setEditingShortage] = useState(null);
  const [editingConference, setEditingConference] = useState(null);
  const [editingError, setEditingError] = useState(null);
  const [editingSession, setEditingSession] = useState(null);
  const [busy, setBusy] = useState(false);
  const modalRef = React.useRef(null);

  const [selected, setSelected] = useState({
    entries: new Set(),
    conference: new Set(),
    shortages: new Set(),
    errors: new Set(),
  });

  const [confirmDelete, setConfirmDelete] = useState(null);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");
  const confirmRef = React.useRef(null);

  useKeyboardNav({
    containerRef: modalRef,
    enabled: !!(editingEntry || editingShortage || editingConference || editingError || editingSession),
    onEscape: () => {
      if (busy) return;
      setEditingEntry(null);
      setEditingShortage(null);
      setEditingConference(null);
      setEditingError(null);
      setEditingSession(null);
    },
  });

  useKeyboardNav({
    containerRef: confirmRef,
    enabled: !!confirmDelete,
    onEscape: () => {
      if (busy) return;
      setConfirmDelete(null);
      setPinInput("");
      setPinError("");
    },
    onEnter: () => {
      if (!busy && pinInput.length >= 4) confirmBulkDelete();
    },
  });

  async function loadAll() {
    setLoading(true);
    const [
      { data: e },
      { data: sh },
      { data: s },
      { data: er },
      { data: q },
      { data: h },
    ] = await Promise.all([
      fetchEntries({ limit: 3000 }),
      fetchShortages({ limit: 3000 }),
      fetchActiveSessions(),
      fetchSeparationErrors(),
      fetchConferenceQueue(),
      fetchConferenceHistory({ limit: 2000 }),
    ]);
    setEntries(e || []);
    setShortages(sh || []);
    setSessions(s || []);
    setErrors(er || []);
    setQueue(q || []);
    setHistory(h || []);
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    const ch = supabase
      .channel("admin-master-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "entries" }, loadAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "entry_shortages" }, loadAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "active_sessions" }, loadAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "separation_errors" }, loadAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "conference_queue" }, loadAll)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, []);

  function showToast(kind, text) {
    setToast({ kind, text });
    setTimeout(() => setToast(null), 3500);
  }

  async function audit({ action, entity, entityId, details, beforeData, afterData }) {
    try {
      await logAudit({
        actorCode: "admin",
        actorName: "Admin Master",
        action,
        entity,
        entityId: String(entityId),
        details,
        beforeData,
        afterData,
      });
    } catch {}
  }

  const shortagesByEntry = useMemo(() => {
    const map = {};
    shortages.forEach((s) => {
      if (!map[s.entry_id]) map[s.entry_id] = [];
      map[s.entry_id].push(s);
    });
    return map;
  }, [shortages]);

  function applyFilters(list, getDate, getSearchText) {
    const q = search.trim().toLowerCase();
    return list.filter((item) => {
      if (dateFrom || dateTo) {
        const d = new Date(getDate(item));
        if (dateFrom && d < new Date(dateFrom + "T00:00:00")) return false;
        if (dateTo && d > new Date(dateTo + "T23:59:59")) return false;
      }
      if (filterOperator) {
        const ok =
          item.operator_code === filterOperator ||
          item.separated_by_code === filterOperator ||
          item.error_operator_code === filterOperator;
        if (!ok) return false;
      }
      if (q) {
        const text = getSearchText(item).toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }

  const filteredEntries = useMemo(
    () => applyFilters(entries, (e) => e.start_time, (e) => `${e.operator_name} ${e.operator_code} ${e.activity} ${e.order_number || ""} ${e.customer_name || ""} ${e.transfer_number || ""}`),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entries, search, dateFrom, dateTo, filterOperator]
  );

  const filteredQueue = useMemo(
    () => applyFilters(queue, (c) => c.separated_at, (c) => `${c.order_number || ""} ${c.customer_name || ""} ${c.separated_by_name || ""} ${c.transfer_number || ""}`),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queue, search, dateFrom, dateTo, filterOperator]
  );

  const filteredHistory = useMemo(
    () => applyFilters(history, (c) => c.conference_finished_at || c.separated_at, (c) => `${c.order_number || ""} ${c.customer_name || ""} ${c.separated_by_name || ""} ${c.conference_finished_by_name || ""}`),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [history, search, dateFrom, dateTo, filterOperator]
  );

  const filteredShortages = useMemo(() => {
    const q = search.trim().toLowerCase();
    return shortages.filter((s) => {
      if (dateFrom || dateTo) {
        const d = new Date(s.created_at);
        if (dateFrom && d < new Date(dateFrom + "T00:00:00")) return false;
        if (dateTo && d > new Date(dateTo + "T23:59:59")) return false;
      }
      if (q) {
        const text = `${s.product_code} ${s.entry_id}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [shortages, search, dateFrom, dateTo]);

  const filteredSessions = useMemo(
    () => applyFilters(sessions, (s) => s.start_time, (s) => `${s.operator_name} ${s.operator_code} ${s.activity} ${s.order_number || ""} ${s.customer_name || ""}`),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessions, search, dateFrom, dateTo, filterOperator]
  );

  const filteredErrors = useMemo(
    () => applyFilters(errors, (e) => e.created_at, (e) => `${e.operator_name} ${e.error_operator_name || ""} ${e.error_type} ${e.order_number || ""}`),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [errors, search, dateFrom, dateTo, filterOperator]
  );

  function clearFilters() {
    setSearch("");
    setDateFrom("");
    setDateTo("");
    setFilterOperator("");
  }

  const hasFilters = search || dateFrom || dateTo || filterOperator;

  const counts = {
    entries: filteredEntries.length,
    conference: filteredQueue.length + filteredHistory.length,
    shortages: filteredShortages.length,
    sessions: filteredSessions.length,
    errors: filteredErrors.length,
  };

  function toggleSelect(type, id) {
    setSelected((prev) => {
      const next = new Set(prev[type]);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { ...prev, [type]: next };
    });
  }

  function toggleSelectAll(type, visibleItems) {
    setSelected((prev) => {
      const current = prev[type];
      const allSelected = visibleItems.length > 0 && visibleItems.every((item) => current.has(item.id));
      const next = new Set(current);
      if (allSelected) {
        visibleItems.forEach((item) => next.delete(item.id));
      } else {
        visibleItems.forEach((item) => next.add(item.id));
      }
      return { ...prev, [type]: next };
    });
  }

  function clearSelection(type) {
    setSelected((prev) => ({ ...prev, [type]: new Set() }));
  }

  const currentSelection = selected[tab] || new Set();

  function exportSelection() {
    const type = tab;
    if (type === "entries") {
      const items = filteredEntries.filter((e) => currentSelection.has(e.id));
      if (items.length === 0) return showToast("error", "Nada selecionado.");
      const lines = [];
      lines.push("LANÇAMENTOS SELECIONADOS");
      lines.push("");
      lines.push("Data;Hora início;Hora fim;Duração;Operador;Código;Atividade;Pedido;Cliente;Transferência;Urgente;Nº transf.;Veículo;Placa;Estação;Encaixe;Manual;Observação");
      items.forEach((e) => {
        lines.push([
          fmtDate(e.start_time), fmtClock(e.start_time).slice(0, 5), fmtClock(e.end_time).slice(0, 5),
          fmtDuration(e.duration_seconds), e.operator_name, e.operator_code, e.activity,
          e.order_number || "—", e.customer_name || "—", e.transfer_type || "—",
          e.transfer_urgent === true ? "Sim" : e.transfer_urgent === false ? "Não" : "—",
          e.transfer_number || "—", e.vehicle || "—", e.plate || "—", e.station || "—",
          e.is_encaixe ? "Sim" : "Não", e.manual_entry ? "Sim" : "Não", e.note || "—",
        ].map(csvEscape).join(";"));
      });
      downloadCsv(lines, `admin_selecao_lancamentos_${items.length}.csv`);
    } else if (type === "shortages") {
      const items = filteredShortages.filter((s) => currentSelection.has(s.id));
      if (items.length === 0) return showToast("error", "Nada selecionado.");
      const entryById = {};
      entries.forEach((e) => { entryById[e.id] = e; });
      const lines = [];
      lines.push("FALTAS SELECIONADAS");
      lines.push("");
      lines.push("Data;Produto;Quantidade;Pedido;Cliente;Operador;Atividade");
      items.forEach((s) => {
        const e = entryById[s.entry_id];
        lines.push([
          s.created_at ? fmtDate(s.created_at) : "—",
          s.product_code, s.quantity,
          e?.order_number || "—", e?.customer_name || "—", e?.operator_name || "—", e?.activity || "—",
        ].map(csvEscape).join(";"));
      });
      downloadCsv(lines, `admin_selecao_faltas_${items.length}.csv`);
    } else if (type === "errors") {
      const items = filteredErrors.filter((e) => currentSelection.has(e.id));
      if (items.length === 0) return showToast("error", "Nada selecionado.");
      const lines = [];
      lines.push("ERROS SELECIONADOS");
      lines.push("");
      lines.push("Data;Pedido/Transf.;Tipo do pedido;Tipo de erro;Quem errou;Quem apontou;Observação;Estação");
      items.forEach((e) => {
        lines.push([
          fmtDate(e.created_at), e.order_number || "—",
          e.order_type === "pedido" ? "Pedido" : e.order_type === "transferencia" ? "Transferência" : "—",
          e.error_type, e.error_operator_name || "—", e.operator_name, e.note || "—", e.station || "—",
        ].map(csvEscape).join(";"));
      });
      downloadCsv(lines, `admin_selecao_erros_${items.length}.csv`);
    } else if (type === "conference") {
      const all = [...filteredQueue, ...filteredHistory];
      const items = all.filter((c) => currentSelection.has(c.id));
      if (items.length === 0) return showToast("error", "Nada selecionado.");
      const lines = [];
      lines.push("ITENS DA MESA SELECIONADOS");
      lines.push("");
      lines.push("Status;Pedido/Transf.;Cliente;Separado por;Separado em;Conferido por;Finalizado em;Duração");
      items.forEach((c) => {
        lines.push([
          c.status,
          c.transfer_type ? `${c.transfer_type} #${c.transfer_number || ""}` : c.order_number ? `#${c.order_number}` : "—",
          c.customer_name || "—", c.separated_by_name || "—",
          c.separated_at ? fmtDateTime(c.separated_at) : "—",
          c.conference_finished_by_name || "—",
          c.conference_finished_at ? fmtDateTime(c.conference_finished_at) : "—",
          c.duration_seconds ? fmtDuration(c.duration_seconds) : "—",
        ].map(csvEscape).join(";"));
      });
      downloadCsv(lines, `admin_selecao_mesa_${items.length}.csv`);
    } else {
      showToast("error", "Exportação não disponível para essa seção.");
    }
  }

  function requestBulkDelete() {
    const type = tab;
    const ids = Array.from(currentSelection);
    if (ids.length === 0) return showToast("error", "Nada selecionado.");
    if (type === "sessions") return showToast("error", "Sessões em andamento não podem ser excluídas em massa.");
    setConfirmDelete({ type, ids, count: ids.length });
    setPinInput("");
    setPinError("");
  }

  async function confirmBulkDelete() {
    if (!confirmDelete || busy) return;
    setBusy(true);
    const pinCheck = await verifyAdminPin(pinInput);
    if (!pinCheck.ok) {
      setBusy(false);
      setPinError(pinCheck.error ? "Não foi possível verificar o PIN. Tente de novo." : "PIN incorreto.");
      return;
    }
    let errorMsg = null;

    if (confirmDelete.type === "entries") {
      const { error: err } = await bulkDeleteEntries(confirmDelete.ids);
      if (err) errorMsg = err.message;
      if (!err) {
        await audit({ action: "remover", entity: "entry", entityId: `bulk_${confirmDelete.ids.length}`, details: `${confirmDelete.ids.length} lançamentos apagados em massa`, beforeData: { ids: confirmDelete.ids } });
      }
    } else if (confirmDelete.type === "shortages") {
      for (const id of confirmDelete.ids) {
        const { error: err } = await deleteShortage(id);
        if (err) { errorMsg = err.message; break; }
      }
      if (!errorMsg) {
        await audit({ action: "remover", entity: "shortage", entityId: `bulk_${confirmDelete.ids.length}`, details: `${confirmDelete.ids.length} faltas apagadas em massa`, beforeData: { ids: confirmDelete.ids } });
      }
    } else if (confirmDelete.type === "errors") {
      for (const id of confirmDelete.ids) {
        const { error: err } = await deleteSeparationError(id);
        if (err) { errorMsg = err.message; break; }
      }
      if (!errorMsg) {
        await audit({ action: "remover", entity: "separation_error", entityId: `bulk_${confirmDelete.ids.length}`, details: `${confirmDelete.ids.length} erros apagados em massa`, beforeData: { ids: confirmDelete.ids } });
      }
    } else if (confirmDelete.type === "conference") {
      for (const id of confirmDelete.ids) {
        const { error: err } = await deleteConferenceItem(id);
        if (err) { errorMsg = err.message; break; }
      }
      if (!errorMsg) {
        await audit({ action: "remover", entity: "conference", entityId: `bulk_${confirmDelete.ids.length}`, details: `${confirmDelete.ids.length} itens da mesa apagados em massa`, beforeData: { ids: confirmDelete.ids } });
      }
    }

    setBusy(false);
    setConfirmDelete(null);
    setPinInput("");
    setPinError("");

    if (errorMsg) {
      showToast("error", "Erro: " + errorMsg);
    } else {
      showToast("success", `${confirmDelete.count} item(ns) apagado(s)`);
      clearSelection(confirmDelete.type);
      await loadAll();
    }
  }

  async function saveEntry() {
    if (!editingEntry || busy) return;
    setBusy(true);
    const original = entries.find((x) => x.id === editingEntry.id);
    const durationSeconds = Math.round((new Date(editingEntry.end_time) - new Date(editingEntry.start_time)) / 1000);
    if (durationSeconds <= 0) {
      setBusy(false);
      showToast("error", "Data/hora de fim precisa ser depois do início.");
      return;
    }
    const fields = {
      operator_code: editingEntry.operator_code,
      operator_name: editingEntry.operator_name,
      activity: editingEntry.activity,
      start_time: editingEntry.start_time,
      end_time: editingEntry.end_time,
      duration_seconds: durationSeconds,
      shift: shiftFor(editingEntry.start_time),
      order_number: editingEntry.order_number || null,
      customer_name: editingEntry.customer_name || null,
      transfer_type: editingEntry.transfer_type || null,
      transfer_urgent: editingEntry.transfer_urgent ?? null,
      transfer_number: editingEntry.transfer_number || null,
      vehicle: editingEntry.vehicle || null,
      plate: editingEntry.plate || null,
      supplier_name: editingEntry.supplier_name || null,
      invoice_number: editingEntry.invoice_number || null,
      station: editingEntry.station || null,
      is_encaixe: !!editingEntry.is_encaixe,
      note: editingEntry.note || null,
    };
    const { error: err } = await updateEntry(editingEntry.id, fields);
    setBusy(false);
    if (err) return showToast("error", "Erro ao salvar: " + err.message);
    await audit({ action: "editar", entity: "entry", entityId: editingEntry.id, details: `Lançamento editado pelo admin`, beforeData: original, afterData: fields });
    showToast("success", "Lançamento atualizado");
    setEditingEntry(null);
    await loadAll();
  }

  async function confirmDeleteEntry(entry) {
    if (!window.confirm(`Apagar este lançamento de "${entry.operator_name}" (${entry.activity})?`)) return;
    const { error: err } = await deleteEntry(entry.id);
    if (err) return showToast("error", "Erro ao apagar: " + err.message);
    await audit({ action: "remover", entity: "entry", entityId: entry.id, details: `Lançamento removido pelo admin`, beforeData: entry });
    showToast("success", "Lançamento apagado");
    await loadAll();
  }

  async function saveShortage() {
    if (!editingShortage || busy) return;
    setBusy(true);
    const original = shortages.find((x) => x.id === editingShortage.id);
    const fields = {
      product_code: editingShortage.product_code.trim(),
      quantity: Number(editingShortage.quantity) || 1,
    };
    const { error: err } = await updateShortage(editingShortage.id, fields);
    setBusy(false);
    if (err) return showToast("error", "Erro ao salvar: " + err.message);
    await audit({ action: "editar", entity: "shortage", entityId: editingShortage.id, details: `Falta editada pelo admin`, beforeData: original, afterData: fields });
    showToast("success", "Falta atualizada");
    setEditingShortage(null);
    await loadAll();
  }

  async function confirmDeleteShortage(s) {
    if (!window.confirm(`Apagar a falta do produto "${s.product_code}"?`)) return;
    const { error: err } = await deleteShortage(s.id);
    if (err) return showToast("error", "Erro ao apagar: " + err.message);
    await audit({ action: "remover", entity: "shortage", entityId: s.id, details: `Falta removida pelo admin`, beforeData: s });
    showToast("success", "Falta apagada");
    await loadAll();
  }

  async function saveConference() {
    if (!editingConference || busy) return;
    setBusy(true);
    const original = [...queue, ...history].find((x) => x.id === editingConference.id);
    const fields = {
      order_number: editingConference.order_number || null,
      customer_name: editingConference.customer_name || null,
      transfer_type: editingConference.transfer_type || null,
      transfer_number: editingConference.transfer_number || null,
      transfer_urgent: editingConference.transfer_urgent ?? null,
      is_encaixe: !!editingConference.is_encaixe,
      status: editingConference.status,
      problem_reason: editingConference.problem_reason || null,
      note: editingConference.note || null,
    };
    const { error: err } = await updateConferenceItem(editingConference.id, fields);
    setBusy(false);
    if (err) return showToast("error", "Erro ao salvar: " + err.message);
    await audit({ action: "editar", entity: "conference", entityId: editingConference.id, details: `Item da mesa editado pelo admin`, beforeData: original, afterData: fields });
    showToast("success", "Item da mesa atualizado");
    setEditingConference(null);
    await loadAll();
  }

  async function confirmDeleteConference(c) {
    const label = c.transfer_type ? `transferência ${c.transfer_type} #${c.transfer_number}` : c.order_number ? `pedido #${c.order_number}` : "este item";
    if (!window.confirm(`Remover ${label} da mesa de conferência?`)) return;
    const { error: err } = await deleteConferenceItem(c.id);
    if (err) return showToast("error", "Erro ao remover: " + err.message);
    await audit({ action: "remover", entity: "conference", entityId: c.id, details: `Item removido da mesa pelo admin`, beforeData: c });
    showToast("success", "Item removido da mesa");
    await loadAll();
  }

  async function confirmResetConference(c) {
    if (!window.confirm("Voltar este item para 'Aguardando'?")) return;
    const { error: err } = await resetConferenceItem(c.id);
    if (err) return showToast("error", "Erro: " + err.message);
    await audit({ action: "editar", entity: "conference", entityId: c.id, details: `Item resetado para 'aguardando' pelo admin`, beforeData: c, afterData: { status: "aguardando" } });
    showToast("success", "Item resetado");
    await loadAll();
  }

  async function saveError() {
    if (!editingError || busy) return;
    setBusy(true);
    const original = errors.find((x) => x.id === editingError.id);
    const fields = {
      error_type: editingError.error_type,
      error_operator_code: editingError.error_operator_code || null,
      error_operator_name: editingError.error_operator_name || null,
      order_number: editingError.order_number || null,
      order_type: editingError.order_type || null,
      note: editingError.note || null,
    };
    const { error: err } = await updateSeparationError(editingError.id, fields);
    setBusy(false);
    if (err) return showToast("error", "Erro ao salvar: " + err.message);
    await audit({ action: "editar", entity: "separation_error", entityId: editingError.id, details: `Erro de separação editado pelo admin`, beforeData: original, afterData: fields });
    showToast("success", "Erro atualizado");
    setEditingError(null);
    await loadAll();
  }

  async function confirmDeleteError(e) {
    if (!window.confirm(`Apagar este erro de "${e.error_type}"?`)) return;
    const { error: err } = await deleteSeparationError(e.id);
    if (err) return showToast("error", "Erro ao apagar: " + err.message);
    await audit({ action: "remover", entity: "separation_error", entityId: e.id, details: `Erro de separação removido pelo admin`, beforeData: e });
    showToast("success", "Erro apagado");
    await loadAll();
  }

  function openEditSession(session) {
    setEditingSession({ ...session });
  }

  async function saveSession() {
    if (!editingSession || busy) return;
    setBusy(true);
    const original = sessions.find((x) => x.operator_code === editingSession.operator_code);
    const fields = {
      activity: editingSession.activity,
      start_time: editingSession.start_time,
      order_number: editingSession.order_number || null,
      customer_name: editingSession.customer_name || null,
      transfer_type: editingSession.transfer_type || null,
      transfer_urgent: editingSession.transfer_urgent ?? null,
      transfer_number: editingSession.transfer_number || null,
      vehicle: editingSession.vehicle || null,
      plate: editingSession.plate || null,
      supplier_name: editingSession.supplier_name || null,
      invoice_number: editingSession.invoice_number || null,
      station: editingSession.station || null,
      is_encaixe: !!editingSession.is_encaixe,
    };
    const { error: err } = await updateActiveSession(editingSession.operator_code, fields);
    setBusy(false);
    if (err) return showToast("error", "Erro ao salvar: " + err.message);
    await audit({
      action: "editar",
      entity: "session",
      entityId: editingSession.operator_code,
      details: `Sessão de ${editingSession.operator_name} editada pelo admin`,
      beforeData: original,
      afterData: fields,
    });
    showToast("success", "Sessão atualizada");
    setEditingSession(null);
    await loadAll();
  }

  async function forceFinishSession(session) {
    if (!window.confirm(
      `Forçar finalização da atividade "${session.activity}" de ${session.operator_name}?\n\n` +
      `Isso encerra agora e salva no histórico como se o operador tivesse finalizado.`
    )) return;
    const { data, error: err } = await forceFinishActiveSession(session, "[finalizada pelo admin]");
    if (err) return showToast("error", "Erro ao forçar finalização: " + err.message);
    await audit({
      action: "editar",
      entity: "session",
      entityId: session.operator_code,
      details: `Sessão de ${session.operator_name} (${session.activity}) forçada a finalizar pelo admin`,
      beforeData: session,
      afterData: data,
    });
    showToast("success", "Atividade finalizada e salva no histórico");
    await loadAll();
  }

  async function cancelSession(session) {
    if (!window.confirm(
      `Cancelar a atividade "${session.activity}" de ${session.operator_name}?\n\n` +
      `Isso apaga a sessão SEM salvar no histórico. Não fica registro de tempo.`
    )) return;
    const { error: err } = await cancelActiveSession(session.operator_code);
    if (err) return showToast("error", "Erro ao cancelar: " + err.message);
    await audit({
      action: "remover",
      entity: "session",
      entityId: session.operator_code,
      details: `Sessão de ${session.operator_name} (${session.activity}) cancelada pelo admin`,
      beforeData: session,
    });
    showToast("success", "Sessão cancelada (não salva no histórico)");
    await loadAll();
  }

  const selectableTab = tab === "entries" || tab === "shortages" || tab === "errors" || tab === "conference";
  const selectedCount = currentSelection.size;

  return (
    <div style={{ paddingBottom: selectedCount > 0 && selectableTab ? 110 : 0 }}>
      <div className="page-header-row" style={{ marginBottom: 22 }}>
        <div>
          <h1 className="page-title">Central de controle</h1>
          <p className="page-sub" style={{ marginBottom: 0 }}>
            Visualize, edite, selecione e apague qualquer dado do sistema
          </p>
        </div>
        <button className="btn-small" onClick={loadAll}>
          <IconRefresh size={14} /> Atualizar
        </button>
      </div>

      {error && (
        <div className="alert-card alert-danger" style={{ marginBottom: 20 }}>
          Erro: <code>{error}</code>
          <button className="btn-small" style={{ marginLeft: 12 }} onClick={() => setError("")}>Fechar</button>
        </div>
      )}

      {toast && (
        <div
          className="alert-card"
          style={{
            marginBottom: 20,
            background: toast.kind === "success" ? "var(--ok-soft)" : "var(--danger-soft)",
            borderColor: toast.kind === "success" ? "var(--ok)" : "var(--danger)",
            color: toast.kind === "success" ? "var(--ok)" : "var(--danger)",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          {toast.kind === "success" ? <IconCheck size={16} /> : <IconAlertCircle size={16} />}
          {toast.text}
        </div>
      )}

      <div className="quick-filters" style={{ marginBottom: 20 }}>
        <span className="quick-filters-label">Seção:</span>
        {TABS.map((t) => {
          const TabIcon = t.Icon;
          return (
            <button
              key={t.key}
              className={`quick-filter-btn ${tab === t.key ? "active" : ""}`}
              onClick={() => setTab(t.key)}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <TabIcon size={13} /> {t.label} ({counts[t.key]})
            </button>
          );
        })}
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">Filtros</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input className="field" style={{ flex: 1, minWidth: 200 }} placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className="field" style={{ width: "auto" }} value={filterOperator} onChange={(e) => setFilterOperator(e.target.value)}>
            <option value="">Todos operadores</option>
            {operators.map((o) => <option key={o.code} value={o.code}>{o.name}</option>)}
          </select>
          <span style={{ color: "var(--text-faint)", fontSize: 12 }}>de</span>
          <input type="date" className="field" style={{ width: "auto" }} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          <span style={{ color: "var(--text-faint)", fontSize: 12 }}>até</span>
          <input type="date" className="field" style={{ width: "auto" }} value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          {hasFilters && (
            <button className="btn-small" onClick={clearFilters}>
              <IconX size={13} /> Limpar filtros
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="schedule-empty">
          <div className="loading-spinner" style={{ margin: "0 auto 14px auto" }} />
          <div>Carregando...</div>
        </div>
      ) : (
        <>
          {tab === "entries" && (
            <EntriesView
              entries={filteredEntries}
              shortagesByEntry={shortagesByEntry}
              operators={operators}
              onEdit={setEditingEntry}
              onDelete={confirmDeleteEntry}
              selected={selected.entries}
              onToggle={(id) => toggleSelect("entries", id)}
              onToggleAll={() => toggleSelectAll("entries", filteredEntries)}
            />
          )}
          {tab === "conference" && (
            <ConferenceView
              queue={filteredQueue}
              history={filteredHistory}
              onEdit={setEditingConference}
              onDelete={confirmDeleteConference}
              onReset={confirmResetConference}
              selected={selected.conference}
              onToggle={(id) => toggleSelect("conference", id)}
              onToggleAll={() => toggleSelectAll("conference", [...filteredQueue, ...filteredHistory])}
            />
          )}
          {tab === "shortages" && (
            <ShortagesView
              shortages={filteredShortages}
              entries={entries}
              onEdit={setEditingShortage}
              onDelete={confirmDeleteShortage}
              selected={selected.shortages}
              onToggle={(id) => toggleSelect("shortages", id)}
              onToggleAll={() => toggleSelectAll("shortages", filteredShortages)}
            />
          )}
          {tab === "sessions" && (
            <SessionsView
              sessions={filteredSessions}
              onEdit={openEditSession}
              onForceFinish={forceFinishSession}
              onCancel={cancelSession}
            />
          )}
          {tab === "errors" && (
            <ErrorsView
              errors={filteredErrors}
              operators={operators}
              onEdit={setEditingError}
              onDelete={confirmDeleteError}
              selected={selected.errors}
              onToggle={(id) => toggleSelect("errors", id)}
              onToggleAll={() => toggleSelectAll("errors", filteredErrors)}
            />
          )}
        </>
      )}

      {selectedCount > 0 && selectableTab && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            background: "var(--bg-elevated)",
            border: "1px solid var(--glass-border)",
            borderRadius: 16,
            padding: "14px 22px",
            boxShadow: "var(--shadow-xl)",
            display: "flex",
            gap: 14,
            alignItems: "center",
            zIndex: 90,
            minWidth: 440,
          }}
        >
          <span style={{ fontWeight: 700, fontSize: 14 }}>
            {selectedCount} selecionado{selectedCount > 1 ? "s" : ""}
          </span>
          <div style={{ flex: 1 }} />
          <button className="btn-small" onClick={() => clearSelection(tab)}>
            <IconX size={13} /> Limpar
          </button>
          <button className="btn-small btn-excel" onClick={exportSelection} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <IconDownload size={13} /> Exportar
          </button>
          <button className="btn-danger-outline" onClick={requestBulkDelete} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <IconTrash size={13} /> Excluir ({selectedCount})
          </button>
        </div>
      )}

      {editingEntry && (
        <ModalShell title="Editar lançamento" onClose={() => !busy && setEditingEntry(null)} modalRef={modalRef}>
          <div className="schedule-modal-grid">
            <div>
              <label className="schedule-modal-label">Início</label>
              <input type="datetime-local" className="schedule-modal-field" value={toLocalInput(editingEntry.start_time)} onChange={(e) => setEditingEntry({ ...editingEntry, start_time: fromLocalInput(e.target.value) })} disabled={busy} />
            </div>
            <div>
              <label className="schedule-modal-label">Fim</label>
              <input type="datetime-local" className="schedule-modal-field" value={toLocalInput(editingEntry.end_time)} onChange={(e) => setEditingEntry({ ...editingEntry, end_time: fromLocalInput(e.target.value) })} disabled={busy} />
            </div>
            <div>
              <label className="schedule-modal-label">Operador</label>
              <select className="schedule-modal-field" value={editingEntry.operator_code} onChange={(e) => { const op = operators.find((x) => x.code === e.target.value); setEditingEntry({ ...editingEntry, operator_code: op?.code || "", operator_name: op?.name || "" }); }} disabled={busy}>
                {operators.map((o) => <option key={o.code} value={o.code}>{o.name} #{o.code}</option>)}
              </select>
            </div>
            <div>
              <label className="schedule-modal-label">Atividade</label>
              <input className="schedule-modal-field" value={editingEntry.activity} onChange={(e) => setEditingEntry({ ...editingEntry, activity: e.target.value })} disabled={busy} />
            </div>
            <div>
              <label className="schedule-modal-label">Nº pedido</label>
              <input className="schedule-modal-field" value={editingEntry.order_number || ""} onChange={(e) => setEditingEntry({ ...editingEntry, order_number: e.target.value.replace(/\D/g, "") })} disabled={busy} />
            </div>
            <div>
              <label className="schedule-modal-label">Nome do cliente</label>
              <input className="schedule-modal-field" value={editingEntry.customer_name || ""} onChange={(e) => setEditingEntry({ ...editingEntry, customer_name: e.target.value })} disabled={busy} />
            </div>
            <div>
              <label className="schedule-modal-label">Tipo de transferência</label>
              <select className="schedule-modal-field" value={editingEntry.transfer_type || ""} onChange={(e) => setEditingEntry({ ...editingEntry, transfer_type: e.target.value || null })} disabled={busy}>
                <option value="">—</option>
                <option value="AP">AP</option>
                <option value="ZN">ZN</option>
              </select>
            </div>
            <div>
              <label className="schedule-modal-label">Nº transferência</label>
              <input className="schedule-modal-field" value={editingEntry.transfer_number || ""} onChange={(e) => setEditingEntry({ ...editingEntry, transfer_number: e.target.value.replace(/\D/g, "") })} disabled={busy} />
            </div>
            <div>
              <label className="schedule-modal-label">Veículo</label>
              <input className="schedule-modal-field" value={editingEntry.vehicle || ""} onChange={(e) => setEditingEntry({ ...editingEntry, vehicle: e.target.value })} disabled={busy} />
            </div>
            <div>
              <label className="schedule-modal-label">Placa</label>
              <input className="schedule-modal-field" value={editingEntry.plate || ""} onChange={(e) => setEditingEntry({ ...editingEntry, plate: e.target.value.toUpperCase() })} disabled={busy} />
            </div>
            <div>
              <label className="schedule-modal-label">Estação</label>
              <input className="schedule-modal-field" value={editingEntry.station || ""} onChange={(e) => setEditingEntry({ ...editingEntry, station: e.target.value })} disabled={busy} />
            </div>
            <div className="schedule-modal-full">
              <label className="schedule-modal-label">Observação</label>
              <textarea className="schedule-modal-field" rows={2} style={{ resize: "none" }} value={editingEntry.note || ""} onChange={(e) => setEditingEntry({ ...editingEntry, note: e.target.value })} disabled={busy} />
            </div>
            <div className="schedule-modal-full" style={{ display: "flex", gap: 20 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}>
                <input type="checkbox" checked={!!editingEntry.is_encaixe} onChange={(e) => setEditingEntry({ ...editingEntry, is_encaixe: e.target.checked })} disabled={busy} />
                Encaixe
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}>
                <input type="checkbox" checked={!!editingEntry.transfer_urgent} onChange={(e) => setEditingEntry({ ...editingEntry, transfer_urgent: e.target.checked })} disabled={busy} />
                Transferência urgente
              </label>
            </div>
          </div>
          <ModalFooter onCancel={() => setEditingEntry(null)} onConfirm={saveEntry} busy={busy} confirmLabel="Salvar" />
        </ModalShell>
      )}

      {editingShortage && (
        <ModalShell title="Editar falta de material" onClose={() => !busy && setEditingShortage(null)} modalRef={modalRef} maxWidth={500}>
          <div>
            <label className="schedule-modal-label">Código do produto</label>
            <input className="schedule-modal-field" value={editingShortage.product_code} onChange={(e) => setEditingShortage({ ...editingShortage, product_code: e.target.value })} disabled={busy} autoFocus />
          </div>
          <div style={{ marginTop: 14 }}>
            <label className="schedule-modal-label">Quantidade</label>
            <input type="number" min="1" className="schedule-modal-field" value={editingShortage.quantity} onChange={(e) => setEditingShortage({ ...editingShortage, quantity: e.target.value })} disabled={busy} />
          </div>
          <ModalFooter onCancel={() => setEditingShortage(null)} onConfirm={saveShortage} busy={busy} confirmLabel="Salvar" />
        </ModalShell>
      )}

      {editingConference && (
        <ModalShell title="Editar item da mesa" onClose={() => !busy && setEditingConference(null)} modalRef={modalRef} maxWidth={620}>
          <div className="schedule-modal-grid">
            <div>
              <label className="schedule-modal-label">Status</label>
              <select className="schedule-modal-field" value={editingConference.status} onChange={(e) => setEditingConference({ ...editingConference, status: e.target.value })} disabled={busy}>
                {CONFERENCE_STATUS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="schedule-modal-label">Nº pedido</label>
              <input className="schedule-modal-field" value={editingConference.order_number || ""} onChange={(e) => setEditingConference({ ...editingConference, order_number: e.target.value.replace(/\D/g, "") })} disabled={busy} />
            </div>
            <div className="schedule-modal-full">
              <label className="schedule-modal-label">Cliente</label>
              <input className="schedule-modal-field" value={editingConference.customer_name || ""} onChange={(e) => setEditingConference({ ...editingConference, customer_name: e.target.value })} disabled={busy} />
            </div>
            <div>
              <label className="schedule-modal-label">Tipo transferência</label>
              <select className="schedule-modal-field" value={editingConference.transfer_type || ""} onChange={(e) => setEditingConference({ ...editingConference, transfer_type: e.target.value || null })} disabled={busy}>
                <option value="">—</option>
                <option value="AP">AP</option>
                <option value="ZN">ZN</option>
              </select>
            </div>
            <div>
              <label className="schedule-modal-label">Nº transferência</label>
              <input className="schedule-modal-field" value={editingConference.transfer_number || ""} onChange={(e) => setEditingConference({ ...editingConference, transfer_number: e.target.value.replace(/\D/g, "") })} disabled={busy} />
            </div>
            <div className="schedule-modal-full">
              <label className="schedule-modal-label">Motivo do problema</label>
              <input className="schedule-modal-field" value={editingConference.problem_reason || ""} onChange={(e) => setEditingConference({ ...editingConference, problem_reason: e.target.value })} disabled={busy} />
            </div>
            <div className="schedule-modal-full">
              <label className="schedule-modal-label">Observação</label>
              <textarea className="schedule-modal-field" rows={2} style={{ resize: "none" }} value={editingConference.note || ""} onChange={(e) => setEditingConference({ ...editingConference, note: e.target.value })} disabled={busy} />
            </div>
            <div className="schedule-modal-full" style={{ display: "flex", gap: 20 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}>
                <input type="checkbox" checked={!!editingConference.is_encaixe} onChange={(e) => setEditingConference({ ...editingConference, is_encaixe: e.target.checked })} disabled={busy} />
                Encaixe
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}>
                <input type="checkbox" checked={!!editingConference.transfer_urgent} onChange={(e) => setEditingConference({ ...editingConference, transfer_urgent: e.target.checked })} disabled={busy} />
                Transferência urgente
              </label>
            </div>
          </div>
          <ModalFooter onCancel={() => setEditingConference(null)} onConfirm={saveConference} busy={busy} confirmLabel="Salvar" />
        </ModalShell>
      )}

      {editingError && (
        <ModalShell title="Editar erro de separação" onClose={() => !busy && setEditingError(null)} modalRef={modalRef} maxWidth={580}>
          <div className="schedule-modal-grid">
            <div className="schedule-modal-full">
              <label className="schedule-modal-label">Tipo de erro</label>
              <input className="schedule-modal-field" value={editingError.error_type} onChange={(e) => setEditingError({ ...editingError, error_type: e.target.value })} disabled={busy} />
            </div>
            <div className="schedule-modal-full">
              <label className="schedule-modal-label">Quem errou</label>
              <select className="schedule-modal-field" value={editingError.error_operator_code || ""} onChange={(e) => { const op = operators.find((x) => x.code === e.target.value); setEditingError({ ...editingError, error_operator_code: op?.code || null, error_operator_name: op?.name || null }); }} disabled={busy}>
                <option value="">— Ninguém / não informado —</option>
                {operators.map((o) => <option key={o.code} value={o.code}>{o.name} #{o.code}</option>)}
              </select>
            </div>
            <div>
              <label className="schedule-modal-label">Nº pedido</label>
              <input className="schedule-modal-field" value={editingError.order_number || ""} onChange={(e) => setEditingError({ ...editingError, order_number: e.target.value })} disabled={busy} />
            </div>
            <div>
              <label className="schedule-modal-label">Tipo</label>
              <select className="schedule-modal-field" value={editingError.order_type || ""} onChange={(e) => setEditingError({ ...editingError, order_type: e.target.value || null })} disabled={busy}>
                <option value="">—</option>
                <option value="pedido">Pedido</option>
                <option value="transferencia">Transferência</option>
              </select>
            </div>
            <div className="schedule-modal-full">
              <label className="schedule-modal-label">Observação</label>
              <textarea className="schedule-modal-field" rows={2} style={{ resize: "none" }} value={editingError.note || ""} onChange={(e) => setEditingError({ ...editingError, note: e.target.value })} disabled={busy} />
            </div>
          </div>
          <ModalFooter onCancel={() => setEditingError(null)} onConfirm={saveError} busy={busy} confirmLabel="Salvar" />
        </ModalShell>
      )}

      {editingSession && (
        <ModalShell title={`Editar sessão de ${editingSession.operator_name}`} onClose={() => !busy && setEditingSession(null)} modalRef={modalRef} maxWidth={660}>
          <div className="schedule-modal-grid">
            <div className="schedule-modal-full">
              <label className="schedule-modal-label">Atividade</label>
              <input className="schedule-modal-field" value={editingSession.activity} onChange={(e) => setEditingSession({ ...editingSession, activity: e.target.value })} disabled={busy} />
            </div>
            <div className="schedule-modal-full">
              <label className="schedule-modal-label">Início</label>
              <input type="datetime-local" className="schedule-modal-field" value={toLocalInput(editingSession.start_time)} onChange={(e) => setEditingSession({ ...editingSession, start_time: fromLocalInput(e.target.value) })} disabled={busy} />
            </div>
            <div>
              <label className="schedule-modal-label">Nº pedido</label>
              <input className="schedule-modal-field" value={editingSession.order_number || ""} onChange={(e) => setEditingSession({ ...editingSession, order_number: e.target.value.replace(/\D/g, "") })} disabled={busy} />
            </div>
            <div>
              <label className="schedule-modal-label">Nome do cliente</label>
              <input className="schedule-modal-field" value={editingSession.customer_name || ""} onChange={(e) => setEditingSession({ ...editingSession, customer_name: e.target.value })} disabled={busy} />
            </div>
            <div>
              <label className="schedule-modal-label">Tipo transferência</label>
              <select className="schedule-modal-field" value={editingSession.transfer_type || ""} onChange={(e) => setEditingSession({ ...editingSession, transfer_type: e.target.value || null })} disabled={busy}>
                <option value="">—</option>
                <option value="AP">AP</option>
                <option value="ZN">ZN</option>
              </select>
            </div>
            <div>
              <label className="schedule-modal-label">Nº transferência</label>
              <input className="schedule-modal-field" value={editingSession.transfer_number || ""} onChange={(e) => setEditingSession({ ...editingSession, transfer_number: e.target.value.replace(/\D/g, "") })} disabled={busy} />
            </div>
            <div>
              <label className="schedule-modal-label">Veículo</label>
              <input className="schedule-modal-field" value={editingSession.vehicle || ""} onChange={(e) => setEditingSession({ ...editingSession, vehicle: e.target.value })} disabled={busy} />
            </div>
            <div>
              <label className="schedule-modal-label">Placa</label>
              <input className="schedule-modal-field" value={editingSession.plate || ""} onChange={(e) => setEditingSession({ ...editingSession, plate: e.target.value.toUpperCase() })} disabled={busy} />
            </div>
            <div>
              <label className="schedule-modal-label">Fornecedor</label>
              <input className="schedule-modal-field" value={editingSession.supplier_name || ""} onChange={(e) => setEditingSession({ ...editingSession, supplier_name: e.target.value })} disabled={busy} />
            </div>
            <div>
              <label className="schedule-modal-label">Nota fiscal</label>
              <input className="schedule-modal-field" value={editingSession.invoice_number || ""} onChange={(e) => setEditingSession({ ...editingSession, invoice_number: e.target.value })} disabled={busy} />
            </div>
            <div className="schedule-modal-full">
              <label className="schedule-modal-label">Estação</label>
              <input className="schedule-modal-field" value={editingSession.station || ""} onChange={(e) => setEditingSession({ ...editingSession, station: e.target.value })} disabled={busy} />
            </div>
            <div className="schedule-modal-full" style={{ display: "flex", gap: 20 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}>
                <input type="checkbox" checked={!!editingSession.is_encaixe} onChange={(e) => setEditingSession({ ...editingSession, is_encaixe: e.target.checked })} disabled={busy} />
                Encaixe
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}>
                <input type="checkbox" checked={!!editingSession.transfer_urgent} onChange={(e) => setEditingSession({ ...editingSession, transfer_urgent: e.target.checked })} disabled={busy} />
                Transferência urgente
              </label>
            </div>
          </div>
          <ModalFooter onCancel={() => setEditingSession(null)} onConfirm={saveSession} busy={busy} confirmLabel="Salvar" />
        </ModalShell>
      )}

      {confirmDelete && (
        <div className="kiosk-modal-backdrop" onClick={() => !busy && setConfirmDelete(null)}>
          <div className="kiosk-modal" ref={confirmRef} onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="kiosk-modal-header">
              <div>
                <div className="kiosk-modal-title" style={{ color: "var(--danger)", display: "flex", alignItems: "center", gap: 8 }}>
                  <IconAlertTriangle size={18} /> Exclusão em massa
                </div>
                <div className="kiosk-modal-sub">
                  Você vai apagar <strong>{confirmDelete.count}</strong> item(ns). Isso é permanente.
                </div>
              </div>
              <button className="kiosk-modal-close" onClick={() => !busy && setConfirmDelete(null)}>
                <IconX size={18} />
              </button>
            </div>
            <div className="kiosk-modal-body">
              <div>
                <label className="schedule-modal-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <IconLock size={12} /> Digite o PIN do admin para confirmar
                </label>
                <input
                  type="password"
                  className="schedule-modal-field"
                  style={{ textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 22, letterSpacing: 6, fontWeight: 600 }}
                  value={pinInput}
                  onChange={(e) => { setPinInput(e.target.value.replace(/\D/g, "")); setPinError(""); }}
                  placeholder="PIN"
                  autoFocus
                  disabled={busy}
                  maxLength={8}
                />
                {pinError && <p style={{ color: "var(--danger)", fontSize: 12.5, marginTop: 10, marginBottom: 0 }}>{pinError}</p>}
              </div>
            </div>
            <div className="kiosk-modal-footer">
              <button className="kiosk-btn kiosk-btn-secondary" onClick={() => setConfirmDelete(null)} disabled={busy}>Cancelar</button>
              <button className="kiosk-btn" style={{ background: "var(--danger)", color: "#fff", flex: 1 }} onClick={confirmBulkDelete} disabled={busy || pinInput.length < 4}>
                {busy ? "Apagando..." : `Apagar ${confirmDelete.count} item(ns)`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ModalShell({ title, onClose, children, modalRef, maxWidth = 720 }) {
  return (
    <div className="kiosk-modal-backdrop" onClick={onClose}>
      <div className="kiosk-modal" ref={modalRef} onClick={(e) => e.stopPropagation()} style={{ maxWidth }}>
        <div className="kiosk-modal-header">
          <div className="kiosk-modal-title">{title}</div>
          <button className="kiosk-modal-close" onClick={onClose}>
            <IconX size={18} />
          </button>
        </div>
        <div className="kiosk-modal-body" style={{ maxHeight: "70vh" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

function ModalFooter({ onCancel, onConfirm, busy, confirmLabel = "Salvar" }) {
  return (
    <div style={{ display: "flex", gap: 10, padding: "18px 26px", borderTop: "1px solid var(--border)", background: "var(--surface-raised)" }}>
      <button className="kiosk-btn kiosk-btn-secondary" onClick={onCancel} disabled={busy}>Cancelar</button>
      <button className="kiosk-btn kiosk-btn-primary" onClick={onConfirm} disabled={busy}>
        {busy ? "Salvando..." : confirmLabel}
      </button>
    </div>
  );
}

function SelectionHeader({ selected, allItems, onToggleAll }) {
  const allSelected = allItems.length > 0 && allItems.every((item) => selected.has(item.id));
  const someSelected = allItems.some((item) => selected.has(item.id));
  return (
    <th style={{ width: 40, textAlign: "center" }}>
      <input
        type="checkbox"
        checked={allSelected}
        ref={(el) => { if (el) el.indeterminate = !allSelected && someSelected; }}
        onChange={onToggleAll}
        style={{ cursor: "pointer" }}
      />
    </th>
  );
}

function SelectionCell({ id, selected, onToggle }) {
  return (
    <td style={{ textAlign: "center" }}>
      <input type="checkbox" checked={selected.has(id)} onChange={() => onToggle(id)} style={{ cursor: "pointer" }} />
    </td>
  );
}

function EntriesView({ entries, shortagesByEntry, operators, onEdit, onDelete, selected, onToggle, onToggleAll }) {
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

function ConferenceView({ queue, history, onEdit, onDelete, onReset, selected, onToggle, onToggleAll }) {
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

function ShortagesView({ shortages, entries, onEdit, onDelete, selected, onToggle, onToggleAll }) {
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

function SessionsView({ sessions, onEdit, onForceFinish, onCancel }) {
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

function ErrorsView({ errors, operators, onEdit, onDelete, selected, onToggle, onToggleAll }) {
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