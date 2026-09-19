import React, { useEffect, useRef, useState } from "react";
import { logSeparationError } from "../lib/api";
import { fmtClock, fmtDate, shiftFor } from "../lib/format";
import logo from "../assets/logo.png";

const CODE_LENGTH = 3;
const AUTO_RETURN_MS = 2200;
const IDLE_TIMEOUT_MS = 20000;

export default function ErrorKiosk({ operators, errorTypes }) {
  const [codeInput, setCodeInput] = useState("");
  const [loggedOperator, setLoggedOperator] = useState(null);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
  const [now, setNow] = useState(Date.now());

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

  function reset() {
    if (autoReturnTimeoutRef.current) clearTimeout(autoReturnTimeoutRef.current);
    setCodeInput("");
    setLoggedOperator(null);
    setNote("");
    setMsg("");
    setConfirmation(null);
  }

  function handleDigit(d) {
    bump();
    if (codeInputRef.current.length < CODE_LENGTH) setCodeInput(codeInputRef.current + d);
  }

  function triggerShake() {
    setShake(true);
    setTimeout(() => setShake(false), 400);
  }

  function handleLogin() {
    const current = codeInputRef.current;
    if (current.length < CODE_LENGTH) return;
    const op = operators.find((o) => o.code === current);
    if (!op) {
      setMsgAndShake("Código não encontrado.");
      return;
    }
    bump();
    setMsg("");
    setLoggedOperator(op);
  }

  function setMsgAndShake(text) {
    setMsg(text);
    triggerShake();
    setCodeInput("");
  }

  async function reportError(errorType) {
    if (busy) return;
    bump();
    setBusy(true);
    const { error } = await logSeparationError({
      operatorCode: loggedOperator.code,
      operatorName: loggedOperator.name,
      errorType,
      note: note.trim(),
    });
    setBusy(false);
    if (!error) {
      setConfirmation({ errorType });
      autoReturnTimeoutRef.current = setTimeout(reset, AUTO_RETURN_MS);
    } else {
      setMsg("Erro ao salvar. Tente novamente.");
    }
  }

  const dots = Array.from({ length: CODE_LENGTH }, (_, i) => i < codeInput.length);

  return (
    <div onClick={bump} style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
      <h1 className="page-title">Registrar erro de separação</h1>
      <p className="page-sub">Digite seu código e escolha o tipo de erro encontrado.</p>

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
              <button className="keypad-key accent" onClick={handleLogin}>
                OK
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
                width: 44, height: 44, borderRadius: "50%", display: "flex", alignItems: "center",
                justifyContent: "center", margin: "0 auto 16px auto", background: "var(--danger-dim)",
                color: "var(--danger)", fontSize: 18,
              }}
            >
              ✓
            </div>
            <div style={{ fontSize: 17, fontWeight: 600 }}>Erro registrado</div>
            <div style={{ color: "var(--text-muted)", fontSize: 12.5, marginTop: 6 }}>{confirmation.errorType}</div>
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
              <button className="btn-small" onClick={reset}>Trocar</button>
            </div>

            <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 8 }}>Tipo de erro:</p>
            {errorTypes.length > 0 ? (
              <div className="activity-grid" style={{ opacity: busy ? 0.6 : 1, pointerEvents: busy ? "none" : "auto" }}>
                {errorTypes.map((t) => (
                  <div key={t.name} className="activity-btn" onClick={() => reportError(t.name)}>
                    {t.name}
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
                Nenhum tipo de erro cadastrado. Peça ao administrador para adicionar em "Equipe".
              </p>
            )}
            <textarea
              className="field"
              placeholder="Observação (opcional)"
              value={note}
              onChange={(e) => { bump(); setNote(e.target.value); }}
              rows={2}
              style={{ width: "100%", resize: "none", marginTop: 12, fontFamily: "inherit" }}
            />
            {msg && <p style={{ color: "var(--danger)", fontSize: 12.5, textAlign: "center", marginTop: 10 }}>{msg}</p>}
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
