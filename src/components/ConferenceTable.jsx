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
import { fmtClock, fmtDate, fmtDuration } from "../lib/format";
import { supabase } from "../supabaseClient";
import useKeyboardNav from "../hooks/useKeyboardNav";

const CODE_LENGTH = 3;
const AUTO_RETURN_MS = 3000;

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

export default function ConferenceTable({ operators }) {
  const [queue, setQueue] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());

  const [loggedOperator, setLoggedOperator] = useState(null);
  const [codeInput, setCodeInput] = useState("");
  const [loginError, setLoginError] = useState("");
  const [checkingLogin, setCheckingLogin] = useState(false);

  const [finishModal, setFinishModal] = useState(null);
  const [problemModal, setProblemModal] = useState(null);
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
    enabled: !finishModal && !problemModal,
    onEscape: () => {
      if (loginError) setLoginError("");
    },
  });

  useKeyboardNav({
    containerRef: modalRef,
    enabled: !!(finishModal || problemModal),
    onEscape: () => {
      if (busy) return;
      setFinishModal(null);
      setProblemModal(null);
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

  // Carrega dados só depois do login
  useEffect(() => {
    if (loggedOperator) {
      load();
    }
  }, [loggedOperator]);

  // Realtime só depois do login
  useEffect(() => {
    if (!loggedOperator) return;
    const ch = supabase
      .channel("conference-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "conference_queue" }, load)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [loggedOperator]);

  useEffect(() => {
    return () => {
      if (autoReturnRef.current) clearTimeout(autoReturnRef.current);
    };
  }, []);

  function handleDigit(d) {
    if (codeInputRef.current.length < CODE_LENGTH) {
      setCodeInput(codeInputRef.current + d);
    }
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
      setLoginError("Você não está cadastrado como conferente. Fale com o admin.");
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
    setLoggedOperator(null);
    setCodeInput("");
    setLoginError("");
    setQueue([]);
    setHistory([]);
  }

  useEffect(() => {
    if (loggedOperator) return;
    if (finishModal || problemModal) return;
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
  }, [loggedOperator, finishModal, problemModal]);

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
    const today = new Date().toISOString().slice(0, 10);
    return history.filter((h) => h.conference_finished_at?.slice(0, 10) === today).slice(0, 30);
  }, [history]);

  async function handleAssume(item) {
    if (busy) return;
    if (!loggedOperator) return;
    setBusy(true);
    const { error: err } = await startConference(item.id, loggedOperator);
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    await load();
  }

  function openFinish(item) {
    setFinishModal(item);
    setFinishNote("");
  }

  function openProblem(item) {
    setProblemModal(item);
    setProblemReason("");
    setProblemNote("");
  }

  async function confirmFinish() {
    if (!finishModal || busy) return;
    setBusy(true);
    const { error: err } = await finishConference(finishModal.id, loggedOperator, finishNote.trim());
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
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
    if (err) {
      setError(err.message);
      return;
    }
    setProblemModal(null);
    setProblemReason("");
    setProblemNote("");
    setConfirmation({ kind: "problema", order: problemModal.order_number || problemModal.transfer_number });
    autoReturnRef.current = setTimeout(() => setConfirmation(null), AUTO_RETURN_MS);
    await load();
  }

  const dots = Array.from({ length: CODE_LENGTH }, (_, i) => i < codeInput.length);

  if (!loggedOperator) {
    return (
      <div ref={mainContainerRef}>
        <div className="page-header-row" style={{ marginBottom: 22 }}>
          <div>
            <h1 className="page-title">Mesa de conferência</h1>
            <p className="page-sub" style={{ marginBottom: 0 }}>
              Digite seu código de conferente pra acessar
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
            <div
              className="kiosk-keypad"
              style={{ opacity: checkingLogin ? 0.55 : 1, pointerEvents: checkingLogin ? "none" : "auto" }}
            >
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
                <button key={d} className="kiosk-key" onClick={() => handleDigit(d)}>{d}</button>
              ))}
              <button className="kiosk-key kiosk-key-muted" onClick={handleBackspace}>⌫</button>
              <button className="kiosk-key" onClick={() => handleDigit("0")}>0</button>
              <button className="kiosk-key kiosk-key-primary" onClick={handleLogin}>
                {checkingLogin ? "..." : "OK"}
              </button>
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
          <h1 className="page-title">Mesa de conferência</h1>
          <p className="page-sub" style={{ marginBottom: 0 }}>
            {stats.waiting} aguardando · {stats.inProgress} em conferência · {stats.todayFinished} conferidos hoje
            <span style={{ marginLeft: 8, color: "var(--accent)", fontWeight: 600 }}>
              · {loggedOperator.name} #{loggedOperator.code}
            </span>
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn-small" onClick={load}>🔄 Atualizar</button>
          <button className="btn-small" onClick={logout}>🚪 Sair</button>
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
            {confirmation.kind === "conferido" ? "✓" : "⚠"}
          </div>
          <div className="kiosk-confirm-title">
            {confirmation.kind === "conferido" ? "Conferência finalizada" : "Problema reportado"}
          </div>
          <div className="kiosk-confirm-sub">
            {confirmation.order ? `Pedido ${confirmation.order}` : "Item"}
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
        <div className="card-title">⏳ Aguardando conferência ({waiting.length})</div>
        {loading ? (
          <div className="schedule-empty">Carregando…</div>
        ) : waiting.length === 0 ? (
          <div className="schedule-empty">
            <div className="schedule-empty-icon">✅</div>
            <div>Nenhum pedido aguardando. Mesa limpa!</div>
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
                    padding: "14px 16px",
                    background: "var(--surface-raised)",
                    border: `1px solid var(--border)`,
                    borderLeft: `4px solid ${color}`,
                    borderRadius: 12,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      {item.is_encaixe && (
                        <span style={{ background: "var(--accent-2-soft)", color: "var(--accent-2)", padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 700 }}>
                          ⚡ ENCAIXE
                        </span>
                      )}
                      {item.transfer_type && (
                        <span style={{ background: "var(--accent-soft)", color: "var(--accent)", padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 700 }}>
                          🔄 {item.transfer_type}
                          {item.transfer_number && ` #${item.transfer_number}`}
                        </span>
                      )}
                      {item.transfer_urgent && (
                        <span style={{ background: "var(--danger-soft)", color: "var(--danger)", padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 700 }}>
                          🔴 URGENTE
                        </span>
                      )}
                      {item.order_number && !item.transfer_type && (
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 16, fontWeight: 700, color: "var(--text)" }}>
                          📦 #{item.order_number}
                        </span>
                      )}
                    </div>
                    {item.customer_name && (
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text)", marginTop: 4 }}>
                        👤 {item.customer_name}
                      </div>
                    )}
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                      Separado por <strong>{item.separated_by_name}</strong> às {fmtClock(item.separated_at)} · esperando há{" "}
                      <span style={{ color, fontWeight: 700 }}>{waitingLabel(seconds)}</span>
                    </div>
                  </div>
                  <button
                    className="btn-small btn-excel"
                    onClick={() => handleAssume(item)}
                    disabled={busy}
                    style={{ padding: "10px 16px", fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}
                  >
                    Assumir conferência
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">🔍 Em conferência ({inProgress.length})</div>
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
                    padding: "14px 16px",
                    background: mine ? "var(--accent-soft)" : "var(--surface-raised)",
                    border: `1px solid ${mine ? "var(--accent)" : "var(--border)"}`,
                    borderLeft: `4px solid ${mine ? "var(--accent)" : "var(--warning)"}`,
                    borderRadius: 12,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      {item.is_encaixe && (
                        <span style={{ background: "var(--accent-2-soft)", color: "var(--accent-2)", padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 700 }}>
                          ⚡ ENCAIXE
                        </span>
                      )}
                      {item.transfer_type && (
                        <span style={{ background: "var(--accent-soft)", color: "var(--accent)", padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 700 }}>
                          🔄 {item.transfer_type} {item.transfer_number && `#${item.transfer_number}`}
                        </span>
                      )}
                      {item.transfer_urgent && (
                        <span style={{ background: "var(--danger-soft)", color: "var(--danger)", padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 700 }}>
                          🔴 URGENTE
                        </span>
                      )}
                      {item.order_number && !item.transfer_type && (
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 16, fontWeight: 700, color: "var(--text)" }}>
                          📦 #{item.order_number}
                        </span>
                      )}
                    </div>
                    {item.customer_name && (
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text)", marginTop: 4 }}>
                        👤 {item.customer_name}
                      </div>
                    )}
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                      Separado por {item.separated_by_name} · conferindo há{" "}
                      <strong style={{ fontFamily: "var(--font-mono)" }}>{waitingLabel(elapsed)}</strong>
                    </div>
                  </div>
                  {mine ? (
                    <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                      <button
                        className="btn-small"
                        style={{ background: "var(--ok-soft)", borderColor: "var(--ok)", color: "var(--ok)", fontWeight: 700, padding: "10px 16px" }}
                        onClick={() => openFinish(item)}
                        disabled={busy}
                      >
                        ✓ Finalizar
                      </button>
                      <button
                        className="btn-danger-outline"
                        style={{ padding: "10px 16px" }}
                        onClick={() => openProblem(item)}
                        disabled={busy}
                      >
                        ⚠ Problema
                      </button>
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600, whiteSpace: "nowrap" }}>
                      👤 {item.conference_started_by_name}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-title">📋 Conferidos hoje ({historyToday.length})</div>
        {historyToday.length === 0 ? (
          <div className="schedule-empty" style={{ padding: "20px 0" }}>
            <div style={{ fontSize: 13 }}>Nada conferido hoje ainda.</div>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Pedido/Transf.</th>
                  <th>Cliente</th>
                  <th>Separado por</th>
                  <th>Conferido por</th>
                  <th>Horário</th>
                  <th>Duração</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {historyToday.map((h) => (
                  <tr key={h.id}>
                    <td style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>
                      {h.is_encaixe && "⚡ "}
                      {h.transfer_type ? `${h.transfer_type} #${h.transfer_number || ""}` : h.order_number ? `#${h.order_number}` : "—"}
                    </td>
                    <td style={{ fontFamily: "var(--font-display)", color: "var(--text-muted)" }}>{h.customer_name || "—"}</td>
                    <td style={{ color: "var(--text-muted)" }}>{h.separated_by_name || "—"}</td>
                    <td style={{ color: "var(--text-muted)" }}>{h.conference_finished_by_name || "—"}</td>
                    <td>{h.conference_finished_at ? fmtClock(h.conference_finished_at) : "—"}</td>
                    <td>{h.duration_seconds ? fmtDuration(h.duration_seconds) : "—"}</td>
                    <td>
                      {h.status === "conferido" ? (
                        <span style={{ color: "var(--ok)", fontWeight: 600 }}>✓ OK</span>
                      ) : (
                        <span style={{ color: "var(--danger)", fontWeight: 600 }} title={h.problem_reason || ""}>
                          ⚠ {h.problem_reason || "Problema"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {finishModal && (
        <div className="kiosk-modal-backdrop" onClick={() => !busy && setFinishModal(null)}>
          <div className="kiosk-modal" ref={modalRef} onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="kiosk-modal-header">
              <div>
                <div className="kiosk-modal-title">Finalizar conferência</div>
                <div className="kiosk-modal-sub">
                  {finishModal.order_number ? `Pedido #${finishModal.order_number}` : finishModal.transfer_type ? `${finishModal.transfer_type} #${finishModal.transfer_number}` : "Item"}
                  {finishModal.customer_name && ` · ${finishModal.customer_name}`}
                </div>
              </div>
              <button className="kiosk-modal-close" onClick={() => setFinishModal(null)}>✕</button>
            </div>

            <div className="kiosk-modal-body">
              <div className="kiosk-modal-section">
                <label className="kiosk-modal-label">Observação (opcional)</label>
                <textarea
                  className="kiosk-field kiosk-field-textarea"
                  placeholder="Ex: tudo certo, sem avarias"
                  value={finishNote}
                  onChange={(e) => setFinishNote(e.target.value)}
                  rows={3}
                />
              </div>
            </div>

            <div className="kiosk-modal-footer">
              <button className="kiosk-btn kiosk-btn-secondary" onClick={() => setFinishModal(null)} disabled={busy}>
                Cancelar
              </button>
              <button
                className="kiosk-btn kiosk-btn-primary"
                style={{ background: "var(--ok)" }}
                onClick={confirmFinish}
                disabled={busy}
              >
                {busy ? "Salvando..." : "✓ Confirmar conferência"}
              </button>
            </div>
          </div>
        </div>
      )}

      {problemModal && (
        <div className="kiosk-modal-backdrop" onClick={() => !busy && setProblemModal(null)}>
          <div className="kiosk-modal" ref={modalRef} onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div className="kiosk-modal-header">
              <div>
                <div className="kiosk-modal-title" style={{ color: "var(--danger)" }}>⚠ Reportar problema</div>
                <div className="kiosk-modal-sub">
                  {problemModal.order_number ? `Pedido #${problemModal.order_number}` : problemModal.transfer_type ? `${problemModal.transfer_type} #${problemModal.transfer_number}` : "Item"}
                </div>
              </div>
              <button className="kiosk-modal-close" onClick={() => setProblemModal(null)}>✕</button>
            </div>

            <div className="kiosk-modal-body">
              <div className="kiosk-modal-section">
                <label className="kiosk-modal-label">Motivo do problema *</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {["Falta produto", "Produto errado", "Avaria", "Quantidade errada", "Pedido incorreto"].map((r) => (
                    <button
                      key={r}
                      className={`quick-filter-btn ${problemReason === r ? "active" : ""}`}
                      onClick={() => setProblemReason(r)}
                      type="button"
                    >
                      {r}
                    </button>
                  ))}
                </div>
                <input
                  className="kiosk-field"
                  style={{ marginTop: 8 }}
                  placeholder="Ou digite o motivo"
                  value={problemReason}
                  onChange={(e) => setProblemReason(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="kiosk-modal-section">
                <label className="kiosk-modal-label">Observação (opcional)</label>
                <textarea
                  className="kiosk-field kiosk-field-textarea"
                  placeholder="Detalhe o problema..."
                  value={problemNote}
                  onChange={(e) => setProblemNote(e.target.value)}
                  rows={3}
                />
              </div>
            </div>

            <div className="kiosk-modal-footer">
              <button className="kiosk-btn kiosk-btn-secondary" onClick={() => setProblemModal(null)} disabled={busy}>
                Cancelar
              </button>
              <button
                className="kiosk-btn"
                style={{ background: "var(--danger)", color: "#fff", flex: 1 }}
                onClick={confirmProblem}
                disabled={busy || !problemReason.trim()}
              >
                {busy ? "Salvando..." : "Reportar problema"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}