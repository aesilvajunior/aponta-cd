import React, { useEffect, useRef, useState } from "react";
import { fetchActiveSessionFor, saveShortages, addToConferenceQueue, undoFinishSession } from "../lib/api";
import {
  startSessionSafe,
  finishSessionSafe,
  pauseSessionSafe,
  resumeSessionSafe,
  pendingSessionFor,
  isNetworkError,
  queueShortages,
  queueConference,
  removeByEntryId,
} from "../lib/offlineSync";
import { fmtDuration, fmtClock, fmtDate, shiftFor, todayLocalISODate, localISODate } from "../lib/format";
import { getStationName, promptForStationName } from "../lib/station";
import PauseReasonModal from "./kiosk/PauseReasonModal";
import { shouldAskShortage, isSeparationEntry } from "../lib/kioskRules";
import BadgeScanner, { badgeScannerSupported } from "./kiosk/BadgeScanner";
import { playSuccess, playError, playKey } from "../utils/sound";
import { playEventSound } from "../lib/sounds";
import { fetchOperatorPrefs, saveOperatorPrefs, shouldShowWelcome, markWelcomeShown } from "../lib/operatorPrefs";
import useKeyboardNav from "../hooks/useKeyboardNav";
import { useTheme } from "../context/ThemeContext";
import ConfettiBurst from "./ConfettiBurst";
import WelcomeScreen from "./WelcomeScreen";
import KioskPrefsModal from "./KioskPrefsModal";
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
  IconSettings,
  IconStar,
} from "./Icons";

const CODE_LENGTH = 3;
const AUTO_RETURN_MS = 2200;
const UNDO_WINDOW_MS = 6000; // tempo para o botão "Desfazer" após finalizar
const IDLE_TIMEOUT_MS = 5 * 60 * 1000;
const TRANSFER_TYPES = ["AP", "ZN"];
const KIOSK_THEME_KEY = "aponta_kiosk_theme";

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

export default function Kiosk({ operators, activities, vehicles = [], entries = [], activeSessions = [], isAdmin = false, currentOperator = null, refreshEntries }) {
  const { resolvedTheme, setTheme } = useTheme();

  const [codeInput, setCodeInput] = useState("");
  const [loggedOperator, setLoggedOperator] = useState(currentOperator || null);
  const [manualSwitch, setManualSwitch] = useState(false);
  const [session, setSession] = useState(null);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState("info");
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  // O estado "busy" só atualiza no próximo render; o ref bloqueia o duplo toque
  // (dois cliques rápidos antes do React redesenhar) na hora.
  const busyRef = useRef(false);
  const lastFinishRef = useRef(null);
  const lock = () => { busyRef.current = true; setBusy(true); };
  const unlock = () => { busyRef.current = false; setBusy(false); };
  const [checkingLogin, setCheckingLogin] = useState(false);
  const [shake, setShake] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
  const [noteInput, setNoteInput] = useState("");

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

  const [showWelcome, setShowWelcome] = useState(false);
  const [prefs, setPrefs] = useState({ theme: "auto", font_scale: 1.0, favorite_activities: [] });
  const [showPrefsModal, setShowPrefsModal] = useState(false);
  const [confettiActive, setConfettiActive] = useState(false);

  const codeInputRef = useRef(codeInput);
  codeInputRef.current = codeInput;
  const lastInteractionRef = useRef(Date.now());
  const autoReturnTimeoutRef = useRef(null);
  const confettiTimeoutRef = useRef(null);
  const finishModalOpenRef = useRef(false);
  const mainContainerRef = useRef(null);
  const modalRef = useRef(null);

  useEffect(() => {
    if (!loggedOperator) return;
    if (prefs.font_scale && prefs.font_scale !== 1.0) {
      document.documentElement.style.fontSize = `${16 * prefs.font_scale}px`;
    } else {
      document.documentElement.style.fontSize = "";
    }
    return () => {
      document.documentElement.style.fontSize = "";
    };
  }, [loggedOperator, prefs]);

  function bump() {
    lastInteractionRef.current = Date.now();
  }

  function triggerConfetti() {
    if (confettiTimeoutRef.current) clearTimeout(confettiTimeoutRef.current);
    setConfettiActive(true);
    confettiTimeoutRef.current = setTimeout(() => setConfettiActive(false), 2500);
  }

  useKeyboardNav({
    containerRef: mainContainerRef,
    enabled: !showFinishModal && !showPrefsModal && !showWelcome,
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
    if (!loggedOperator || currentOperator) return;
    const iv = setInterval(() => {
      if (finishModalOpenRef.current) return;
      if (showPrefsModal) return;
      if (showWelcome) return;
      if (paused) return;
      if (Date.now() - lastInteractionRef.current > IDLE_TIMEOUT_MS) reset();
    }, 1000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedOperator, currentOperator, paused, showPrefsModal, showWelcome]);

  useEffect(() => {
    finishModalOpenRef.current = showFinishModal;
    if (showFinishModal) lastInteractionRef.current = Date.now();
  }, [showFinishModal]);

  useEffect(() => {
    return () => {
      if (autoReturnTimeoutRef.current) clearTimeout(autoReturnTimeoutRef.current);
      if (confettiTimeoutRef.current) clearTimeout(confettiTimeoutRef.current);
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

  // Auto-autentica no Kiosk com o funcionário já logado na tela inicial (sem pedir código de novo!)
  useEffect(() => {
    if (!currentOperator || manualSwitch) return undefined;
    let cancelled = false;
    setLoggedOperator(currentOperator);
    setCheckingLogin(true);
    Promise.all([
      fetchActiveSessionFor(currentOperator.code),
      fetchOperatorPrefs(currentOperator.code),
    ])
      .then(([{ data, error }, { data: prefsData }]) => {
        if (cancelled) return;
        const offlineLogin = !!error && isNetworkError(error);
        const sessionData = (offlineLogin ? null : data) || pendingSessionFor(currentOperator.code);
        setSession(sessionData || null);
        if (sessionData) {
          setPaused(!!sessionData.paused_at);
          setPausedAt(sessionData.paused_at ? new Date(sessionData.paused_at).getTime() : null);
          setTotalPausedSeconds(sessionData.total_paused_seconds || 0);
        } else {
          setPaused(false);
          setPausedAt(null);
          setTotalPausedSeconds(0);
        }
        setPrefs({
          theme: prefsData?.theme || "auto",
          font_scale: prefsData?.font_scale || 1.0,
          favorite_activities: prefsData?.favorite_activities || [],
        });
        setCheckingLogin(false);
      })
      .catch(() => {
        if (!cancelled) setCheckingLogin(false);
      });
    return () => { cancelled = true; };
  }, [currentOperator, manualSwitch]);

  function reset(forceLogout = false) {
    if (autoReturnTimeoutRef.current) clearTimeout(autoReturnTimeoutRef.current);
    setCodeInput("");
    if (forceLogout || !currentOperator) {
      setManualSwitch(true);
      setLoggedOperator(null);
      setSession(null);
    } else {
      setLoggedOperator(currentOperator);
    }
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
    setShowWelcome(false);
    setShowPrefsModal(false);
    setConfettiActive(false);
    cancelOrderForm();
    if (forceLogout) {
      try { sessionStorage.removeItem("aponta_schedule_operator"); } catch {}
    }
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

  // Crachá lido pela câmera: preenche o código e entra direto.
  function loginWithScannedCode(code) {
    setShowScanner(false);
    codeInputRef.current = code;
    setCodeInput(code);
    handleLogin();
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

    const [{ data, error }, { data: prefsData }, welcomeNeeded] = await Promise.all([
      fetchActiveSessionFor(op.code),
      fetchOperatorPrefs(op.code),
      shouldShowWelcome(op.code),
    ]);

    // Sem internet: segue com o que está guardado neste aparelho (fila offline).
    const offlineLogin = !!error && isNetworkError(error);
    if (error && !offlineLogin) {
      playError();
      setMsgType("error");
      setMsg("Erro ao verificar sessão. Tente de novo.");
      setCheckingLogin(false);
      return;
    }
    const sessionData = (offlineLogin ? null : data) || pendingSessionFor(op.code);

    playSuccess();
    playEventSound("sound_activity_start");
    setSession(sessionData || null);
    if (offlineLogin) {
      setMsgType("info");
      setMsg("Sem conexão. Seus apontamentos ficam salvos neste aparelho e serão enviados quando a internet voltar.");
    }
    if (sessionData) {
      setPaused(!!sessionData.paused_at);
      setPausedAt(sessionData.paused_at ? new Date(sessionData.paused_at).getTime() : null);
      setTotalPausedSeconds(sessionData.total_paused_seconds || 0);
    } else {
      setPaused(false);
      setPausedAt(null);
      setTotalPausedSeconds(0);
    }
    setPrefs({
      theme: prefsData?.theme || "auto",
      font_scale: Number(prefsData?.font_scale) || 1.0,
      favorite_activities: prefsData?.favorite_activities || [],
    });
    setLoggedOperator(op);

    // NOVO: salva operador logado no sessionStorage (para a Rotina do Líder)
    try {
      sessionStorage.setItem(
        "aponta_schedule_operator",
        JSON.stringify({ code: op.code, name: op.name, role: op.role })
      );
    } catch {}

    setCheckingLogin(false);

    if (welcomeNeeded) {
      setShowWelcome(true);
    }
  }

  function handleWelcomeContinue() {
    if (loggedOperator) markWelcomeShown(loggedOperator.code);
    setShowWelcome(false);
  }

  function handlePrefsSaved(newPrefs) {
    setPrefs(newPrefs);
  }

  async function startActivity(activityName, extra = {}) {
    if (busy || busyRef.current) return;
    bump();
    lock();
    const startedAt = new Date().toISOString();
    const { error, data: startedData, queued } = await startSessionSafe({
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
    unlock();

    if (!error) {
      playSuccess();
      playEventSound("sound_activity_start");
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
        queued: !!queued,
      });
      void startedData;
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

  // Tocar em "Pausar" abre a pergunta do motivo; a pausa acontece ao escolher.
  function handlePause() {
    if (!session || busy || busyRef.current) return;
    bump();
    setShowPauseModal(true);
  }

  async function confirmPause(reason) {
    if (!session || busyRef.current) return;
    bump();
    lock();
    const { pausedAt: nowIso, error: err, queued } = await pauseSessionSafe({
      session,
      reason,
      station: stationName || null,
    });
    unlock();
    setShowPauseModal(false);
    if (err) {
      playError();
      setMsgType("error");
      setMsg(`Erro ao pausar. ${err.message}`);
      return;
    }
    if (queued) {
      setMsgType("info");
      setMsg("Sem conexão: a pausa foi guardada e será enviada quando a internet voltar.");
    }
    setPaused(true);
    setPausedAt(new Date(nowIso).getTime());
    setSession((s) => s ? { ...s, paused_at: nowIso } : s);
  }

  async function handleResume() {
    if (!session || busy || busyRef.current || !pausedAt) return;
    bump();
    lock();
    const addedPause = Math.round((Date.now() - pausedAt) / 1000);
    const newTotal = (session.total_paused_seconds || 0) + addedPause;
    const { error: err, queued } = await resumeSessionSafe({ session, addedPause, newTotal });
    unlock();
    if (err) {
      playError();
      setMsgType("error");
      setMsg(`Erro ao retomar. ${err.message}`);
      return;
    }
    if (queued) {
      setMsgType("info");
      setMsg("Sem conexão: o retorno foi guardado e será enviado quando a internet voltar.");
    }
    playSuccess();
    setPaused(false);
    setPausedAt(null);
    setTotalPausedSeconds(newTotal);
    setSession((s) => s ? { ...s, paused_at: null, total_paused_seconds: newTotal } : s);
  }

  function didHitGoal(durationSec) {
    if (!session) return false;
    const cfg = activities.find((a) => a.name === session.activity);
    if (!cfg?.target_seconds) return false;
    return durationSec <= cfg.target_seconds;
  }

  async function addConferenceSafe(entry) {
    const { error } = await addToConferenceQueue(entry);
    if (error && isNetworkError(error)) queueConference(entry);
  }

  function rememberFinish({ entryId, queued }) {
    lastFinishRef.current = { entryId, queued: !!queued, sessionRow: session };
  }

  async function finishDirectly() {
    if (!session || busy || busyRef.current) return;
    bump();
    lock();
    const pausedSecs = session.total_paused_seconds || 0;
    const duration = Math.max(0, Math.round((Date.now() - new Date(session.start_time).getTime()) / 1000) - pausedSecs);
    const hitGoal = didHitGoal(duration);
    const { data: newEntry, entryId, error, queued } = await finishSessionSafe({
      session,
      durationSeconds: duration,
      shift: shiftFor(session.start_time),
      note: noteInput.trim(),
      isEncaixe: !!session.is_encaixe,
      pausedSeconds: pausedSecs,
      shortages: [],
      separation: isSeparationEntry(session),
    });
    unlock();
    if (!error) {
      playSuccess();
      playEventSound("sound_activity_finish");
      if (hitGoal) {
        playEventSound("sound_goal_hit");
        triggerConfetti();
      }
      if (!queued && newEntry && isSeparationEntry(newEntry)) {
        await addConferenceSafe(newEntry);
      }
      rememberFinish({ entryId, queued });
      refreshEntries?.();
      setSession(null);
      setNoteInput("");
      setPaused(false);
      setPausedAt(null);
      setTotalPausedSeconds(0);
      setConfirmation({ kind: "finished", activity: session.activity, extra: fmtDuration(duration), queued: !!queued, canUndo: true });
      autoReturnTimeoutRef.current = setTimeout(reset, UNDO_WINDOW_MS);
    } else {
      playError();
      setMsgType("error");
      setMsg(`Erro ao salvar. ${error.message || "Tente novamente."}`);
    }
  }

  async function handleUndo() {
    const last = lastFinishRef.current;
    if (!last || busyRef.current) return;
    if (autoReturnTimeoutRef.current) clearTimeout(autoReturnTimeoutRef.current);
    lock();
    let undoError = null;
    if (last.queued) {
      removeByEntryId(last.entryId); // ainda não chegou ao banco: só tira da fila
    } else {
      const res = await undoFinishSession({ entryId: last.entryId, sessionRow: last.sessionRow });
      undoError = res.error;
    }
    unlock();
    if (undoError) {
      playError();
      setMsgType("error");
      setMsg(`Não foi possível desfazer. ${undoError.message || ""}`.trim());
      setConfirmation((c) => (c ? { ...c, canUndo: false } : c));
      autoReturnTimeoutRef.current = setTimeout(reset, AUTO_RETURN_MS);
      return;
    }
    lastFinishRef.current = null;
    const restored = last.sessionRow;
    setSession(restored);
    setPaused(!!restored.paused_at);
    setPausedAt(restored.paused_at ? new Date(restored.paused_at).getTime() : null);
    setTotalPausedSeconds(restored.total_paused_seconds || 0);
    setConfirmation(null);
    setMsgType("info");
    setMsg("Finalização desfeita. A atividade voltou para em andamento.");
    refreshEntries?.();
    bump();
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
    if (busy || busyRef.current) return;
    if (finishHadShortage === null) return;
    if (finishHadShortage === true) {
      const valid = shortages.filter((s) => s.productCode.trim().length > 0);
      if (valid.length === 0) {
        setMsgType("error");
        setMsg("Adicione pelo menos uma falta com código do produto.");
        return;
      }
    }

    lock();
    const pausedSecs = session.total_paused_seconds || 0;
    const duration = Math.max(0, Math.round((Date.now() - new Date(session.start_time).getTime()) / 1000) - pausedSecs);
    const shift = shiftFor(session.start_time);
    const finalNote = finishNote.trim();
    const hitGoal = didHitGoal(duration);

    const validShortages = finishHadShortage === true
      ? shortages
          .filter((s) => s.productCode.trim().length > 0)
          .map((s) => ({
            productCode: s.productCode.trim(),
            quantity: Number(s.quantity) || 1,
            supplierName: session.supplier_name || null,
          }))
      : [];

    const { data: newEntry, entryId, error, queued } = await finishSessionSafe({
      session,
      durationSeconds: duration,
      shift,
      note: finalNote,
      isEncaixe: !!session.is_encaixe,
      pausedSeconds: pausedSecs,
      shortages: validShortages,
      separation: isSeparationEntry(session),
    });

    if (error) {
      unlock();
      playError();
      setMsgType("error");
      setMsg(`Erro ao finalizar. ${error.message || "Tente novamente."}`);
      return;
    }

    if (!queued && validShortages.length > 0) {
      const { error: errShortage } = await saveShortages(newEntry.id, validShortages);
      if (errShortage && isNetworkError(errShortage)) {
        queueShortages(newEntry.id, session.operator_code, validShortages);
      } else if (errShortage) {
        unlock();
        playError();
        setMsgType("error");
        setMsg(`Atividade salva, mas houve erro ao salvar faltas: ${errShortage.message}`);
        setSession(null);
        setNoteInput("");
        refreshEntries?.();
        return;
      }
      playEventSound("sound_shortage");
    } else if (queued && validShortages.length > 0) {
      playEventSound("sound_shortage");
    }

    if (!queued && newEntry && isSeparationEntry(newEntry)) {
      await addConferenceSafe(newEntry);
    }

    rememberFinish({ entryId, queued });
    unlock();
    playSuccess();
    playEventSound("sound_activity_finish");
    if (hitGoal) {
      playEventSound("sound_goal_hit");
      triggerConfetti();
    }
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
      queued: !!queued,
      canUndo: true,
    });
    closeFinishModal();
    autoReturnTimeoutRef.current = setTimeout(reset, UNDO_WINDOW_MS);
  }

  function editStation() {
    setStationNameState(promptForStationName());
  }

  const orderedActivities = (() => {
    if (!prefs.favorite_activities || prefs.favorite_activities.length === 0) return activities;
    const fav = new Set(prefs.favorite_activities);
    const favList = activities.filter((a) => fav.has(a.name));
    const rest = activities.filter((a) => !fav.has(a.name));
    return [...favList, ...rest];
  })();

  // Se já existe sessão ativa em activeSessions para o operador logado, sincroniza imediatamente no estado session
  const liveActiveForLogged = loggedOperator
    ? (activeSessions || []).find((s) => String(s.operator_code) === String(loggedOperator.code)) || null
    : null;
  const effectiveSession = session || liveActiveForLogged;

  useEffect(() => {
    if (!session && liveActiveForLogged) {
      setSession(liveActiveForLogged);
      setPaused(!!liveActiveForLogged.paused_at);
      setPausedAt(liveActiveForLogged.paused_at ? new Date(liveActiveForLogged.paused_at).getTime() : null);
      setTotalPausedSeconds(liveActiveForLogged.total_paused_seconds || 0);
    }
  }, [session, liveActiveForLogged]);

  const myTodayEntries = (() => {
    if (!loggedOperator || !Array.isArray(entries)) return [];
    const today = todayLocalISODate();
    return entries
      .filter((e) => String(e.operator_code) === String(loggedOperator.code) && localISODate(e.start_time) === today)
      .sort((a, b) => new Date(b.start_time) - new Date(a.start_time));
  })();

  const myTodayTotalSec = myTodayEntries.reduce((s, e) => s + (e.duration_seconds || 0), 0);
  const myTodayAvgSec = myTodayEntries.length > 0 ? Math.round(myTodayTotalSec / myTodayEntries.length) : 0;

  const dots = Array.from({ length: CODE_LENGTH }, (_, i) => i < codeInput.length);

  return (
    <div className="kiosk-page" ref={mainContainerRef}>
      <ConfettiBurst active={confettiActive} />

      {showWelcome && loggedOperator && (
        <WelcomeScreen
          operator={loggedOperator}
          onContinue={handleWelcomeContinue}
        />
      )}

      {showPrefsModal && loggedOperator && (
        <KioskPrefsModal
          operator={loggedOperator}
          activities={activities}
          onClose={() => setShowPrefsModal(false)}
          onSaved={handlePrefsSaved}
        />
      )}

      <header className="kiosk-header">
        <div className="kiosk-header-left">
          <div>
            <div className="kiosk-header-title">Apontamento de Atividade</div>
            <div className="kiosk-header-sub">Inicie, pause ou finalize sua atividade no turno</div>
          </div>
        </div>

        <div className="kiosk-header-right">
          <div className="kiosk-header-clock">
            <div className="kiosk-header-time">{fmtClock(now)}</div>
          </div>
          <button
            className={`kiosk-header-station ${!stationName ? "kiosk-header-station-alert" : ""}`}
            onClick={editStation}
            title="Clique para nomear esta estação/terminal"
          >
            <IconMapPin size={14} />
            {stationName || "Nomear estação"}
          </button>
          {loggedOperator && (
            <button
              className="kiosk-header-station"
              onClick={() => setShowPrefsModal(true)}
              title="Minhas preferências"
            >
              <IconSettings size={14} />
            </button>
          )}
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
            {badgeScannerSupported() && (
              <button
                type="button"
                className="kiosk-btn kiosk-btn-secondary kiosk-scan-btn"
                onClick={() => { bump(); setShowScanner(true); }}
                disabled={checkingLogin}
              >
                Escanear crachá
              </button>
            )}
            {msg ? (
              <p className="kiosk-terminal-error" role="alert">{msg}</p>
            ) : (
              <p className="kiosk-terminal-hint">teclado do computador também funciona</p>
            )}
          </div>
        )}

        {loggedOperator && confirmation && (
          <div className="kiosk-confirm" role="status" aria-live="polite">
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
            {confirmation.queued && (
              <div className="kiosk-confirm-sub kiosk-confirm-offline">
                Sem conexão: salvo neste aparelho e será enviado automaticamente.
              </div>
            )}
            {confirmation.kind === "finished" && confirmation.canUndo && (
              <button
                type="button"
                className="kiosk-btn kiosk-btn-secondary kiosk-undo-btn"
                onClick={handleUndo}
                disabled={busy}
              >
                Desfazer
              </button>
            )}
          </div>
        )}

        {loggedOperator && !confirmation && !showWelcome && (
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
              {isAdmin && (
                <button className="kiosk-operator-change" onClick={() => reset(true)}>
                  Trocar operador
                </button>
              )}
            </div>

            {effectiveSession && !session && (
              <div className="alert-card alert-warning" style={{ marginBottom: 16 }}>
                <strong>Atividade em andamento: {effectiveSession.activity}.</strong>{" "}
                Finalize a atividade atual antes de iniciar outra.
              </div>
            )}

            {/* Painel Pessoal do Turno (ocupa o centro de forma útil no lugar do teclado numérico) */}
            <div className="kiosk-personal-strip">
              <div className="kiosk-personal-card">
                <span className="kiosk-personal-lbl">Minhas atividades hoje</span>
                <strong className="kiosk-personal-val">{myTodayEntries.length}</strong>
              </div>
              <div className="kiosk-personal-card">
                <span className="kiosk-personal-lbl">Tempo produtivo hoje</span>
                <strong className="kiosk-personal-val">{fmtDuration(myTodayTotalSec)}</strong>
              </div>
              <div className="kiosk-personal-card">
                <span className="kiosk-personal-lbl">Média por atividade</span>
                <strong className="kiosk-personal-val">{myTodayAvgSec > 0 ? fmtDuration(myTodayAvgSec) : "—"}</strong>
              </div>
              <div className="kiosk-personal-card">
                <span className="kiosk-personal-lbl">Status atual</span>
                <strong className="kiosk-personal-val" style={{ color: session ? (paused ? "var(--warning)" : "var(--ok)") : "var(--accent)" }}>
                  {session ? (paused ? "Em pausa" : "Em atividade") : "Disponível"}
                </strong>
              </div>
            </div>

            {(!effectiveSession || isAdmin) && !session && activities.length > 0 && !orderFormActivity && (
              <div className="kiosk-activities">
                <div className="kiosk-section-title">Iniciar atividade em 1 clique</div>
                <div className="kiosk-activities-grid">
                  {orderedActivities.map((a) => {
                    const isFav = prefs.favorite_activities?.includes(a.name);
                    return (
                      <button
                        key={a.name}
                        className="kiosk-activity-card"
                        onClick={() => handleActivityClick(a)}
                        disabled={busy}
                        style={isFav ? { borderColor: "var(--accent)" } : undefined}
                      >
                        <span className="kiosk-activity-icon">{activityIcon(a.name)}</span>
                        <span className="kiosk-activity-name">{a.name}</span>
                        {isFav && (
                          <span style={{ position: "absolute", top: 8, right: 8, color: "var(--accent)" }}>
                            <IconStar size={14} />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {myTodayEntries.length > 0 && (
                  <div className="kiosk-recent-box">
                    <div className="kiosk-section-title" style={{ marginBottom: 10 }}>
                      Meus lançamentos de hoje ({myTodayEntries.length})
                    </div>
                    <div className="kiosk-recent-list">
                      {myTodayEntries.slice(0, 6).map((item) => (
                        <div key={item.id} className="kiosk-recent-row">
                          <span className="kiosk-recent-time">{fmtClock(item.start_time).slice(0, 5)}</span>
                          <span className="kiosk-recent-act">{item.activity}</span>
                          {item.order_number && <span className="kiosk-recent-tag">#{item.order_number}</span>}
                          <span className="kiosk-recent-dur">{fmtDuration(item.duration_seconds || 0)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    width: "100%",
                  }}>
                    <IconPause size={14} /> Em pausa desde {fmtClock(pausedAt)}
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
              <p className={`kiosk-inline-msg ${msgType === "error" ? "error" : ""}`} role={msgType === "error" ? "alert" : "status"}>
                {msg}
              </p>
            )}
          </div>
        )}
      </main>

      {showScanner && (
        <BadgeScanner onCode={loginWithScannedCode} onClose={() => setShowScanner(false)} codeLength={CODE_LENGTH} />
      )}

      {showPauseModal && (
        <PauseReasonModal busy={busy} onChoose={confirmPause} onCancel={() => setShowPauseModal(false)} />
      )}

      {showFinishModal && (
        <div className="kiosk-modal-backdrop" onClick={bump}>
          <div className="kiosk-modal" ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="kiosk-finish-title" onClick={(e) => e.stopPropagation()}>
            <div className="kiosk-modal-header">
              <div>
                <div className="kiosk-modal-title" id="kiosk-finish-title">Finalizar {session?.activity}</div>
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