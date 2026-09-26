import React, { useEffect, useMemo, useRef, useState } from "react";
import { logSeparationError } from "../lib/api";
import { fmtClock, fmtDate, shiftFor } from "../lib/format";
import { getStationName, promptForStationName } from "../lib/station";
import { playSuccess, playError, playKey } from "../utils/sound";
import useKeyboardNav from "../hooks/useKeyboardNav";

const CODE_LENGTH = 3;
const AUTO_RETURN_MS = 2200;
const IDLE_TIMEOUT_MS = 5 * 60 * 1000;
const TRANSFER_ZONES = ["AP", "ZN"];

function errorIcon(name) {
  const n = (name || "").toLowerCase();
  if (n.includes("sobra")) return "📦";
  if (n.includes("não tem") || n.includes("nao tem") || n.includes("pedido")) return "❓";
  if (n.includes("falta")) return "⚠️";
  if (n.includes("avaria") || n.includes("quebr")) return "💥";
  if (n.includes("troca") || n.includes("errad")) return "🔀";
  return "🚨";
}

export default function ErrorKiosk({ operators, errorTypes }) {
  const [codeInput, setCodeInput] = useState("");
  const [loggedOperator, setLoggedOperator] = useState(null);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [stationName, setStationNameState] = useState(getStationName());

  const [orderType, setOrderType] = useState(null);
  const [orderNumber, setOrderNumber] = useState("");
  const [transferZone, setTransferZone] = useState("");

  const [errorOperatorCode, setErrorOperatorCode] = useState("");
  const [showOperatorPicker, setShowOperatorPicker] = useState(false);
  const [operatorSearch, setOperatorSearch] = useState("");

  const codeInputRef = useRef(codeInput);
  codeInputRef.current = codeInput;
  const lastInteractionRef = useRef(Date.now());
  const autoReturnTimeoutRef = useRef(null);
  const mainContainerRef = useRef(null);
  const modalRef = useRef(null);

  function bump() {
    lastInteractionRef.current = Date.now();
  }

  function editStation() {
    setStationNameState(promptForStationName());
  }

  useKeyboardNav({
    containerRef: mainContainerRef,
    enabled: !showOperatorPicker,
    onEscape: () => {
      if (loggedOperator) {
        setOrderType(null);
        setOrderNumber("");
        setTransferZone("");
        setErrorOperatorCode("");
        setNote("");
        setMsg("");
      }
    },
  });

  useKeyboardNav({
    containerRef: modalRef,
    enabled: showOperatorPicker,
    onEscape: () => setShowOperatorPicker(false),
  });

  const errorOperator = useMemo(
    () => operators.find((o) => o.code === errorOperatorCode) || null,
    [operators, errorOperatorCode]
  );

  const filteredOperators = useMemo(() => {
    const q = operatorSearch.trim().toLowerCase();
    if (!q) return operators;
    return operators.filter(
      (o) => o.name.toLowerCase().includes(q) || o.code.includes(q)
    );
  }, [operators, operatorSearch]);

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
    setOrderType(null);
    setOrderNumber("");
    setTransferZone("");
    setErrorOperatorCode("");
    setShowOperatorPicker(false);
    setOperatorSearch("");
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

  function handleLogin() {
    if (loggedOperator) return;
    const current = codeInputRef.current;
    if (current.length < CODE_LENGTH) return;

    const op = operators.find((o) => o.code === current);
    if (!op) {
      playError();
      setMsgAndShake("Código não encontrado.");
      return;
    }
    bump();
    playSuccess();
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

    if (!orderType) {
      playError();
      setMsg("Escolha se é Pedido ou Transferência.");
      return;
    }
    if (!/^\d{4}$/.test(orderNumber)) {
      playError();
      setMsg("Digite os 4 últimos dígitos do pedido/transferência.");
      return;
    }
    if (orderType === "transferencia" && !transferZone) {
      playError();
      setMsg("Escolha se a transferência era AP ou ZN.");
      return;
    }
    if (!errorOperatorCode) {
      playError();
      setMsg("Informe quem errou na separação.");
      return;
    }

    bump();
    setBusy(true);

    const finalOrderNumber =
      orderType === "transferencia" && transferZone
        ? `${transferZone} ${orderNumber}`
        : orderNumber;

    const { error } = await logSeparationError({
      operatorCode: loggedOperator.code,
      operatorName: loggedOperator.name,
      errorType,
      note: note.trim(),
      station: stationName || null,
      orderType,
      orderNumber: finalOrderNumber,
      errorOperatorCode: errorOperator?.code || null,
      errorOperatorName: errorOperator?.name || null,
    });
    setBusy(false);
    if (!error) {
      playSuccess();
      setConfirmation({ errorType });
      autoReturnTimeoutRef.current = setTimeout(reset, AUTO_RETURN_MS);
    } else {
      playError();
      setMsg(`Erro ao salvar. ${error.message || "Tente novamente."}`);
    }
  }

  const dots = Array.from({ length: CODE_LENGTH }, (_, i) => i < codeInput.length);

  return (
    <div className="kiosk-page" ref={mainContainerRef}>
      <header className="kiosk-header">
        <div className="kiosk-header-left">
          <div>
            <div className="kiosk-header-title">Aponta CD</div>
          </div>
        </div>

        <div className="kiosk-header-right">
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
            📍 {stationName || "Nomear estação"}
          </button>
        </div>
      </header>

      <main className="kiosk-main">
        {!confirmation && (
          <div style={{ textAlign: "center", marginBottom: 24, width: "100%", maxWidth: 900 }}>
            <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--text)", margin: 0 }}>
              Registrar erro de separação
            </h1>
            <p style={{ color: "var(--text-muted)", fontSize: 14, marginTop: 6 }}>
              {!loggedOperator ? "Digite seu código para começar." : "Preencha as informações abaixo."}
            </p>
          </div>
        )}

        {!loggedOperator && (
          <div className={`kiosk-terminal-wrap ${shake ? "shake" : ""}`}>
            <div className="kiosk-terminal-title">Digite seu código</div>
            <div className="kiosk-terminal-dots">
              {dots.map((filled, i) => (
                <div key={i} className={`kiosk-dot ${filled ? "filled" : ""}`} />
              ))}
            </div>
            <div className="kiosk-keypad">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
                <button key={d} className="kiosk-key" onClick={() => handleDigit(d)}>{d}</button>
              ))}
              <button className="kiosk-key kiosk-key-muted" onClick={handleBackspace}>⌫</button>
              <button className="kiosk-key" onClick={() => handleDigit("0")}>0</button>
              <button className="kiosk-key kiosk-key-primary" onClick={handleLogin}>OK</button>
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
            <div className="kiosk-confirm-icon" style={{ background: "var(--ok-soft)", color: "var(--ok)" }}>✓</div>
            <div className="kiosk-confirm-title">Erro registrado</div>
            <div className="kiosk-confirm-sub">{confirmation.errorType}</div>
          </div>
        )}

        {loggedOperator && !confirmation && (
          <div className="kiosk-logged">
            <div className="kiosk-operator-bar">
              <div className="kiosk-operator-info">
                <div className="kiosk-operator-avatar" style={{ background: "var(--danger)", color: "#fff" }}>
                  {loggedOperator.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="kiosk-operator-name">{loggedOperator.name}</div>
                  <div className="kiosk-operator-role">{loggedOperator.role} · #{loggedOperator.code}</div>
                </div>
              </div>
              <button className="kiosk-operator-change" onClick={reset}>Trocar operador</button>
            </div>

            <div className="kiosk-activities">
              <div className="kiosk-error-block">
                <div className="kiosk-error-step">
                  <span className="kiosk-error-step-num">1</span>
                  <span className="kiosk-error-step-title">É pedido ou transferência?</span>
                </div>
                <div className="kiosk-error-row-2">
                  <button
                    className={`kiosk-toggle-btn ${orderType === "pedido" ? "active" : ""}`}
                    onClick={() => {
                      bump();
                      setOrderType("pedido");
                      setTransferZone("");
                    }}
                  >
                    📦 Pedido
                  </button>
                  <button
                    className={`kiosk-toggle-btn ${orderType === "transferencia" ? "active" : ""}`}
                    onClick={() => {
                      bump();
                      setOrderType("transferencia");
                    }}
                  >
                    🔄 Transferência
                  </button>
                </div>

                {orderType === "transferencia" && (
                  <div style={{ marginTop: 12 }}>
                    <div
                      style={{
                        fontSize: 12.5,
                        fontWeight: 600,
                        color: "var(--text-muted)",
                        marginBottom: 8,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                      }}
                    >
                      Zona da transferência
                    </div>
                    <div className="kiosk-error-row-2">
                      {TRANSFER_ZONES.map((z) => (
                        <button
                          key={z}
                          className={`kiosk-toggle-btn ${transferZone === z ? "active" : ""}`}
                          onClick={() => {
                            bump();
                            setTransferZone(z);
                          }}
                        >
                          {z}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {orderType && (
                  <input
                    className="kiosk-field"
                    style={{
                      marginTop: 10,
                      fontFamily: "var(--font-mono)",
                      letterSpacing: 3,
                      textAlign: "center",
                      fontSize: 22,
                    }}
                    placeholder={`4 últimos dígitos ${orderType === "pedido" ? "do pedido" : "da transferência"}`}
                    value={orderNumber}
                    maxLength={4}
                    onChange={(e) => {
                      bump();
                      setOrderNumber(e.target.value.replace(/\D/g, "").slice(0, 4));
                    }}
                    autoFocus={orderType === "pedido" || transferZone !== ""}
                  />
                )}
              </div>

              <div className="kiosk-error-block">
                <div className="kiosk-error-step">
                  <span className="kiosk-error-step-num">2</span>
                  <span className="kiosk-error-step-title">Quem errou na separação?</span>
                </div>

                {errorOperator ? (
                  <div className="kiosk-error-selected-operator">
                    <div className="kiosk-error-selected-info">
                      <div className="kiosk-error-selected-avatar">
                        {errorOperator.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="kiosk-error-selected-name">{errorOperator.name}</div>
                        <div className="kiosk-error-selected-role">
                          {errorOperator.role} · #{errorOperator.code}
                        </div>
                      </div>
                    </div>
                    <button
                      className="kiosk-btn-small-danger"
                      onClick={() => {
                        bump();
                        setErrorOperatorCode("");
                      }}
                    >
                      Trocar
                    </button>
                  </div>
                ) : (
                  <div className="kiosk-error-operator-input">
                    <input
                      className="kiosk-field"
                      style={{
                        fontFamily: "var(--font-mono)",
                        letterSpacing: 2,
                        textAlign: "center",
                        fontSize: 18,
                        flex: 1,
                      }}
                      placeholder="Código (ex: 101)"
                      value={errorOperatorCode}
                      maxLength={4}
                      onChange={(e) => {
                        bump();
                        setErrorOperatorCode(e.target.value.replace(/\D/g, "").slice(0, 4));
                      }}
                    />
                    <button
                      className="kiosk-btn kiosk-btn-secondary"
                      onClick={() => {
                        bump();
                        setOperatorSearch("");
                        setShowOperatorPicker(true);
                      }}
                      style={{ padding: "14px 18px" }}
                    >
                      Ver lista
                    </button>
                  </div>
                )}
              </div>

              <div className="kiosk-error-block">
                <div className="kiosk-error-step">
                  <span className="kiosk-error-step-num">3</span>
                  <span className="kiosk-error-step-title">O que aconteceu?</span>
                </div>
                {errorTypes.length > 0 ? (
                  <div className="kiosk-error-grid">
                    {errorTypes.map((t) => (
                      <button
                        key={t.name}
                        className="kiosk-error-card"
                        onClick={() => reportError(t.name)}
                        disabled={busy}
                      >
                        <span className="kiosk-error-icon">{errorIcon(t.name)}</span>
                        <span className="kiosk-error-name">{t.name}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="kiosk-form-empty">
                    Nenhum tipo de erro cadastrado. Peça ao admin pra adicionar em "Equipe".
                  </p>
                )}
              </div>

              <div className="kiosk-error-block">
                <div className="kiosk-error-step">
                  <span className="kiosk-error-step-num">4</span>
                  <span className="kiosk-error-step-title">Observação (opcional)</span>
                </div>
                <textarea
                  className="kiosk-field kiosk-field-textarea"
                  placeholder="Descreva o problema se precisar..."
                  value={note}
                  onChange={(e) => {
                    bump();
                    setNote(e.target.value);
                  }}
                  rows={2}
                />
              </div>

              {msg && <p className="kiosk-form-error" style={{ marginTop: 14 }}>{msg}</p>}
            </div>
          </div>
        )}
      </main>

      {showOperatorPicker && (
        <div className="kiosk-modal-backdrop" onClick={() => setShowOperatorPicker(false)}>
          <div className="kiosk-modal" ref={modalRef} onClick={(e) => e.stopPropagation()}>
            <div className="kiosk-modal-header">
              <div>
                <div className="kiosk-modal-title">Quem errou?</div>
                <div className="kiosk-modal-sub">Escolha o operador responsável pelo erro</div>
              </div>
              <button
                className="kiosk-modal-close"
                onClick={() => setShowOperatorPicker(false)}
                aria-label="Fechar"
              >
                ✕
              </button>
            </div>

            <div className="kiosk-modal-body">
              <input
                className="kiosk-field"
                placeholder="🔍 Buscar por nome ou código..."
                value={operatorSearch}
                onChange={(e) => setOperatorSearch(e.target.value)}
                autoFocus
              />
              <div className="kiosk-operator-picker-list">
                {filteredOperators.length === 0 ? (
                  <p className="kiosk-form-empty">Nenhum operador encontrado.</p>
                ) : (
                  filteredOperators.map((op) => (
                    <button
                      key={op.code}
                      className="kiosk-operator-picker-item"
                      onClick={() => {
                        bump();
                        setErrorOperatorCode(op.code);
                        setShowOperatorPicker(false);
                        setOperatorSearch("");
                      }}
                    >
                      <div className="kiosk-operator-picker-avatar">
                        {op.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="kiosk-operator-picker-info">
                        <div className="kiosk-operator-picker-name">{op.name}</div>
                        <div className="kiosk-operator-picker-role">
                          {op.role} · #{op.code}
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}