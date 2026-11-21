import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  fetchConferenceQueue,
  fetchConferenceHistory,
  startConference,
  finishConference,
  reportConferenceProblem,
  computeConferenceStats,
  waitingSeconds,
} from "../lib/conference";
import {
  updateConferenceItem,
  deleteConferenceItem,
  resetConferenceItem,
  logAudit,
} from "../lib/api";
import { fetchMapAreas, fetchMapItems } from "../lib/stockMap";
import { buildCyclicTaskFromConference, createCyclicCountTask } from "../lib/cyclicInventory";
import { fmtClock, fmtDate, fmtDuration, todayLocalISODate, localISODate } from "../lib/format";
import { supabase } from "../supabaseClient";
import useKeyboardNav from "../hooks/useKeyboardNav";
import {
  IconPackage,
  IconZap,
  IconArrowLeftRight,
  IconFlag,
  IconUser,
  IconCheck,
  IconAlertTriangle,
  IconClock,
  IconEdit,
  IconTrash,
  IconRefresh,
  IconRotateCcw,
  IconX,
  IconDelete,
} from "./Icons";

const CODE_LENGTH = 3;
const AUTO_RETURN_MS = 3000;

const CONFERENCE_STATUS = [
  { value: "aguardando", label: "Aguardando" },
  { value: "em_conferencia", label: "Em conferência" },
  { value: "conferido", label: "Conferido" },
  { value: "com_problema", label: "Com problema" },
];

function waitingColor(seconds) {
  if (seconds < 5 * 60) return "var(--ok)";
  if (seconds < 15 * 60) return "var(--warning)";
  return "var(--danger)";
}

function waitingLabel(seconds) {
  if (seconds < 60) return `${seconds}s`;
  const min = Math.floor(seconds / 60);
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

export default function ConferenceTable({ operators, isAdmin = false, currentOperator = null, activeSessions = [] }) {
  const [queue, setQueue] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());

  const [loggedOperator, setLoggedOperator] = useState(currentOperator || null);
  const [manualSwitch, setManualSwitch] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [loginError, setLoginError] = useState("");
  const [checkingLogin, setCheckingLogin] = useState(false);

  useEffect(() => {
    if (currentOperator && !manualSwitch) {
      setLoggedOperator(currentOperator);
    }
  }, [currentOperator, manualSwitch]);

  const [finishModal, setFinishModal] = useState(null);
  const [problemModal, setProblemModal] = useState(null);
  const [adminEdit, setAdminEdit] = useState(null);
  const [problemReason, setProblemReason] = useState("");
  const [problemNote, setProblemNote] = useState("");
  const [finishNote, setFinishNote] = useState("");
  const [busy, setBusy] = useState(false);

  const [confirmation, setConfirmation] = useState(null);

  const codeInputRef = useRef(codeInput);
  codeInputRef.current = codeInput;
  const mainContainerRef = useRef(null);
  const modalRef = useRef(null);
  const autoReturnRef = useRef(null);

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  useKeyboardNav({
    containerRef: mainContainerRef,
    enabled: !finishModal && !problemModal && !adminEdit,
    onEscape: () => {
      if (loginError) setLoginError("");
    },
  });

  useKeyboardNav({
    containerRef: modalRef,
    enabled: !!(finishModal || problemModal || adminEdit),
    onEscape: () => {
      if (busy) return;
      setFinishModal(null);
      setProblemModal(null);
      setAdminEdit(null);
    },
  });

  async function load() {
    if (!loggedOperator) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const [{ data: q, error: e1 }, { data: h, error: e2 }] = await Promise.all([
      fetchConferenceQueue(),
      fetchConferenceHistory({ limit: 100 }),
    ]);
    if (e1 || e2) {
      setError((e1 || e2).message);
      setLoading(false);
      return;
    }
    setQueue(q || []);
    setHistory(h || []);
    setError("");
    setLoading(false);
  }

  useEffect(() => {
    if (loggedOperator) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedOperator]);

  useEffect(() => {
    if (!loggedOperator) return;
    const ch = supabase
      .channel("conference-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "conference_queue" }, load)
      .subscribe();
    return () => supabase.removeChannel(ch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedOperator]);

  useEffect(() => {
    return () => {
      if (autoReturnRef.current) clearTimeout(autoReturnRef.current);
    };
  }, []);

  function handleDigit(d) {
    if (codeInputRef.current.length < CODE_LENGTH) setCodeInput(codeInputRef.current + d);
  }
  function handleBackspace() {
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
    if (!op.can_conference) {
      setLoginError("Você não está cadastrado como conferente. Fale com o administrador.");
      setCodeInput("");
      setCheckingLogin(false);
      return;
    }
    setLoggedOperator(op);
    setCodeInput("");
    setLoginError("");
    setCheckingLogin(false);
  }
  function logout() {
    setManualSwitch(true);
    setLoggedOperator(null);
    setCodeInput("");
    setLoginError("");
    setQueue([]);
    setHistory([]);
  }

  useEffect(() => {
    if (loggedOperator) return;
    if (finishModal || problemModal || adminEdit) return;
    function onKeyDown(e) {
      const tag = (e.target && e.target.tagName) || "";
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key >= "0" && e.key <= "9") {
        setCodeInput((prev) => (prev.length < CODE_LENGTH ? prev + e.key : prev));
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
  }, [loggedOperator, finishModal, problemModal, adminEdit]);

  const stats = useMemo(() => computeConferenceStats(queue, history), [queue, history]);

  const waiting = useMemo(
    () => queue.filter((q) => q.status === "aguardando").sort((a, b) => new Date(a.separated_at) - new Date(b.separated_at)),
    [queue]
  );
  const inProgress = useMemo(
    () => queue.filter((q) => q.status === "em_conferencia"),
    [queue]
  );

  const historyToday = useMemo(() => {
    const today = todayLocalISODate();
    return history.filter((h) => h.conference_finished_at && localISODate(h.conference_finished_at) === today).slice(0, 30);
  }, [history]);

  async function handleAssume(item) {
    if (busy) return;
    if (!loggedOperator) return;
    if (!isAdmin) {
      const hasKioskActivity = (activeSessions || []).some(
        (s) => String(s.operator_code || "") === String(loggedOperator.code)
      );
      const hasActiveConf = inProgress.some(
        (q) => String(q.conference_started_by_code || q.conference_operator_code || "") === String(loggedOperator.code)
      );
      if (hasKioskActivity || hasActiveConf) {
        setError("Você já possui uma atividade ou conferência em andamento. Finalize a atual antes de iniciar outra.");
        return;
      }
    }
    setBusy(true);
    const { error: err } = await startConference(item.id, loggedOperator);
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    await load();
  }

  function openFinish(item) { setFinishModal(item); setFinishNote(""); }
  function openProblem(item) { setProblemModal(item); setProblemReason(""); setProblemNote(""); }
  function openAdminEdit(item) { setAdminEdit({ ...item }); }

  async function confirmFinish() {
    if (!finishModal || busy) return;
    setBusy(true);
    const { error: err } = await finishConference(finishModal.id, loggedOperator, finishNote.trim());
    setBusy(false);
    if (err) { setError(err.message); return; }
    setFinishModal(null);
    setFinishNote("");
    setConfirmation({ kind: "conferido", order: finishModal.order_number || finishModal.transfer_number });
    autoReturnRef.current = setTimeout(() => setConfirmation(null), AUTO_RETURN_MS);
    await load();
  }

  async function confirmProblem() {
    if (!problemModal || busy) return;
    if (!problemReason.trim()) return;
    setBusy(true);
    const { error: err } = await reportConferenceProblem(problemModal.id, loggedOperator, problemReason.trim(), problemNote.trim());
    setBusy(false);
    if (err) { setError(err.message); return; }

    // Gatilho automático de inventário cíclico (contagem cega) ao registrar divergência na conferência
    let cyclicArea = null;
    try {
      const [{ data: areas }, { data: items }] = await Promise.all([fetchMapAreas(), fetchMapItems()]);
      const taskPayload = buildCyclicTaskFromConference({
        conferenceItem: problemModal,
        reason: problemReason.trim(),
        note: problemNote.trim(),
        areas: areas || [],
        items: items || [],
      });
      const res = await createCyclicCountTask(taskPayload);
      if (res.data) cyclicArea = res.data.area_code;
    } catch {
      /* melhor esforço */
    }

    setProblemModal(null);
    setProblemReason("");
    setProblemNote("");
    setConfirmation({
      kind: "problema",
      order: problemModal.order_number || problemModal.transfer_number,
      cyclicArea,
    });
    autoReturnRef.current = setTimeout(() => setConfirmation(null), AUTO_RETURN_MS);
    await load();
  }

  async function saveAdminEdit() {
    if (!adminEdit || busy) return;
    setBusy(true);
    const fields = {
      order_number: adminEdit.order_number || null,
      customer_name: adminEdit.customer_name || null,
      transfer_type: adminEdit.transfer_type || null,
      transfer_number: adminEdit.transfer_number || null,
      transfer_urgent: adminEdit.transfer_urgent ?? null,
      is_encaixe: !!adminEdit.is_encaixe,
      status: adminEdit.status,
      problem_reason: adminEdit.problem_reason || null,
      note: adminEdit.note || null,
    };
    const { error: err } = await updateConferenceItem(adminEdit.id, fields);
    setBusy(false);
    if (err) { setError(err.message); return; }
    try {
      await logAudit({
        actorCode: loggedOperator?.code || "admin",
        actorName: loggedOperator?.name || "Admin",
        action: "editar",
        entity: "conference",
        entityId: String(adminEdit.id),
        details: "Item da mesa editado (ConferenceTable admin)",
        beforeData: null,
        afterData: fields,
      });
    } catch {}
    setAdminEdit(null);
    await load();
  }

  async function adminDelete(item) {
    const label = item.transfer_type
      ? `transferência ${item.transfer_type} #${item.transfer_number}`
      : item.order_number
      ? `pedido #${item.order_number}`
      : "este item";
    if (!window.confirm(`Remover ${label} da mesa?`)) return;
    const { error: err } = await deleteConferenceItem(item.id);
    if (err) { setError(err.message); return; }
    try {
      await logAudit({
        actorCode: loggedOperator?.code || "admin",
        actorName: loggedOperator?.name || "Admin",
        action: "remover",
        entity: "conference",
        entityId: String(item.id),
        details: "Item removido da mesa",
        beforeData: item,
      });
    } catch {}
    await load();
  }

  async function adminReset(item) {
    if (!window.confirm("Voltar este item para 'Aguardando'?")) return;
    const { error: err } = await resetConferenceItem(item.id);
    if (err) { setError(err.message); return; }
    try {
      await logAudit({
        actorCode: loggedOperator?.code || "admin",
        actorName: loggedOperator?.name || "Admin",
        action: "editar",
        entity: "conference",
        entityId: String(item.id),
        details: "Item resetado para 'aguardando'",
        beforeData: item,
        afterData: { status: "aguardando" },
      });
    } catch {}
    await load();
  }

  const dots = Array.from({ length: CODE_LENGTH }, (_, i) => i < codeInput.length);

  if (!loggedOperator) {
    return (
      <div ref={mainContainerRef}>
        <div className="page-header-row" style={{ marginBottom: 22 }}>
          <div>
            <h1 className="page-title">Conferência</h1>
            <p className="page-sub" style={{ marginBottom: 0 }}>
              Digite seu código de conferente para acessar
            </p>
          </div>
        </div>

        <div className="schedule-login-wrap">
          <div className="schedule-login-card">
            <div className="schedule-login-title">Digite seu código</div>
            <div className="schedule-login-dots">
              {dots.map((filled, i) => (
                <div key={i} className={`kiosk-dot ${filled ? "filled" : ""}`} />
              ))}
            </div>
            <div className="kiosk-keypad" style={{ opacity: checkingLogin ? 0.55 : 1, pointerEvents: checkingLogin ? "none" : "auto" }}>
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
                <button key={d} className="kiosk-key" onClick={() => handleDigit(d)}>{d}</button>
              ))}
              <button className="kiosk-key kiosk-key-muted" onClick={handleBackspace} aria-label="Apagar">
                <IconDelete size={20} />
              </button>
              <button className="kiosk-key" onClick={() => handleDigit("0")}>0</button>
              <button className="kiosk-key kiosk-key-primary" onClick={handleLogin}>{checkingLogin ? "..." : "OK"}</button>
            </div>
            {loginError ? (
              <p className="kiosk-terminal-error">{loginError}</p>
            ) : (
              <p className="kiosk-terminal-hint">só conferentes cadastrados</p>
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
          <h1 className="page-title">Conferência</h1>
          <p className="page-sub" style={{ marginBottom: 0 }}>
            {stats.waiting} aguardando · {stats.inProgress} em conferência · {stats.todayFinished} conferidos hoje
            <span style={{ marginLeft: 8, color: "var(--accent)", fontWeight: 600 }}>
              · {loggedOperator.name} #{loggedOperator.code}
            </span>
            {isAdmin && <span style={{ marginLeft: 8, color: "var(--danger)", fontWeight: 600 }}>· modo admin</span>}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn-small" onClick={load}>
            <IconRefresh size={14} /> Atualizar
          </button>
          {!currentOperator && (
            <button className="btn-small" onClick={logout}>Sair</button>
          )}
        </div>
      </div>

      {error && (
        <div className="alert-card alert-danger" style={{ marginBottom: 20 }}>
          Erro: <code>{error}</code>
          <button className="btn-small" style={{ marginLeft: 12 }} onClick={() => setError("")}>Fechar</button>
        </div>
      )}

      {confirmation && (
        <div className="kiosk-confirm" style={{ marginBottom: 20, maxWidth: "100%" }}>
          <div
            className="kiosk-confirm-icon"
            style={{
              background: confirmation.kind === "conferido" ? "var(--ok-soft)" : "var(--danger-soft)",
              color: confirmation.kind === "conferido" ? "var(--ok)" : "var(--danger)",
            }}
          >
            {confirmation.kind === "conferido" ? <IconCheck size={30} /> : <IconAlertTriangle size={30} />}
          </div>
          <div className="kiosk-confirm-title">
            {confirmation.kind === "conferido" ? "Conferência finalizada" : "Problema reportado"}
          </div>
          <div className="kiosk-confirm-sub">
            {confirmation.order ? `Pedido ${confirmation.order}` : "Item"}
            {confirmation.cyclicArea && ` · Contagem cega gerada automaticamente (${confirmation.cyclicArea})`}
          </div>
        </div>
      )}

      <div className="stat-strip" style={{ marginBottom: 20 }}>
        <div className="stat-cell">
          <div className="stat-num accent">{stats.waiting}</div>
          <div className="stat-label">Aguardando</div>
        </div>
        <div className="stat-cell">
          <div className="stat-num">{stats.inProgress}</div>
          <div className="stat-label">Em conferência</div>
        </div>
        <div className="stat-cell">
          <div className="stat-num" style={{ color: "var(--ok)" }}>{stats.finishedOk}</div>
          <div className="stat-label">Conferidos hoje</div>
        </div>
        <div className="stat-cell">
          <div className="stat-num danger">{stats.finishedProblem}</div>
          <div className="stat-label">Com problema hoje</div>
        </div>
        <div className="stat-cell">
          <div className="stat-num">{fmtDuration(stats.avgDuration)}</div>
          <div className="stat-label">Tempo médio</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">Aguardando conferência ({waiting.length})</div>
        {loading ? (
          <div className="schedule-empty">Carregando...</div>
        ) : waiting.length === 0 ? (
          <div className="schedule-empty">
            <div className="schedule-empty-icon"><IconCheck size={36} /></div>
            <div>Nenhum pedido aguardando. Mesa limpa.</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {waiting.map((item) => {
              const seconds = waitingSeconds(item, now);
              const color = waitingColor(seconds);
              return (
                <div
                  key={item.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    padding: "16px 18px",
                    background: "var(--surface-raised)",
                    border: `1px solid var(--border)`,
                    borderLeft: `4px solid ${color}`,
                    borderRadius: 12,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      {item.is_encaixe && (
                        <span style={{ background: "var(--accent-2-soft)", color: "var(--accent-2)", padding: "3px 9px", borderRadius: 5, fontSize: 11, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <IconZap size={11} /> ENCAIXE
                        </span>
                      )}
                      {item.transfer_type && (
                        <span style={{ background: "var(--accent-soft)", color: "var(--accent)", padding: "3px 9px", borderRadius: 5, fontSize: 11, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <IconArrowLeftRight size={11} /> {item.transfer_type}{item.transfer_number && ` #${item.transfer_number}`}
                        </span>
                      )}
                      {item.transfer_urgent && (
                        <span style={{ background: "var(--danger-soft)", color: "var(--danger)", padding: "3px 9px", borderRadius: 5, fontSize: 11, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <IconFlag size={11} /> URGENTE
                        </span>
                      )}
                      {item.order_number && !item.transfer_type && (
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 16, fontWeight: 700, color: "var(--text)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <IconPackage size={14} /> #{item.order_number}
                        </span>
                      )}
                    </div>
                    {item.customer_name && (
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text)", marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
                        <IconUser size={13} /> {item.customer_name}
                      </div>
                    )}
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>
                      Separado por <strong>{item.separated_by_name}</strong> às {fmtClock(item.separated_at)} · esperando há{" "}
                      <span style={{ color, fontWeight: 700 }}>{waitingLabel(seconds)}</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <button className="btn-small btn-excel" onClick={() => handleAssume(item)} disabled={busy} style={{ padding: "10px 16px", fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}>
                      Assumir
                    </button>
                    {isAdmin && (
                      <>
                        <button className="btn-small" style={{ padding: "10px 12px" }} onClick={() => openAdminEdit(item)} title="Editar">
                          <IconEdit size={14} />
                        </button>
                        <button className="btn-small" style={{ padding: "10px 12px", color: "var(--danger)", borderColor: "var(--danger)" }} onClick={() => adminDelete(item)} title="Excluir">
                          <IconTrash size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">Em conferência ({inProgress.length})</div>
        {inProgress.length === 0 ? (
          <div className="schedule-empty" style={{ padding: "20px 0" }}>
            <div style={{ fontSize: 13 }}>Nenhum pedido em conferência agora.</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {inProgress.map((item) => {
              const mine = item.conference_started_by_code === loggedOperator.code;
              const elapsed = item.conference_started_at
                ? Math.round((now - new Date(item.conference_started_at).getTime()) / 1000)
                : 0;
              return (
                <div
                  key={item.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    padding: "16px 18px",
                    background: mine ? "var(--accent-soft)" : "var(--surface-raised)",
                    border: `1px solid ${mine ? "var(--accent)" : "var(--border)"}`,
                    borderLeft: `4px solid ${mine ? "var(--accent)" : "var(--warning)"}`,
                    borderRadius: 12,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      {item.is_encaixe && (
                        <span style={{ background: "var(--accent-2-soft)", color: "var(--accent-2)", padding: "3px 9px", borderRadius: 5, fontSize: 11, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <IconZap size={11} /> ENCAIXE
                        </span>
                      )}
                      {item.transfer_type && (
                        <span style={{ background: "var(--accent-soft)", color: "var(--accent)", padding: "3px 9px", borderRadius: 5, fontSize: 11, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <IconArrowLeftRight size={11} /> {item.transfer_type} {item.transfer_number && `#${item.transfer_number}`}
                        </span>
                      )}
                      {item.order_number && !item.transfer_type && (
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 16, fontWeight: 700, color: "var(--text)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <IconPackage size={14} /> #{item.order_number}
                        </span>
                      )}
                    </div>
                    {item.customer_name && (
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text)", marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
                        <IconUser size={13} /> {item.customer_name}
                      </div>
                    )}
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>
                      Separado por {item.separated_by_name} · conferindo há <strong style={{ fontFamily: "var(--font-mono)" }}>{waitingLabel(elapsed)}</strong>
                    </div>
                  </div>
                  {mine ? (
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      <button className="btn-small" style={{ background: "var(--ok-soft)", borderColor: "var(--ok)", color: "var(--ok)", fontWeight: 700, padding: "10px 16px" }} onClick={() => openFinish(item)} disabled={busy}>
                        <IconCheck size={14} /> Finalizar
                      </button>
                      <button className="btn-danger-outline" style={{ padding: "10px 16px" }} onClick={() => openProblem(item)} disabled={busy}>
                        <IconAlertTriangle size={14} /> Problema
                      </button>
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600, whiteSpace: "nowrap" }}>
                      {item.conference_started_by_name}
                    </div>
                  )}
                  {isAdmin && (
                    <div style={{ display: "flex", gap: 6, flexShrink: 0, marginLeft: 8 }}>
                      <button className="btn-small" style={{ padding: "10px 12px" }} onClick={() => openAdminEdit(item)} title="Editar">
                        <IconEdit size={14} />
                      </button>
                      <button className="btn-small" style={{ padding: "10px 12px" }} onClick={() => adminReset(item)} title="Voltar para aguardando">
                        <IconRotateCcw size={14} />
                      </button>
                      <button className="btn-small" style={{ padding: "10px 12px", color: "var(--danger)", borderColor: "var(--danger)" }} onClick={() => adminDelete(item)} title="Excluir">
                        <IconTrash size={14} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-title">Conferidos hoje ({historyToday.length})</div>
        {historyToday.length === 0 ? (
          <div className="schedule-empty" style={{ padding: "20px 0" }}>
            <div style={{ fontSize: 13 }}>Nada conferido hoje ainda.</div>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Pedido/Transf.</th><th>Cliente</th><th>Separado por</th><th>Conferido por</th><th>Horário</th><th>Duração</th><th>Status</th>
                  {isAdmin && <th style={{ width: 110 }}>Admin</th>}
                </tr>
              </thead>
              <tbody>
                {historyToday.map((h) => (
                  <tr key={h.id}>
                    <td style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>
                      {h.is_encaixe && "ENC · "}
                      {h.transfer_type ? `${h.transfer_type} #${h.transfer_number || ""}` : h.order_number ? `#${h.order_number}` : "—"}
                    </td>
                    <td style={{ fontFamily: "var(--font-display)", color: "var(--text-muted)" }}>{h.customer_name || "—"}</td>
                    <td style={{ color: "var(--text-muted)" }}>{h.separated_by_name || "—"}</td>
                    <td style={{ color: "var(--text-muted)" }}>{h.conference_finished_by_name || "—"}</td>
                    <td>{h.conference_finished_at ? fmtClock(h.conference_finished_at) : "—"}</td>
                    <td>{h.duration_seconds ? fmtDuration(h.duration_seconds) : "—"}</td>
                    <td>
                      {h.status === "conferido" ? (
                        <span style={{ color: "var(--ok)", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <IconCheck size={12} /> OK
                        </span>
                      ) : (
                        <span style={{ color: "var(--danger)", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }} title={h.problem_reason || ""}>
                          <IconAlertTriangle size={12} /> {h.problem_reason || "Problema"}
                        </span>
                      )}
                    </td>
                    {isAdmin && (
                      <td style={{ whiteSpace: "nowrap" }}>
                        <button className="btn-small" style={{ padding: "5px 9px", marginRight: 4 }} onClick={() => openAdminEdit(h)} title="Editar">
                          <IconEdit size={12} />
                        </button>
                        <button className="btn-small" style={{ padding: "5px 9px", color: "var(--danger)", borderColor: "var(--danger)" }} onClick={() => adminDelete(h)} title="Excluir">
                          <IconTrash size={12} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {finishModal && (
        <div className="kiosk-modal-backdrop" onClick={() => !busy && setFinishModal(null)}>
          <div className="kiosk-modal" ref={modalRef} onClick={(e) => e.stopPropagation()} style={{ maxWidth: 540 }}>
            <div className="kiosk-modal-header">
              <div>
                <div className="kiosk-modal-title">Finalizar conferência</div>
                <div className="kiosk-modal-sub">
                  {finishModal.order_number ? `Pedido #${finishModal.order_number}` : finishModal.transfer_type ? `${finishModal.transfer_type} #${finishModal.transfer_number}` : "Item"}
                  {finishModal.customer_name && ` · ${finishModal.customer_name}`}
                </div>
              </div>
              <button className="kiosk-modal-close" onClick={() => setFinishModal(null)} aria-label="Fechar">
                <IconX size={18} />
              </button>
            </div>

            <div className="kiosk-modal-body">
              <div className="kiosk-modal-section">
                <label className="kiosk-modal-label">Observação (opcional)</label>
                <textarea className="kiosk-field kiosk-field-textarea" placeholder="Ex: tudo certo, sem avarias" value={finishNote} onChange={(e) => setFinishNote(e.target.value)} rows={3} />
              </div>
            </div>

            <div className="kiosk-modal-footer">
              <button className="kiosk-btn kiosk-btn-secondary" onClick={() => setFinishModal(null)} disabled={busy}>Cancelar</button>
              <button className="kiosk-btn kiosk-btn-primary" style={{ background: "var(--ok)" }} onClick={confirmFinish} disabled={busy}>
                {busy ? "Salvando..." : "Confirmar conferência"}
              </button>
            </div>
          </div>
        </div>
      )}

      {problemModal && (
        <div className="kiosk-modal-backdrop" onClick={() => !busy && setProblemModal(null)}>
          <div className="kiosk-modal" ref={modalRef} onClick={(e) => e.stopPropagation()} style={{ maxWidth: 580 }}>
            <div className="kiosk-modal-header">
              <div>
                <div className="kiosk-modal-title" style={{ color: "var(--danger)", display: "flex", alignItems: "center", gap: 8 }}>
                  <IconAlertTriangle size={18} /> Reportar problema
                </div>
                <div className="kiosk-modal-sub">
                  {problemModal.order_number ? `Pedido #${problemModal.order_number}` : problemModal.transfer_type ? `${problemModal.transfer_type} #${problemModal.transfer_number}` : "Item"}
                </div>
              </div>
              <button className="kiosk-modal-close" onClick={() => setProblemModal(null)} aria-label="Fechar">
                <IconX size={18} />
              </button>
            </div>

            <div className="kiosk-modal-body">
              <div className="kiosk-modal-section">
                <label className="kiosk-modal-label">Motivo do problema *</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {["Falta produto", "Produto errado", "Avaria", "Quantidade errada", "Pedido incorreto"].map((r) => (
                    <button key={r} className={`quick-filter-btn ${problemReason === r ? "active" : ""}`} onClick={() => setProblemReason(r)} type="button">{r}</button>
                  ))}
                </div>
                <input className="kiosk-field" style={{ marginTop: 10 }} placeholder="Ou digite o motivo" value={problemReason} onChange={(e) => setProblemReason(e.target.value)} autoFocus />
              </div>

              <div className="kiosk-modal-section">
                <label className="kiosk-modal-label">Observação (opcional)</label>
                <textarea className="kiosk-field kiosk-field-textarea" placeholder="Detalhe o problema..." value={problemNote} onChange={(e) => setProblemNote(e.target.value)} rows={3} />
              </div>
            </div>

            <div className="kiosk-modal-footer">
              <button className="kiosk-btn kiosk-btn-secondary" onClick={() => setProblemModal(null)} disabled={busy}>Cancelar</button>
              <button className="kiosk-btn" style={{ background: "var(--danger)", color: "#fff", flex: 1 }} onClick={confirmProblem} disabled={busy || !problemReason.trim()}>
                {busy ? "Salvando..." : "Reportar problema"}
              </button>
            </div>
          </div>
        </div>
      )}

      {adminEdit && (
        <div className="kiosk-modal-backdrop" onClick={() => !busy && setAdminEdit(null)}>
          <div className="kiosk-modal" ref={modalRef} onClick={(e) => e.stopPropagation()} style={{ maxWidth: 620 }}>
            <div className="kiosk-modal-header">
              <div>
                <div className="kiosk-modal-title" style={{ color: "var(--danger)", display: "flex", alignItems: "center", gap: 8 }}>
                  <IconEdit size={18} /> Editar item (admin)
                </div>
                <div className="kiosk-modal-sub">Você está editando como admin</div>
              </div>
              <button className="kiosk-modal-close" onClick={() => setAdminEdit(null)} aria-label="Fechar">
                <IconX size={18} />
              </button>
            </div>

            <div className="kiosk-modal-body">
              <div className="schedule-modal-grid">
                <div>
                  <label className="schedule-modal-label">Status</label>
                  <select className="schedule-modal-field" value={adminEdit.status} onChange={(e) => setAdminEdit({ ...adminEdit, status: e.target.value })} disabled={busy}>
                    {CONFERENCE_STATUS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="schedule-modal-label">Nº pedido</label>
                  <input className="schedule-modal-field" value={adminEdit.order_number || ""} onChange={(e) => setAdminEdit({ ...adminEdit, order_number: e.target.value.replace(/\D/g, "") })} disabled={busy} />
                </div>
                <div className="schedule-modal-full">
                  <label className="schedule-modal-label">Cliente</label>
                  <input className="schedule-modal-field" value={adminEdit.customer_name || ""} onChange={(e) => setAdminEdit({ ...adminEdit, customer_name: e.target.value })} disabled={busy} />
                </div>
                <div>
                  <label className="schedule-modal-label">Tipo transferência</label>
                  <select className="schedule-modal-field" value={adminEdit.transfer_type || ""} onChange={(e) => setAdminEdit({ ...adminEdit, transfer_type: e.target.value || null })} disabled={busy}>
                    <option value="">—</option>
                    <option value="AP">AP</option>
                    <option value="ZN">ZN</option>
                  </select>
                </div>
                <div>
                  <label className="schedule-modal-label">Nº transferência</label>
                  <input className="schedule-modal-field" value={adminEdit.transfer_number || ""} onChange={(e) => setAdminEdit({ ...adminEdit, transfer_number: e.target.value.replace(/\D/g, "") })} disabled={busy} />
                </div>
                <div className="schedule-modal-full">
                  <label className="schedule-modal-label">Motivo do problema</label>
                  <input className="schedule-modal-field" value={adminEdit.problem_reason || ""} onChange={(e) => setAdminEdit({ ...adminEdit, problem_reason: e.target.value })} disabled={busy} />
                </div>
                <div className="schedule-modal-full">
                  <label className="schedule-modal-label">Observação</label>
                  <textarea className="schedule-modal-field" rows={2} style={{ resize: "none" }} value={adminEdit.note || ""} onChange={(e) => setAdminEdit({ ...adminEdit, note: e.target.value })} disabled={busy} />
                </div>
                <div className="schedule-modal-full" style={{ display: "flex", gap: 20 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}>
                    <input type="checkbox" checked={!!adminEdit.is_encaixe} onChange={(e) => setAdminEdit({ ...adminEdit, is_encaixe: e.target.checked })} disabled={busy} />
                    Encaixe
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}>
                    <input type="checkbox" checked={!!adminEdit.transfer_urgent} onChange={(e) => setAdminEdit({ ...adminEdit, transfer_urgent: e.target.checked })} disabled={busy} />
                    Transferência urgente
                  </label>
                </div>
              </div>
            </div>

            <div className="kiosk-modal-footer">
              <button className="kiosk-btn kiosk-btn-secondary" onClick={() => setAdminEdit(null)} disabled={busy}>Cancelar</button>
              <button className="kiosk-btn kiosk-btn-primary" onClick={saveAdminEdit} disabled={busy}>
                {busy ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}