import React, { useEffect, useRef, useState } from "react";
import { fetchActiveSessionFor, startSession, finishSession } from "../lib/api";
import { fmtDuration, fmtClock, fmtDate, shiftFor } from "../lib/format";
import { activityNeedsDetail, detailOptionsFor, detailLabelFor } from "../lib/activityDetails";
import logo from "../assets/logo.png";

const CODE_LENGTH = 3;
const AUTO_RETURN_MS = 2200;
const IDLE_TIMEOUT_MS = 20000;

export default function Kiosk({ operators, activities, refreshEntries }) {
  const [codeInput, setCodeInput] = useState("");
  const [loggedOperator, setLoggedOperator] = useState(null);
  const [session, setSession] = useState(null);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState("info");
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
  const [pendingActivity, setPendingActivity] = useState(null);

  const codeInputRef = useRef(codeInput);
  codeInputRef.current = codeInput;
  const lastInteractionRef = useRef(Date.now());
  const autoReturnTimeoutRef = useRef(null);

  function bump() {
    lastInteractionRef.current = Date.now();
  }

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (!loggedOperator) return;
    const iv = setInterval(() => {
      if (Date.now() - lastInteractionRef.current > IDLE_TIMEOUT_MS) reset();
    }, 1000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedOperator]);

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

  const [checkingLogin, setCheckingLogin] = useState(false);

  function reset() {
    if (autoReturnTimeoutRef.current) clearTimeout(autoReturnTimeoutRef.current);
    setCodeInput("");
    setLoggedOperator(null);
    setSession(null);
    setMsg("");
    setConfirmation(null);
    setPendingActivity(null);
  }

  function handleDigit(d) {
    bump();
    if (codeInputRef.current.length < CODE_LENGTH) setCodeInput(codeInputRef.current + d);
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
      setMsgType("error");
      setMsg("Código não encontrado.");
      triggerShake();
      setCodeInput("");
      return;
    }
    bump();
    setMsg("");
    setCheckingLogin(true);
    const { data } = await fetchActiveSessionFor(op.code);
    // Busca a sessão ANTES de logar visualmente, para não piscar a tela de
    // "escolher atividade" por um instante quando na verdade já tem uma em andamento.
    setSession(data || null);
    setLoggedOperator(op);
    setCheckingLogin(false);
  }

  function chooseActivity(activityName) {
    if (busy) return;
    bump();
    if (activityNeedsDetail(activityName)) {
      // Atividades como Limpeza, Organização e Carregamento de Caminhão
      // precisam de uma escolha extra (local ou veículo) antes de começar
      // a contar o tempo.
      setPendingActivity(activityName);
    } else {
      startActivity(activityName, null);
    }
  }

  async function startActivity(activityName, detail) {
    if (busy) return;
    bump();
    setBusy(true);
    const nowIso = new Date().toISOString();
    const { error } = await startSession({
      operatorCode: loggedOperator.code,
      operatorName: loggedOperator.name,
      activity: activityName,
      startTimeIso: nowIso,
      detail,
    });
    setBusy(false);
    if (!error) {
      setPendingActivity(null);
      setConfirmation({ kind: "started", activity: activityName, detail, time: fmtClock(nowIso) });
      autoReturnTimeoutRef.current = setTimeout(reset, AUTO_RETURN_MS);
    } else {
      setMsgType("error");
      setMsg("Erro ao iniciar. Tente novamente.");
    }
  }

  async function finishActivity() {
    if (!session || busy) return;
    bump();
    setBusy(true);
    const endTime = new Date();
    const startTime = new Date(session.start_time);
    const duration = Math.round((endTime - startTime) / 1000);

    const { error } = await finishSession(session, {
      endTimeIso: endTime.toISOString(),
      durationSeconds: duration,
      shift: shiftFor(session.start_time),
    });

    setBusy(false);
    if (!error) {
      refreshEntries?.();
      setSession(null);
      setConfirmation({ kind: "finished", activity: session.activity, detail: session.detail, extra: fmtDuration(duration) });
      autoReturnTimeoutRef.current = setTimeout(reset, AUTO_RETURN_MS);
    } else {
      setMsgType("error");
      setMsg("Erro ao salvar. Tente novamente.");
    }
  }

  const dots = Array.from({ length: CODE_LENGTH }, (_, i) => i < codeInput.length);

  return (
    <div onClick={bump} style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
      <h1 className="page-title">Registrar atividade</h1>
      <p className="page-sub">Digite seu código para iniciar ou finalizar uma atividade.</p>

      <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-start" }}>
      {!loggedOperator && (
        <div className={`terminal ${shake ? "shake" : ""}`}>
          <div className="terminal-dots">
            {dots.map((filled, i) => (
              <div key={i} className={`terminal-dot ${filled ? "filled" : ""}`} />
            ))}
          </div>
          <div className="keypad">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
              <button key={d} className="keypad-key" onClick={() => handleDigit(d)}>
                {d}
              </button>
            ))}
            <button className="keypad-key" onClick={() => { bump(); setCodeInput((p) => p.slice(0, -1)); }}>
              ⌫
            </button>
            <button className="keypad-key" onClick={() => handleDigit("0")}>
              0
            </button>
            <button className="keypad-key accent" onClick={handleLogin} disabled={checkingLogin}>
              {checkingLogin ? "..." : "OK"}
            </button>
          </div>
          {msg ? (
            <p className="terminal-error">{msg}</p>
          ) : (
            <p className="terminal-hint">teclado do computador também funciona</p>
          )}
        </div>
      )}

      {loggedOperator && confirmation && (
        <div className="terminal" style={{ textAlign: "center", padding: "36px 24px" }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px auto",
              background: confirmation.kind === "started" ? "var(--accent-dim)" : "var(--ok-dim)",
              color: confirmation.kind === "started" ? "var(--accent)" : "var(--ok)",
              fontSize: 18,
            }}
          >
            {confirmation.kind === "started" ? "▶" : "✓"}
          </div>
          <div style={{ fontSize: 17, fontWeight: 600 }}>
            {confirmation.activity} {confirmation.kind === "started" ? "iniciada" : "finalizada"}
          </div>
          {confirmation.detail && (
            <div style={{ color: "var(--text-muted)", fontSize: 12.5, marginTop: 2 }}>{confirmation.detail}</div>
          )}
          <div style={{ color: "var(--text-muted)", fontSize: 12.5, marginTop: 6 }}>
            {confirmation.kind === "started"
              ? `às ${confirmation.time} · volte depois para finalizar`
              : `duração: ${confirmation.extra}`}
          </div>
        </div>
      )}

      {loggedOperator && !confirmation && (
        <div className="card" style={{ width: 420 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 17, fontWeight: 600 }}>{loggedOperator.name}</div>
              <div style={{ color: "var(--text-muted)", fontSize: 12 }}>
                {loggedOperator.role} · #{loggedOperator.code}
              </div>
            </div>
            <button className="btn-small" onClick={reset}>
              Trocar
            </button>
          </div>

          {!session && !pendingActivity && (
            <div className="activity-grid">
              {activities.map((a) => (
                <div key={a.name} className="activity-btn" onClick={() => chooseActivity(a.name)}>
                  {a.name}
                </div>
              ))}
            </div>
          )}

          {!session && pendingActivity && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                  {pendingActivity} · {detailLabelFor(pendingActivity)}
                </div>
                <button className="btn-small" onClick={() => setPendingActivity(null)}>
                  Voltar
                </button>
              </div>
              <div className="activity-grid">
                {detailOptionsFor(pendingActivity).map((opt) => (
                  <div key={opt} className="activity-btn" onClick={() => startActivity(pendingActivity, opt)}>
                    {opt}
                  </div>
                ))}
              </div>
            </div>
          )}

          {session && (
            <div style={{ textAlign: "center", padding: "6px 0" }}>
              <div style={{ color: "var(--text-muted)", fontSize: 11.5 }}>
                em andamento desde {fmtClock(session.start_time)}
              </div>
              <div style={{ fontSize: 18, fontWeight: 600, margin: "4px 0 8px 0" }}>{session.activity}</div>
              {session.detail && (
                <div style={{ color: "var(--text-muted)", fontSize: 12.5, marginTop: -4, marginBottom: 8 }}>
                  {session.detail}
                </div>
              )}
              <div className="stat-num" style={{ fontSize: 32, marginBottom: 16 }}>
                {fmtDuration(Math.round((now - new Date(session.start_time).getTime()) / 1000))}
              </div>
              <button className="btn btn-danger" onClick={finishActivity} disabled={busy}>
                Finalizar atividade
              </button>
            </div>
          )}
          {msg && (
            <p
              style={{
                color: msgType === "error" ? "var(--danger)" : "var(--ok)",
                fontSize: 12.5,
                textAlign: "center",
                marginTop: 10,
              }}
            >
              {msg}
            </p>
          )}
        </div>
      )}

      <div className="side-panel">
        <div className="side-clock">{fmtClock(now)}</div>
        <div className="side-date">{fmtDate(now)}</div>
        <div className="side-shift-badge">
          <span className="side-shift-dot" />
          Turno {shiftFor(now)}
        </div>
        <div className="side-divider" />
        <img src={logo} alt="" className="side-logo" />
        <div className="side-motto">"joga junto e cresce todo dia"</div>
      </div>
      </div>
    </div>
  );
}
