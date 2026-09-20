import React, { useEffect, useRef, useState } from "react";
import { fetchActiveSessionFor, startSession, finishSession } from "../lib/api";
import { fmtDuration, fmtClock, fmtDate, shiftFor } from "../lib/format";
import { getStationName, promptForStationName } from "../lib/station";
import logo from "../assets/logo.png";

const CODE_LENGTH = 3;
const AUTO_RETURN_MS = 2200;
const IDLE_TIMEOUT_MS = 20000;
const TRANSFER_TYPES = ["AP", "ZN"];

export default function Kiosk({ operators, activities, refreshEntries }) {
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

  // Sub-formulário de informação extra ao iniciar, exigido só pelas
  // atividades marcadas com requires_order_info — o formato do formulário
  // (pedido/cliente/transferência OU veículo/placa) depende do
  // extra_field_type configurado pelo admin para aquela atividade.
  const [orderFormActivity, setOrderFormActivity] = useState(null);
  const [orderFieldType, setOrderFieldType] = useState("pedido");
  const [orderBranch, setOrderBranch] = useState(null); // null | "pedido" | "transferencia"
  const [orderNumber, setOrderNumber] = useState("");
  const [customerFirstName, setCustomerFirstName] = useState("");
  const [customerLastName, setCustomerLastName] = useState("");
  const [transferType, setTransferType] = useState("");
  const [vehicleInput, setVehicleInput] = useState("");
  const [plateInput, setPlateInput] = useState("");
  const [orderError, setOrderError] = useState("");
  const [stationName, setStationNameState] = useState(getStationName());

  function editStation() {
    setStationNameState(promptForStationName());
  }

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

  // Devolve o teclado sozinho se alguém ficar logado sem mexer no quiosque.
  useEffect(() => {
    if (!loggedOperator) return;
    const iv = setInterval(() => {
      if (Date.now() - lastInteractionRef.current > IDLE_TIMEOUT_MS) reset();
    }, 1000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedOperator]);

  // Limpa qualquer timer pendente ao desmontar (evita setState depois de
  // trocar de aba no meio da contagem de "devolvendo o teclado").
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
    cancelOrderForm();
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
    // Busca a sessão ANTES de logar visualmente — evita piscar a tela de
    // "escolher atividade" por um instante quando já existe uma em andamento.
    const { data, error } = await fetchActiveSessionFor(op.code);
    if (error) {
      setMsgType("error");
      setMsg("Erro ao verificar sessão. Tente de novo.");
      setCheckingLogin(false);
      return;
    }
    setSession(data || null);
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
      vehicle: extra.vehicle || null,
      plate: extra.plate || null,
      station: stationName || null,
    });
    setBusy(false);
    if (!error) {
      setConfirmation({
        kind: "started",
        activity: activityName,
        time: fmtClock(startedAt),
        detail: extra.transferType || extra.customerName || (extra.vehicle ? `${extra.vehicle} · ${extra.plate}` : null),
      });
      autoReturnTimeoutRef.current = setTimeout(reset, AUTO_RETURN_MS);
    } else {
      setMsgType("error");
      setMsg(`Erro ao iniciar. ${error.message || "Tente novamente."}`);
    }
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
      setVehicleInput("");
      setPlateInput("");
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
    setVehicleInput("");
    setPlateInput("");
    setOrderError("");
  }

  async function confirmOrderStart() {
    const activityName = orderFormActivity;

    if (orderFieldType === "veiculo") {
      if (!vehicleInput.trim()) {
        setOrderError("Digite o veículo.");
        return;
      }
      if (!plateInput.trim()) {
        setOrderError("Digite a placa.");
        return;
      }
      const extra = { vehicle: vehicleInput.trim(), plate: plateInput.trim().toUpperCase() };
      cancelOrderForm();
      await startActivity(activityName, extra);
      return;
    }

    // Tipo "pedido": primeiro escolhe Pedido ou Transferência, depois
    // preenche os campos específicos de cada um.
    if (orderBranch === "pedido") {
      if (!/^\d{4}$/.test(orderNumber)) {
        setOrderError("Digite os 4 últimos dígitos do pedido.");
        return;
      }
      if (!customerFirstName.trim() || !customerLastName.trim()) {
        setOrderError("Digite o nome e o sobrenome do cliente.");
        return;
      }
      const extra = {
        orderNumber,
        customerName: `${customerFirstName.trim()} ${customerLastName.trim()}`,
      };
      cancelOrderForm();
      await startActivity(activityName, extra);
      return;
    }

    if (orderBranch === "transferencia") {
      if (!transferType) {
        setOrderError("Selecione se é AP ou ZN.");
        return;
      }
      const extra = { transferType };
      cancelOrderForm();
      await startActivity(activityName, extra);
      return;
    }

    setOrderError("Selecione se é Pedido ou Transferência.");
  }

  async function finishActivity() {
    if (!session || busy) return;
    bump();
    setBusy(true);
    const duration = Math.round((Date.now() - new Date(session.start_time).getTime()) / 1000);
    const { error } = await finishSession(session, duration, shiftFor(session.start_time), noteInput.trim());
    setBusy(false);
    if (!error) {
      refreshEntries?.();
      setSession(null);
      setConfirmation({ kind: "finished", activity: session.activity, extra: fmtDuration(duration) });
      autoReturnTimeoutRef.current = setTimeout(reset, AUTO_RETURN_MS);
    } else {
      setMsgType("error");
      setMsg(`Erro ao salvar. ${error.message || "Tente novamente."}`);
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
            <div className="keypad" style={{ opacity: checkingLogin ? 0.55 : 1, pointerEvents: checkingLogin ? "none" : "auto" }}>
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
            <div style={{ color: "var(--text-muted)", fontSize: 12.5, marginTop: 6 }}>
              {confirmation.kind === "started"
                ? `às ${confirmation.time}${confirmation.detail ? ` · ${confirmation.detail}` : ""} · volte depois para finalizar`
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

            {!session && activities.length > 0 && !orderFormActivity && (
              <div className="activity-grid" style={{ opacity: busy ? 0.6 : 1, pointerEvents: busy ? "none" : "auto" }}>
                {activities.map((a) => (
                  <div key={a.name} className="activity-btn" onClick={() => handleActivityClick(a)}>
                    {a.name}
                  </div>
                ))}
              </div>
            )}

            {!session && orderFormActivity && (
              <div>
                <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 10 }}>
                  {orderFormActivity} — {orderFieldType === "veiculo" ? "informe o veículo:" : "informe o pedido:"}
                </p>

                {orderFieldType === "veiculo" ? (
                  <>
                    <input
                      className="field"
                      style={{ width: "100%", marginBottom: 10 }}
                      placeholder="Veículo (ex: Volkswagen)"
                      value={vehicleInput}
                      onChange={(e) => { bump(); setVehicleInput(e.target.value); }}
                    />
                    <input
                      className="field"
                      style={{ width: "100%", marginBottom: 10, fontFamily: "var(--font-mono)", letterSpacing: 1, textTransform: "uppercase" }}
                      placeholder="Placa"
                      value={plateInput}
                      onChange={(e) => { bump(); setPlateInput(e.target.value); }}
                    />
                  </>
                ) : (
                  <>
                    {orderBranch === null && (
                      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                        <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => { bump(); setOrderBranch("pedido"); }}>
                          Pedido
                        </button>
                        <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => { bump(); setOrderBranch("transferencia"); }}>
                          Transferência
                        </button>
                      </div>
                    )}

                    {orderBranch === "pedido" && (
                      <>
                        <input
                          className="field"
                          style={{ width: "100%", marginBottom: 10, fontFamily: "var(--font-mono)", letterSpacing: 2, textAlign: "center", fontSize: 18 }}
                          placeholder="4 últimos dígitos do pedido"
                          value={orderNumber}
                          maxLength={4}
                          onChange={(e) => { bump(); setOrderNumber(e.target.value.replace(/\D/g, "").slice(0, 4)); }}
                        />
                        <input
                          className="field"
                          style={{ width: "100%", marginBottom: 10 }}
                          placeholder="Nome do cliente"
                          value={customerFirstName}
                          onChange={(e) => { bump(); setCustomerFirstName(e.target.value); }}
                        />
                        <input
                          className="field"
                          style={{ width: "100%", marginBottom: 10 }}
                          placeholder="Sobrenome do cliente"
                          value={customerLastName}
                          onChange={(e) => { bump(); setCustomerLastName(e.target.value); }}
                        />
                      </>
                    )}

                    {orderBranch === "transferencia" && (
                      <div className="activity-grid" style={{ marginBottom: 10 }}>
                        {TRANSFER_TYPES.map((t) => (
                          <div
                            key={t}
                            className="activity-btn"
                            style={transferType === t ? { borderColor: "var(--accent)", background: "var(--accent-dim)" } : {}}
                            onClick={() => { bump(); setTransferType(t); }}
                          >
                            {t}
                          </div>
                        ))}
                      </div>
                    )}

                    {orderBranch && (
                      <button
                        className="btn-small"
                        style={{ marginBottom: 10 }}
                        onClick={() => { bump(); setOrderBranch(null); setOrderError(""); }}
                      >
                        ← Trocar Pedido/Transferência
                      </button>
                    )}
                  </>
                )}

                {orderError && <p className="terminal-error" style={{ marginBottom: 10 }}>{orderError}</p>}

                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn-small" onClick={cancelOrderForm} disabled={busy}>Cancelar</button>
                  <button className="btn btn-primary" style={{ flex: 1 }} onClick={confirmOrderStart} disabled={busy}>
                    {busy ? "Iniciando..." : "Iniciar"}
                  </button>
                </div>
              </div>
            )}

            {!session && activities.length === 0 && (
              <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
                Nenhuma atividade cadastrada ainda. Peça ao administrador para adicionar em "Equipe".
              </p>
            )}

            {session && (
              <div style={{ textAlign: "center", padding: "6px 0" }}>
                <div style={{ color: "var(--text-muted)", fontSize: 11.5 }}>
                  em andamento desde {fmtClock(session.start_time)}
                </div>
                <div style={{ fontSize: 18, fontWeight: 600, margin: "4px 0 8px 0" }}>{session.activity}</div>
                {(session.order_number || session.customer_name || session.transfer_type || session.vehicle) && (
                  <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 8 }}>
                    {session.transfer_type && <div>Tipo: {session.transfer_type}</div>}
                    {session.customer_name && <div>Cliente: {session.customer_name}</div>}
                    {session.order_number && <div>Pedido: {session.order_number}</div>}
                    {session.vehicle && <div>Veículo: {session.vehicle}</div>}
                    {session.plate && <div>Placa: {session.plate}</div>}
                  </div>
                )}
                <div className="stat-num" style={{ fontSize: 32, marginBottom: 14 }}>
                  {fmtDuration(Math.round((now - new Date(session.start_time).getTime()) / 1000))}
                </div>
                <textarea
                  className="field"
                  placeholder="Observação (opcional) — ex: atraso por falta de material"
                  value={noteInput}
                  onChange={(e) => { bump(); setNoteInput(e.target.value); }}
                  rows={2}
                  style={{ width: "100%", resize: "none", marginBottom: 12, fontFamily: "inherit" }}
                />
                <button className="btn btn-danger" onClick={finishActivity} disabled={busy}>
                  {busy ? "Salvando..." : "Finalizar atividade"}
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
          <div
            onClick={editStation}
            style={{ marginTop: 14, fontSize: 10.5, color: "var(--text-faint)", cursor: "pointer" }}
            title="Clique para nomear esta estação/terminal"
          >
            {stationName ? `📍 ${stationName}` : "📍 nomear esta estação"}
          </div>
        </div>
      </div>
    </div>
  );
}
