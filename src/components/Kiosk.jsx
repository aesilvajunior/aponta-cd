import React, { useEffect, useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import { fmtDuration, fmtClock, shiftFor } from "../lib/format";

const CODE_LENGTH = 3;
const AUTO_RETURN_MS = 2500; // tempo mostrando a confirmação antes de devolver o teclado
const IDLE_TIMEOUT_MS = 20000; // tempo parado até o quiosque deslogar sozinho, por segurança

export default function Kiosk({ operators, activities, refreshEntries }) {
  const [codeInput, setCodeInput] = useState("");
  const [loggedOperator, setLoggedOperator] = useState(null);
  const [session, setSession] = useState(null);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState("info");
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);
  const [confirmation, setConfirmation] = useState(null); // { kind: "started"|"finished", activity, extra }

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

  // Devolve o teclado sozinho se alguém ficar logado sem mexer no quiosque
  // (prática padrão em terminais compartilhados de CD, evita ficar preso num operador).
  useEffect(() => {
    if (!loggedOperator) return;
    const iv = setInterval(() => {
      if (Date.now() - lastInteractionRef.current > IDLE_TIMEOUT_MS) {
        reset();
      }
    }, 1000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedOperator]);

  useEffect(() => {
    return () => {
      if (autoReturnTimeoutRef.current) clearTimeout(autoReturnTimeoutRef.current);
    };
  }, []);

  // Permite digitar o código com o teclado físico do computador,
  // não só clicando no teclado numérico na tela.
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

  async function loadSession(operatorCode) {
    const { data } = await supabase
      .from("active_sessions")
      .select("*")
      .eq("operator_code", operatorCode)
      .maybeSingle();
    setSession(data || null);
  }

  function reset() {
    if (autoReturnTimeoutRef.current) clearTimeout(autoReturnTimeoutRef.current);
    setCodeInput("");
    setLoggedOperator(null);
    setSession(null);
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

  async function handleLogin() {
    const current = codeInputRef.current;
    if (!current) return;
    const op = operators.find((o) => o.code === current);
    if (!op) {
      setMsgType("error");
      setMsg("Código não encontrado. Verifique com o líder.");
      triggerShake();
      setCodeInput("");
      return;
    }
    bump();
    setLoggedOperator(op);
    setMsg("");
    await loadSession(op.code);
  }

  async function startActivity(activityName) {
    if (busy) return;
    bump();
    setBusy(true);
    const nowIso = new Date().toISOString();
    const { error } = await supabase
      .from("active_sessions")
      .upsert(
        {
          operator_code: loggedOperator.code,
          operator_name: loggedOperator.name,
          activity: activityName,
          start_time: nowIso,
        },
        { onConflict: "operator_code" }
      );
    setBusy(false);
    if (!error) {
      // Não trava o quiosque num cronômetro: confirma e devolve o teclado.
      // O operador volta depois, digita o código de novo e finaliza.
      setConfirmation({ kind: "started", activity: activityName, time: fmtClock(nowIso) });
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

    const { error: insertError } = await supabase.from("entries").insert({
      operator_code: session.operator_code,
      operator_name: session.operator_name,
      activity: session.activity,
      start_time: session.start_time,
      end_time: endTime.toISOString(),
      duration_seconds: duration,
      shift: shiftFor(session.start_time),
    });

    setBusy(false);
    if (!insertError) {
      await supabase.from("active_sessions").delete().eq("operator_code", session.operator_code);
      refreshEntries?.();
      setSession(null);
      setConfirmation({ kind: "finished", activity: session.activity, extra: fmtDuration(duration) });
      autoReturnTimeoutRef.current = setTimeout(reset, AUTO_RETURN_MS);
    } else {
      setMsgType("error");
      setMsg("Erro ao salvar. Tente novamente.");
    }
  }

  return (
    <div onClick={bump}>
      <h1 className="page-title">Registrar atividade</h1>
      <p className="page-sub">
        Digite seu código de operador (3 dígitos) para iniciar ou finalizar uma atividade. Você pode usar
        o teclado numérico na tela ou o teclado do computador — Backspace apaga, Enter confirma. O
        quiosque libera sozinho depois de um tempo parado, para o próximo operador usar.
      </p>

      {!loggedOperator && (
        <div className={`card ${shake ? "shake" : ""}`} style={{ maxWidth: 320 }}>
          <div
            style={{
              textAlign: "center",
              fontFamily: "var(--font-mono)",
              fontSize: 28,
              letterSpacing: 10,
              minHeight: 36,
            }}
          >
            {codeInput.padEnd(CODE_LENGTH, "\u2013").split("").join(" ")}
          </div>
          <div className="keypad">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
              <button key={d} className="keypad-key" onClick={() => handleDigit(d)}>
                {d}
              </button>
            ))}
            <button className="keypad-key" onClick={() => { bump(); setCodeInput(""); }}>
              C
            </button>
            <button className="keypad-key" onClick={() => handleDigit("0")}>
              0
            </button>
            <button
              className="keypad-key"
              style={{ background: "var(--accent)", color: "#1a1d20" }}
              onClick={handleLogin}
            >
              OK
            </button>
          </div>
          {msg && (
            <p style={{ color: "var(--danger)", fontSize: 13, textAlign: "center" }}>{msg}</p>
          )}
        </div>
      )}

      {loggedOperator && confirmation && (
        <div className="card" style={{ maxWidth: 420, textAlign: "center" }}>
          <div style={{ fontSize: 34, marginBottom: 6 }}>{confirmation.kind === "started" ? "▶" : "✓"}</div>
          {confirmation.kind === "started" ? (
            <>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 19 }}>
                {confirmation.activity} iniciada
              </div>
              <div style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 4 }}>
                às {confirmation.time} · volte depois e digite seu código de novo para finalizar
              </div>
            </>
          ) : (
            <>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 19 }}>
                {confirmation.activity} finalizada
              </div>
              <div style={{ color: "var(--success)", fontSize: 15, marginTop: 4 }}>
                Duração: {confirmation.extra}
              </div>
            </>
          )}
          <div style={{ color: "var(--text-muted)", fontSize: 11.5, marginTop: 14 }}>
            Devolvendo o teclado...
          </div>
        </div>
      )}

      {loggedOperator && !confirmation && (
        <div className="card" style={{ maxWidth: 480 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 20 }}>{loggedOperator.name}</div>
              <div style={{ color: "var(--text-muted)", fontSize: 12 }}>
                {loggedOperator.role} · código {loggedOperator.code}
              </div>
            </div>
            <button className="btn-small" onClick={reset}>
              Trocar
            </button>
          </div>

          {!session && (
            <>
              <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 8 }}>
                Selecione a atividade a iniciar:
              </p>
              <div className="activity-grid">
                {activities.map((a) => (
                  <div key={a.name} className="activity-btn" onClick={() => startActivity(a.name)}>
                    {a.name}
                  </div>
                ))}
              </div>
            </>
          )}

          {session && (
            <div style={{ textAlign: "center", padding: "10px 0" }}>
              <div style={{ color: "var(--text-muted)", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>
                Em andamento desde {fmtClock(session.start_time)}
              </div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 22, margin: "6px 0" }}>
                {session.activity}
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 34, color: "var(--accent)", margin: "10px 0" }}>
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
                color: msgType === "error" ? "var(--danger)" : "var(--success)",
                fontSize: 13,
                textAlign: "center",
                marginTop: 10,
              }}
            >
              {msg}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
