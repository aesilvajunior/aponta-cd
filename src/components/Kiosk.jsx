import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { fmtDuration, shiftFor } from "../lib/format";

export default function Kiosk({ operators, activities, refreshEntries }) {
  const [codeInput, setCodeInput] = useState("");
  const [loggedOperator, setLoggedOperator] = useState(null);
  const [session, setSession] = useState(null);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState("info");
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  async function loadSession(operatorCode) {
    const { data } = await supabase
      .from("active_sessions")
      .select("*")
      .eq("operator_code", operatorCode)
      .maybeSingle();
    setSession(data || null);
  }

  function reset() {
    setCodeInput("");
    setLoggedOperator(null);
    setSession(null);
    setMsg("");
  }

  function handleDigit(d) {
    if (codeInput.length < 4) setCodeInput(codeInput + d);
  }

  async function handleLogin() {
    const op = operators.find((o) => o.code === codeInput);
    if (!op) {
      setMsgType("error");
      setMsg("Código não encontrado. Verifique com o líder.");
      return;
    }
    setLoggedOperator(op);
    setMsg("");
    await loadSession(op.code);
  }

  async function startActivity(activityName) {
    if (busy) return;
    setBusy(true);
    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
      .from("active_sessions")
      .upsert(
        {
          operator_code: loggedOperator.code,
          operator_name: loggedOperator.name,
          activity: activityName,
          start_time: nowIso,
        },
        { onConflict: "operator_code" }
      )
      .select()
      .single();
    if (!error) setSession(data);
    setBusy(false);
  }

  async function finishActivity() {
    if (!session || busy) return;
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

    if (!insertError) {
      await supabase.from("active_sessions").delete().eq("operator_code", session.operator_code);
      setMsgType("success");
      setMsg(`Registrado: ${session.activity} — ${fmtDuration(duration)}`);
      setSession(null);
      refreshEntries?.();
    } else {
      setMsgType("error");
      setMsg("Erro ao salvar. Tente novamente.");
    }
    setBusy(false);
  }

  return (
    <div>
      <h1 className="page-title">Registrar atividade</h1>
      <p className="page-sub">Digite seu código de operador para iniciar ou finalizar uma atividade.</p>

      {!loggedOperator && (
        <div className="card" style={{ maxWidth: 320 }}>
          <div
            style={{
              textAlign: "center",
              fontFamily: "var(--font-mono)",
              fontSize: 28,
              letterSpacing: 6,
              minHeight: 36,
            }}
          >
            {codeInput || "----"}
          </div>
          <div className="keypad">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
              <button key={d} className="keypad-key" onClick={() => handleDigit(d)}>
                {d}
              </button>
            ))}
            <button className="keypad-key" onClick={() => setCodeInput("")}>
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

      {loggedOperator && (
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
                Em andamento
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
