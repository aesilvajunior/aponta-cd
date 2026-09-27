import React, { useEffect, useRef, useState } from "react";
import { fetchActiveSessionFor, startSession, finishSession, saveShortages, addToConferenceQueue } from "../lib/api";
import { fmtDuration, fmtClock, fmtDate, shiftFor } from "../lib/format";
import { getStationName, promptForStationName } from "../lib/station";
import { playSuccess, playError, playKey } from "../utils/sound";
import { playEventSound } from "../lib/sounds";
import useKeyboardNav from "../hooks/useKeyboardNav";
import { useTheme } from "../context/ThemeContext";
import { supabase } from "../supabaseClient";
import {
  IconActivity,
  IconClipboardCheck,
  IconPackage,
  IconZap,
  IconArrowLeftRight,
  IconInbox,
  IconTruck,
  IconMapPin,
  IconCheck,
  IconX,
  IconDelete,
  IconTrash,
  IconPlus,
  IconFlag,
  IconSun,
  IconMoon,
  IconPause,
  IconPlay,
} from "./Icons";

const CODE_LENGTH = 3;
const AUTO_RETURN_MS = 2200;
const IDLE_TIMEOUT_MS = 5 * 60 * 1000;
const TRANSFER_TYPES = ["AP", "ZN"];
const KIOSK_THEME_KEY = "aponta_kiosk_theme";

function shouldAskShortage(session, activities) {
  if (!session) return false;
  const config = activities.find((a) => a.name === session.activity);
  if (config && config.asks_shortage === true) return true;
  if (config && config.asks_shortage === false) return false;
  const askedForOrder = !!(session.order_number || session.customer_name || session.transfer_type);
  return askedForOrder;
}

function isSeparationEntry(entry) {
  return !!(entry.order_number || entry.transfer_type);
}

function activityIcon(name) {
  const n = (name || "").toLowerCase();
  if (n.includes("receb")) return <IconInbox size={26} />;
  if (n.includes("confer")) return <IconClipboardCheck size={26} />;
  if (n.includes("separ")) return <IconPackage size={26} />;
  if (n.includes("embal")) return <IconPackage size={26} />;
  if (n.includes("exped")) return <IconTruck size={26} />;
  if (n.includes("reposi")) return <IconArrowLeftRight size={26} />;
  if (n.includes("invent")) return <IconClipboardCheck size={26} />;
  if (n.includes("carreg")) return <IconTruck size={26} />;
  return <IconActivity size={26} />;
}

export default function Kiosk({ operators, activities, vehicles = [], refreshEntries }) {
  const { resolvedTheme, setTheme } = useTheme();

  const [codeInput, setCodeInput] = useState("");
  const [loggedOperator, setLoggedOperator] = useState(null);
  const [session, setSession] = useState(null);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState("info");
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [checkingLogin, setCheckingLogin] = useState(false);
  const [shake, setShake] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
  const [noteInput, setNoteInput] = useState("");
  const [localTheme, setLocalTheme] = useState(() => {
    try {
      return localStorage.getItem(KIOSK_THEME_KEY) || "auto";
    } catch {
      return "auto";
    }
  });

  const [paused, setPaused] = useState(false);
  const [pausedAt, setPausedAt] = useState(null);
  const [totalPausedSeconds, setTotalPausedSeconds] = useState(0);

  const [orderFormActivity, setOrderFormActivity] = useState(null);
  const [orderFieldType, setOrderFieldType] = useState("pedido");
  const [orderBranch, setOrderBranch] = useState(null);
  const [orderNumber, setOrderNumber] = useState("");
  const [customerFirstName, setCustomerFirstName] = useState("");
  const [customerLastName, setCustomerLastName] = useState("");
  const [transferType, setTransferType] = useState("");
  const [transferUrgent, setTransferUrgent] = useState(false);
  const [transferNumber, setTransferNumber] = useState("");
  const [supplierInput, setSupplierInput] = useState("");
  const [invoiceInput, setInvoiceInput] = useState("");
  const [orderError, setOrderError] = useState("");
  const [stationName, setStationNameState] = useState(getStationName());

  const [showFinishModal, setShowFinishModal] = useState(false);
  const [finishHadShortage, setFinishHadShortage] = useState(null);
  const [shortages, setShortages] = useState([]);
  const [finishNote, setFinishNote] = useState("");

  const codeInputRef = useRef(codeInput);
  codeInputRef.current = codeInput;
  const lastInteractionRef = useRef(Date.now());
  const autoReturnTimeoutRef = useRef(null);
  const finishModalOpenRef = useRef(false);
  const mainContainerRef = useRef(null);
  const modalRef = useRef(null);

  useEffect(() => {
    try {
      localStorage.setItem(KIOSK_THEME_KEY, localTheme);
    } catch {}

    if (localTheme === "auto") return;
    const html = document.documentElement;
    const previous = html.getAttribute("data-theme");
    html.setAttribute("data-theme", localTheme === "dark" ? "dark" : "light");
    return () => {
      if (previous) html.setAttribute("data-theme", previous);
      else html.removeAttribute("data-theme");
    };
  }, [localTheme]);

  function cycleTheme() {
    const next = localTheme === "auto" ? "dark" : localTheme === "dark" ? "light" : "auto";
    setLocalTheme(next);
  }

  function bump() {
    lastInteractionRef.current = Date.now();
  }

  useKeyboardNav({
    containerRef: mainContainerRef,
    enabled: !showFinishModal,
    onEscape: () => {
      if (orderFormActivity) {
        cancelOrderForm();
      } else if (codeInput) {
        setCodeInput("");
        setMsg("");
      }
    },
  });

  useKeyboardNav({
    containerRef: modalRef,
    enabled: showFinishModal,
    onEscape: () => {
      if (!busy) closeFinishModal();
    },
  });

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (!loggedOperator) return;
    const iv = setInterval(() => {
      if (finishModalOpenRef.current) return;
      if (paused) return;
      if (Date.now() - lastInteractionRef.current > IDLE_TIMEOUT_MS) reset();
    }, 1000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedOperator, paused]);

  useEffect(() => {
    finishModalOpenRef.current = showFinishModal;
    if (showFinishModal) lastInteractionRef.current = Date.now();
  }, [showFinishModal]);

  useEffect(() => {
    return () => {
      if (autoReturnTimeoutRef.current) clearTimeout(autoReturnTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (loggedOperator) return;
    function onKeyDown(e) {
      bump();
      if (e.key >= "0" && e.key <= "9") {
        setCodeInput((prev) => (prev.length < CODE_LENGTH ? prev + e.key : prev));
      } else if (e.key === "Backspace") {
        setCodeInput((prev) => prev.slice(0, -1));
      } else if (e.key === "Enter") {
        handleLogin();
      } else if (e.key === "Escape") {
        setCodeInput("");
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedOperator, operators]);

  function reset() {
    if (autoReturnTimeoutRef.current) clearTimeout(autoReturnTimeoutRef.current);
    setCodeInput("");
    setLoggedOperator(null);
    setSession(null);
    setMsg("");
    setConfirmation(null);
    setNoteInput("");
    setShowFinishModal(false);
    setFinishHadShortage(null);
    setShortages([]);
    setFinishNote("");
    setPaused(false);
    setPausedAt(null);
    setTotalPausedSeconds(0);
    cancelOrderForm();
  }

  function handleDigit(d) {
    bump();
    playKey();
    if (codeInputRef.current.length < CODE_LENGTH) setCodeInput(codeInputRef.current + d);
  }

  function handleBackspace() {
    bump();
    setCodeInput((p) => p.slice(0, -1));
  }

  function triggerShake() {
    setShake(true);
    setTimeout(() => setShake(false), 400);
  }

  async function handleLogin() {
    const current = codeInputRef.current;
    if (current.length < CODE_LENGTH || checkingLogin) return;
    const op = operators.find((o) => o.code === current);
    if (!op) {
      playError();
      setMsgType("error");
      setMsg("Código não encontrado.");
      triggerShake();
      setCodeInput("");
      return;
    }
    bump();
    setMsg("");
    setCheckingLogin(true);
    const { data, error } = await fetchActiveSessionFor(op.code);
    if (error) {
      playError();
      setMsgType("error");
      setMsg("Erro ao verificar sessão. Tente de novo.");
      setCheckingLogin(false);
      return;
    }
    playSuccess();
    setSession(data || null);
    if (data) {
      setPaused(!!data.paused_at);
      setPausedAt(data.paused_at ? new Date(data.paused_at).getTime() : null);
      setTotalPausedSeconds(data.total_paused_seconds || 0);
    } else {
      setPaused(false);
      setPausedAt(null);
      setTotalPausedSeconds(0);
    }
    setLoggedOperator(op);
    setCheckingLogin(false);
  }

  async function startActivity(activityName, extra = {}) {
    if (busy) return;
    bump();
    setBusy(true);
    const startedAt = new Date().toISOString();
    const { error } = await startSession({
      operatorCode: loggedOperator.code,
      operatorName: loggedOperator.name,
      activity: activityName,
      orderNumber: extra.orderNumber || null,
      customerName: extra.customerName || null,
      transferType: extra.transferType || null,
      transferUrgent: extra.transferUrgent ?? null,
      transferNumber: extra.transferNumber || null,
      vehicle: extra.vehicle || null,
      plate: extra.plate || null,
      station: stationName || null,
      isEncaixe: extra.isEncaixe || false,
      supplierName: extra.supplierName || null,
      invoiceNumber: extra.invoiceNumber || null,
    });
    setBusy(false);

    if (!error) {
      playSuccess();
      const detailParts = [];
      if (extra.isEncaixe) detailParts.push("ENCAIXE");
      if (extra.transferType) {
        detailParts.push(`${extra.transferType} #${extra.transferNumber}${extra.transferUrgent ? " · URGENTE" : ""}`);
      } else if (extra.customerName) {
        detailParts.push(extra.customerName);
      } else if (extra.vehicle) {
        detailParts.push(`${extra.vehicle} · ${extra.plate}`);
      } else if (extra.supplierName) {
        detailParts.push(`${extra.supplierName}${extra.invoiceNumber ? ` · NF ${extra.invoiceNumber}` : ""}`);
      }

      setConfirmation({
        kind: "started",
        activity: activityName,
        time: fmtClock(startedAt),
        detail: detailParts.join(" · ") || null,
      });
      autoReturnTimeoutRef.current = setTimeout(reset, AUTO_RETURN_MS);
      return;
    }

    playError();

    if ((error.message || "").includes("OPERATOR_ALREADY_ACTIVE")) {
      const { data } = await fetchActiveSessionFor(loggedOperator.code);
      if (data) {
        setSession(data);
        setPaused(!!data.paused_at);
        setPausedAt(data.paused_at ? new Date(data.paused_at).getTime() : null);
        setTotalPausedSeconds(data.total_paused_seconds || 0);
        setMsgType("info");
        setMsg("Você já tinha uma atividade em andamento — ela foi carregada aqui.");
      } else {
        setMsgType("error");
        setMsg("Sessão já ativa. Tente novamente em instantes.");
      }
      return;
    }

    setMsgType("error");
    setMsg(`Erro ao iniciar. ${error.message || "Tente novamente."}`);
  }

  function handleActivityClick(activity) {
    if (activity.requires_order_info) {
      bump();
      setOrderFormActivity(activity.name);
      setOrderFieldType(activity.extra_field_type || "pedido");
      setOrderBranch(null);
      setOrderNumber("");
      setCustomerFirstName("");
      setCustomerLastName("");
      setTransferType("");
      setTransferUrgent(false);
      setTransferNumber("");
      setSupplierInput("");
      setInvoiceInput("");
      setOrderError("");
    } else {
      startActivity(activity.name);
    }
  }

  function cancelOrderForm() {
    setOrderFormActivity(null);
    setOrderBranch(null);
    setOrderNumber("");
    setCustomerFirstName("");
    setCustomerLastName("");
    setTransferType("");
    setTransferUrgent(false);
    setTransferNumber("");
    setSupplierInput("");
    setInvoiceInput("");
    setOrderError("");
  }

  function resetOrderFields() {
    setOrderNumber("");
    setCustomerFirstName("");
    setCustomerLastName("");
    setTransferType("");
    setTransferUrgent(false);
    setTransferNumber("");
    setSupplierInput("");
    setInvoiceInput("");
    setOrderError("");
  }

  function selectBranch(branch) {
    bump();
    setOrderBranch(branch);
    resetOrderFields();
  }

  async function chooseVehicleAndStart(v) {
    if (busy) return;
    const activityName = orderFormActivity;
    playKey();
    cancelOrderForm();
    await startActivity(activityName, { vehicle: v.model, plate: v.plate });
  }

  async function confirmSupplierStart() {
    const activityName = orderFormActivity;
    if (!supplierInput.trim()) return setOrderError("Digite o nome do fornecedor.");
    if (!invoiceInput.trim()) return setOrderError("Digite o número da nota fiscal.");
    const extra = {
      supplierName: supplierInput.trim(),
      invoiceNumber: invoiceInput.trim(),
    };
    cancelOrderForm();
    await startActivity(activityName, extra);
  }

  async function confirmOrderStart() {
    const activityName = orderFormActivity;

    if (orderBranch === "encaixe") {
      if (!/^\d{4}$/.test(orderNumber)) return setOrderError("Digite os 4 últimos dígitos do pedido.");
      if (!customerFirstName.trim() || !customerLastName.trim()) return setOrderError("Digite o nome e o sobrenome do cliente.");
      const extra = { orderNumber, customerName: `${customerFirstName.trim()} ${customerLastName.trim()}`, isEncaixe: true };
      cancelOrderForm();
      await startActivity(activityName, extra);
      return;
    }

    if (orderBranch === "pedido") {
      if (!/^\d{4}$/.test(orderNumber)) return setOrderError("Digite os 4 últimos dígitos do pedido.");
      if (!customerFirstName.trim() || !customerLastName.trim()) return setOrderError("Digite o nome e o sobrenome do cliente.");
      const extra = { orderNumber, customerName: `${customerFirstName.trim()} ${customerLastName.trim()}`, isEncaixe: false };
      cancelOrderForm();
      await startActivity(activityName, extra);
      return;
    }

    if (orderBranch === "transferencia") {
      if (!transferType) return setOrderError("Selecione se é AP ou ZN.");
      if (!/^\d{4}$/.test(transferNumber)) return setOrderError("Digite os 4 últimos dígitos da transferência.");
      const extra = { transferType, transferUrgent, transferNumber };
      cancelOrderForm();
      await startActivity(activityName, extra);
      return;
    }

    setOrderError("Escolha uma opção acima.");
  }

  async function handlePause() {
    if (!session || busy) return;
    bump();
    setBusy(true);
    const nowIso = new Date().toISOString();
    const { error: err } = await supabase
      .from("active_sessions")
      .update({ paused_at: nowIso })
      .eq("operator_code", session.operator_code);
    setBusy(false);
    if (err) {
      playError();
      setMsgType("error");
      setMsg(`Erro ao pausar. ${err.message}`);
      return;
    }
    setPaused(true);
    setPausedAt(Date.now());
    setSession((s) => s ? { ...s, paused_at: nowIso } : s);
  }

  async function handleResume() {
    if (!session || busy || !pausedAt) return;
    bump();
    setBusy(true);
    const addedPause = Math.round((Date.now() - pausedAt) / 1000);
    const newTotal = (session.total_paused_seconds || 0) + addedPause;
    const { error: err } = await supabase
      .from("active_sessions")
      .update({ paused_at: null, total_paused_seconds: newTotal })
      .eq("operator_code", session.operator_code);
    setBusy(false);
    if (err) {
      playError();
      setMsgType("error");
      setMsg(`Erro ao retomar. ${err.message}`);
      return;
    }
    playSuccess();
    setPaused(false);
    setPausedAt(null);
    setTotalPausedSeconds(newTotal);
    setSession((s) => s ? { ...s, paused_at: null, total_paused_seconds: newTotal } : s);
  }

  async function finishDirectly() {
    if (!session || busy) return;
    bump();
    setBusy(true);
    const pausedSecs = session.total_paused_seconds || 0;
    const duration = Math.max(0, Math.round((Date.now() - new Date(session.start_time).getTime()) / 1000) - pausedSecs);
    const { data: newEntry, error } = await finishSession(session, duration, shiftFor(session.start_time), noteInput.trim(), !!session.is_encaixe, pausedSecs);
    setBusy(false);
    if (!error) {
      playSuccess();
      playEventSound("sound_goal");
      if (newEntry && isSeparationEntry(newEntry)) {
        await addToConferenceQueue(newEntry);
      }
      refreshEntries?.();
      setSession(null);
      setNoteInput("");
      setPaused(false);
      setPausedAt(null);
      setTotalPausedSeconds(0);
      setConfirmation({ kind: "finished", activity: session.activity, extra: fmtDuration(duration) });
      autoReturnTimeoutRef.current = setTimeout(reset, AUTO_RETURN_MS);
    } else {
      playError();
      setMsgType("error");
      setMsg(`Erro ao salvar. ${error.message || "Tente novamente."}`);
    }
  }

  function openFinishModal() {
    bump();
    setFinishHadShortage(null);
    setShortages([]);
    setFinishNote(noteInput);
    setShowFinishModal(true);
  }

  async function handleFinishClick() {
    bump();
    if (shouldAskShortage(session, activities)) {
      openFinishModal();
    } else {
      await finishDirectly();
    }
  }

  function closeFinishModal() {
    bump();
    setShowFinishModal(false);
    setFinishHadShortage(null);
    setShortages([]);
  }

  function addShortageRow() {
    bump();
    setShortages((prev) => [...prev, { productCode: "", quantity: 1 }]);
  }
  function updateShortageRow(index, field, value) {
    bump();
    setShortages((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  }
  function removeShortageRow(index) {
    bump();
    setShortages((prev) => prev.filter((_, i) => i !== index));
  }

  async function confirmFinish() {
    if (busy) return;
    if (finishHadShortage === null) return;
    if (finishHadShortage === true) {
      const valid = shortages.filter((s) => s.productCode.trim().length > 0);
      if (valid.length === 0) {
        setMsgType("error");
        setMsg("Adicione pelo menos uma falta com código do produto.");
        return;
      }
    }

    setBusy(true);
    const pausedSecs = session.total_paused_seconds || 0;
    const duration = Math.max(0, Math.round((Date.now() - new Date(session.start_time).getTime()) / 1000) - pausedSecs);
    const shift = shiftFor(session.start_time);
    const finalNote = finishNote.trim();

    const { data: newEntry, error } = await finishSession(
      session,
      duration,
      shift,
      finalNote,
      !!session.is_encaixe,
      pausedSecs
    );

    if (error) {
      setBusy(false);
      playError();
      setMsgType("error");
      setMsg(`Erro ao finalizar. ${error.message || "Tente novamente."}`);
      return;
    }

    if (finishHadShortage === true) {
      const validShortages = shortages
        .filter((s) => s.productCode.trim().length > 0)
        .map((s) => ({
          productCode: s.productCode.trim(),
          quantity: Number(s.quantity) || 1,
          supplierName: session.supplier_name || null,
        }));

      const { error: errShortage } = await saveShortages(newEntry.id, validShortages);
      if (errShortage) {
        setBusy(false);
        playError();
        setMsgType("error");
        setMsg(`Atividade salva, mas houve erro ao salvar faltas: ${errShortage.message}`);
        setSession(null);
        setNoteInput("");
        refreshEntries?.();
        return;
      }
      playEventSound("sound_shortage");
    }

    if (newEntry && isSeparationEntry(newEntry)) {
      await addToConferenceQueue(newEntry);
    }

    setBusy(false);
    playSuccess();
    playEventSound("sound_goal");
    refreshEntries?.();
    setSession(null);
    setNoteInput("");
    setPaused(false);
    setPausedAt(null);
    setTotalPausedSeconds(0);
    setConfirmation({
      kind: "finished",
      activity: session.activity,
      extra: fmtDuration(duration),
    });
    closeFinishModal();
    autoReturnTimeoutRef.current = setTimeout(reset, AUTO_RETURN_MS);
  }

  function editStation() {
    setStationNameState(promptForStationName());
  }

  const dots = Array.from({ length: CODE_LENGTH }, (_, i) => i < codeInput.length);
  const themeIcon = localTheme === "dark" ? <IconMoon size={14} /> : localTheme === "light" ? <IconSun size={14} /> : <IconActivity size={14} />;

  return (
    <div className="kiosk-page" ref={mainContainerRef}>
      <header className="kiosk-header">
        <div className="kiosk-header-left">
          <div className="kiosk-header-title">Aponta CD</div>
        </div>

        <div className="kiosk-header-right">
          <button
            className="kiosk-header-station"
            onClick={cycleTheme}
            title={`Tema: ${localTheme === "auto" ? "automático" : localTheme === "dark" ? "escuro" : "claro"} (clique para alternar)`}
          >
            {themeIcon}
            {localTheme === "auto" ? "Auto" : localTheme === "dark" ? "Escuro" : "Claro"}
          </button>
          <div className="kiosk-header-clock">
            <div className="kiosk-header-time">{fmtClock(now)}</div>
            <div className="kiosk-header-date">{fmtDate(now)}</div>
          </div>
          <div className="kiosk-header-shift">
            <span className="kiosk-header-shift-dot" />
            Turno {shiftFor(now)}
          </div>
          <button
            className={`kiosk-header-station ${!stationName ? "kiosk-header-station-alert" : ""}`}
            onClick={editStation}
            title="Clique para nomear esta estação/terminal"
          >
            <IconMapPin size={14} />
            {stationName || "Nomear estação"}
          </button>
        </div>
      </header>

      <main className="kiosk-main">
        {!loggedOperator && (
          <div className={`kiosk-terminal-wrap ${shake ? "shake" : ""}`}>
            <div className="kiosk-terminal-title">Digite seu código</div>
            <div className="kiosk-terminal-dots">
              {dots.map((filled, i) => (
                <div key={i} className={`kiosk-dot ${filled ? "filled" : ""}`} />
              ))}
            </div>
            <div className="kiosk-keypad" style={{ opacity: checkingLogin ? 0.55 : 1, pointerEvents: checkingLogin ? "none" : "auto" }}>
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
            {msg ? (
              <p className="kiosk-terminal-error">{msg}</p>
            ) : (
              <p className="kiosk-terminal-hint">teclado do computador também funciona</p>
            )}
          </div>
        )}

        {loggedOperator && confirmation && (
          <div className="kiosk-confirm">
            <div
              className="kiosk-confirm-icon"
              style={{
                background: confirmation.kind === "started" ? "var(--accent-soft)" : "var(--ok-soft)",
                color: confirmation.kind === "started" ? "var(--accent)" : "var(--ok)",
              }}
            >
              {confirmation.kind === "started" ? <IconActivity size={30} /> : <IconCheck size={30} />}
            </div>
            <div className="kiosk-confirm-title">
              {confirmation.activity} {confirmation.kind === "started" ? "iniciada" : "finalizada"}
            </div>
            <div className="kiosk-confirm-sub">
              {confirmation.kind === "started"
                ? `às ${confirmation.time}${confirmation.detail ? ` · ${confirmation.detail}` : ""}`
                : `duração: ${confirmation.extra}`}
            </div>
          </div>
        )}

        {loggedOperator && !confirmation && (
          <div className="kiosk-logged">
            <div className="kiosk-operator-bar">
              <div className="kiosk-operator-info">
                <div className="kiosk-operator-avatar">
                  {loggedOperator.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="kiosk-operator-name">{loggedOperator.name}</div>
                  <div className="kiosk-operator-role">
                    {loggedOperator.role} · #{loggedOperator.code}
                  </div>
                </div>
              </div>
              <button className="kiosk-operator-change" onClick={reset}>
                Trocar operador
              </button>
            </div>

            {!session && activities.length > 0 && !orderFormActivity && (
              <div className="kiosk-activities">
                <div className="kiosk-section-title">Escolha uma atividade</div>
                <div className="kiosk-activities-grid">
                  {activities.map((a) => (
                    <button
                      key={a.name}
                      className="kiosk-activity-card"
                      onClick={() => handleActivityClick(a)}
                      disabled={busy}
                    >
                      <span className="kiosk-activity-icon">{activityIcon(a.name)}</span>
                      <span className="kiosk-activity-name">{a.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!session && orderFormActivity && (
              <div className="kiosk-form">
                <div className="kiosk-form-header">
                  <div className="kiosk-section-title">{orderFormActivity}</div>
                  <button className="kiosk-form-cancel" onClick={cancelOrderForm} disabled={busy}>
                    Cancelar
                  </button>
                </div>

                {orderFieldType === "veiculo" ? (
                  <>
                    <div className="kiosk-form-hint">Escolha o veículo:</div>
                    {vehicles.length > 0 ? (
                      <div className="kiosk-activities-grid">
                        {vehicles.map((v) => (
                          <button
                            key={v.plate}
                            className="kiosk-activity-card kiosk-vehicle-card"
                            onClick={() => chooseVehicleAndStart(v)}
                            disabled={busy}
                          >
                            <span className="kiosk-activity-icon"><IconTruck size={24} /></span>
                            <span className="kiosk-activity-name">{v.plate}</span>
                            <span className="kiosk-vehicle-model">{v.model}</span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="kiosk-form-empty">Nenhum veículo cadastrado. Peça ao administrador para adicionar em "Cadastros".</p>
                    )}
                  </>
                ) : orderFieldType === "fornecedor" ? (
                  <div className="kiosk-form-fields">
                    <div className="kiosk-form-hint">Informe o fornecedor e a nota fiscal:</div>
                    <input
                      className="kiosk-field"
                      placeholder="Nome do fornecedor"
                      value={supplierInput}
                      onChange={(e) => { bump(); setSupplierInput(e.target.value); }}
                      autoFocus
                    />
                    <input
                      className="kiosk-field"
                      style={{ fontFamily: "var(--font-mono)" }}
                      placeholder="Número da nota fiscal"
                      value={invoiceInput}
                      onChange={(e) => { bump(); setInvoiceInput(e.target.value); }}
                    />
                    {orderError && <p className="kiosk-form-error">{orderError}</p>}
                    <div className="kiosk-form-actions">
                      <button
                        className="kiosk-btn kiosk-btn-secondary"
                        onClick={cancelOrderForm}
                        disabled={busy}
                      >
                        Cancelar
                      </button>
                      <button
                        className="kiosk-btn kiosk-btn-primary"
                        onClick={confirmSupplierStart}
                        disabled={busy}
                      >
                        {busy ? "Iniciando..." : "Iniciar atividade"}
                      </button>
                    </div>
                  </div>
                ) : orderBranch === null ? (
                  <>
                    <div className="kiosk-form-hint">Escolha o tipo:</div>
                    <div className="kiosk-branch-grid">
                      <button className="kiosk-branch-card" onClick={() => selectBranch("pedido")}>
                        <span className="kiosk-branch-icon"><IconPackage size={26} /></span>
                        <span className="kiosk-branch-name">Pedido</span>
                      </button>
                      <button className="kiosk-branch-card kiosk-branch-encaixe" onClick={() => selectBranch("encaixe")}>
                        <span className="kiosk-branch-icon"><IconZap size={26} /></span>
                        <span className="kiosk-branch-name">Encaixe</span>
                        <span className="kiosk-branch-desc">pedido urgente do comercial</span>
                      </button>
                      <button className="kiosk-branch-card" onClick={() => selectBranch("transferencia")}>
                        <span className="kiosk-branch-icon"><IconArrowLeftRight size={26} /></span>
                        <span className="kiosk-branch-name">Transferência</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="kiosk-form-fields">
                    {orderBranch === "encaixe" && (
                      <div className="kiosk-encaixe-banner">
                        Pedido urgente do comercial
                      </div>
                    )}

                    {orderBranch === "transferencia" ? (
                      <>
                        <div className="kiosk-form-row">
                          {TRANSFER_TYPES.map((t) => (
                            <button
                              key={t}
                              className={`kiosk-toggle-btn ${transferType === t ? "active" : ""}`}
                              onClick={() => { bump(); setTransferType(t); }}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                        <button
                          className={`kiosk-toggle-btn kiosk-toggle-full ${transferUrgent ? "kiosk-toggle-danger active" : ""}`}
                          onClick={() => { bump(); setTransferUrgent((v) => !v); }}
                        >
                          <IconFlag size={16} />
                          {transferUrgent ? "Urgente (clique para desmarcar)" : "Marcar como urgente"}
                        </button>
                        <input
                          className="kiosk-field"
                          style={{ fontFamily: "var(--font-mono)", letterSpacing: 3, textAlign: "center", fontSize: 22 }}
                          placeholder="4 últimos dígitos"
                          value={transferNumber}
                          maxLength={4}
                          onChange={(e) => { bump(); setTransferNumber(e.target.value.replace(/\D/g, "").slice(0, 4)); }}
                          autoFocus
                        />
                      </>
                    ) : (
                      <>
                        <input
                          className="kiosk-field"
                          style={{ fontFamily: "var(--font-mono)", letterSpacing: 3, textAlign: "center", fontSize: 22 }}
                          placeholder="4 últimos dígitos do pedido"
                          value={orderNumber}
                          maxLength={4}
                          onChange={(e) => { bump(); setOrderNumber(e.target.value.replace(/\D/g, "").slice(0, 4)); }}
                          autoFocus
                        />
                        <div className="kiosk-form-row">
                          <input
                            className="kiosk-field"
                            placeholder="Nome do cliente"
                            value={customerFirstName}
                            onChange={(e) => { bump(); setCustomerFirstName(e.target.value); }}
                          />
                          <input
                            className="kiosk-field"
                            placeholder="Sobrenome"
                            value={customerLastName}
                            onChange={(e) => { bump(); setCustomerLastName(e.target.value); }}
                          />
                        </div>
                      </>
                    )}

                    {orderError && <p className="kiosk-form-error">{orderError}</p>}

                    <div className="kiosk-form-actions">
                      <button
                        className="kiosk-btn kiosk-btn-secondary"
                        onClick={() => { bump(); setOrderBranch(null); resetOrderFields(); }}
                        disabled={busy}
                      >
                        Voltar
                      </button>
                      <button className="kiosk-btn kiosk-btn-primary" onClick={confirmOrderStart} disabled={busy}>
                        {busy ? "Iniciando..." : "Iniciar atividade"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {session && (
              <div className="kiosk-session">
                {session.is_encaixe && (
                  <div className="kiosk-session-encaixe">ENCAIXE</div>
                )}
                <div className="kiosk-session-activity">{session.activity}</div>

                {(session.order_number || session.customer_name || session.transfer_type || session.vehicle || session.supplier_name) && (
                  <div className="kiosk-session-details">
                    {session.transfer_type && (
                      <span className="kiosk-session-tag">
                        {session.transfer_type}
                        {session.transfer_number ? ` #${session.transfer_number}` : ""}
                        {session.transfer_urgent ? " · urgente" : ""}
                      </span>
                    )}
                    {session.customer_name && <span className="kiosk-session-tag">{session.customer_name}</span>}
                    {session.order_number && <span className="kiosk-session-tag">#{session.order_number}</span>}
                    {session.vehicle && <span className="kiosk-session-tag">{session.vehicle}</span>}
                    {session.plate && <span className="kiosk-session-tag">{session.plate}</span>}
                    {session.supplier_name && <span className="kiosk-session-tag">{session.supplier_name}</span>}
                    {session.invoice_number && <span className="kiosk-session-tag">NF {session.invoice_number}</span>}
                  </div>
                )}

                <div className="kiosk-session-timer">
                  <div className="kiosk-session-timer-value">
                    {fmtDuration(Math.max(0, Math.round((now - new Date(session.start_time).getTime()) / 1000) - (session.total_paused_seconds || 0)))}
                  </div>
                  <div className="kiosk-session-timer-label">
                    desde {fmtClock(session.start_time)}
                    {(session.total_paused_seconds || 0) > 0 && (
                      <> · pausado {fmtDuration(session.total_paused_seconds)}</>
                    )}
                  </div>
                </div>

                <textarea
                  className="kiosk-field kiosk-field-textarea"
                  placeholder="Observação (opcional)"
                  value={noteInput}
                  onChange={(e) => { bump(); setNoteInput(e.target.value); }}
                  rows={2}
                  disabled={paused}
                />

                {paused && (
                  <div style={{
                    padding: "12px 16px",
                    background: "var(--warning-soft)",
                    border: "1px solid var(--warning)",
                    borderRadius: 10,
                    color: "var(--warning)",
                    fontSize: 13,
                    fontWeight: 600,
                    textAlign: "center",
                    marginBottom: 12,
                  }}>
                    ⏸ Em pausa desde {fmtClock(pausedAt)}
                  </div>
                )}

                <div style={{ display: "flex", gap: 10 }}>
                  {!paused ? (
                    <>
                      <button
                        className="kiosk-btn kiosk-btn-secondary"
                        onClick={handlePause}
                        disabled={busy}
                        style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                      >
                        <IconPause size={16} /> Pausar
                      </button>
                      <button
                        className="kiosk-btn kiosk-btn-finish"
                        onClick={handleFinishClick}
                        disabled={busy}
                        style={{ flex: 2 }}
                      >
                        {busy ? "Salvando..." : "Finalizar atividade"}
                      </button>
                    </>
                  ) : (
                    <button
                      className="kiosk-btn kiosk-btn-primary"
                      onClick={handleResume}
                      disabled={busy}
                      style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                    >
                      <IconPlay size={16} /> {busy ? "..." : "Retomar atividade"}
                    </button>
                  )}
                </div>
              </div>
            )}

            {msg && (
              <p className={`kiosk-inline-msg ${msgType === "error" ? "error" : ""}`}>
                {msg}
              </p>
            )}
          </div>
        )}
      </main>

      {showFinishModal && (
        <div className="kiosk-modal-backdrop" onClick={bump}>
          <div className="kiosk-modal" ref={modalRef} onClick={(e) => e.stopPropagation()}>
            <div className="kiosk-modal-header">
              <div>
                <div className="kiosk-modal-title">Finalizar {session?.activity}</div>
                <div className="kiosk-modal-sub">
                  {loggedOperator?.name} · em andamento desde {session && fmtClock(session.start_time)}
                </div>
              </div>
              <button className="kiosk-modal-close" onClick={closeFinishModal} aria-label="Fechar">
                <IconX size={18} />
              </button>
            </div>

            <div className="kiosk-modal-body">
              <div className="kiosk-modal-section">
                <label className="kiosk-modal-label">Observação (opcional)</label>
                <textarea
                  className="kiosk-field kiosk-field-textarea"
                  placeholder="Ex: atraso por falta de material"
                  value={finishNote}
                  onChange={(e) => { bump(); setFinishNote(e.target.value); }}
                  rows={2}
                />
              </div>

              <div className="kiosk-modal-section">
                <label className="kiosk-modal-label">Houve falta de produto?</label>
                <div className="kiosk-modal-simnao">
                  <button
                    className={`kiosk-modal-choice ${finishHadShortage === false ? "ok" : ""}`}
                    onClick={() => { bump(); setFinishHadShortage(false); }}
                  >
                    Não houve falta
                  </button>
                  <button
                    className={`kiosk-modal-choice ${finishHadShortage === true ? "danger" : ""}`}
                    onClick={() => {
                      bump();
                      setFinishHadShortage(true);
                      if (shortages.length === 0) addShortageRow();
                    }}
                  >
                    Sim, houve falta
                  </button>
                </div>
              </div>

              {finishHadShortage === true && (
                <div className="kiosk-modal-section">
                  <label className="kiosk-modal-label">Faltas</label>
                  <div className="kiosk-shortage-list">
                    {shortages.map((s, i) => (
                      <div key={i} className="kiosk-shortage-row">
                        <input
                          className="kiosk-field"
                          style={{ flex: 2, fontFamily: "var(--font-mono)" }}
                          placeholder="Código do produto"
                          value={s.productCode}
                          onChange={(e) => updateShortageRow(i, "productCode", e.target.value)}
                          autoFocus={i === shortages.length - 1 && !s.productCode}
                        />
                        <input
                          className="kiosk-field"
                          style={{ flex: 1, fontFamily: "var(--font-mono)", textAlign: "center" }}
                          type="number"
                          min="1"
                          placeholder="Qtd"
                          value={s.quantity}
                          onChange={(e) => updateShortageRow(i, "quantity", e.target.value)}
                        />
                        <button
                          className="kiosk-shortage-remove"
                          onClick={() => removeShortageRow(i)}
                          title="Remover"
                        >
                          <IconTrash size={16} />
                        </button>
                      </div>
                    ))}
                    <button className="kiosk-btn kiosk-btn-secondary" onClick={addShortageRow}>
                      <IconPlus size={16} /> Adicionar outra falta
                    </button>
                  </div>
                </div>
              )}

              {finishHadShortage === null && (
                <p className="kiosk-modal-hint">Escolha uma opção para continuar</p>
              )}
            </div>

            <div className="kiosk-modal-footer">
              <button className="kiosk-btn kiosk-btn-secondary" onClick={closeFinishModal} disabled={busy}>
                Cancelar
              </button>
              <button
                className="kiosk-btn kiosk-btn-finish"
                onClick={confirmFinish}
                disabled={busy || finishHadShortage === null}
              >
                {busy ? "Salvando..." : "Confirmar finalização"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}