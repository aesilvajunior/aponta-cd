import React, { useState } from "react";

export default function AdminGate({ correctPin, onUnlock }) {
  const [attempt, setAttempt] = useState("");
  const [error, setError] = useState("");

  function submit() {
    if (attempt === correctPin) {
      setError("");
      setAttempt("");
      onUnlock();
    } else {
      setError("PIN incorreto.");
      setAttempt("");
    }
  }

  return (
    <div>
      <h1 className="page-title">Área restrita</h1>
      <p className="page-sub">As métricas e a configuração da equipe são visíveis apenas para o administrador.</p>
      <div className="card" style={{ width: 280 }}>
        <input
          type="password"
          className="field"
          style={{ width: "100%", textAlign: "center", fontSize: 22, letterSpacing: 6, marginBottom: 12, fontFamily: "var(--font-mono)" }}
          placeholder="••••"
          value={attempt}
          onChange={(e) => setAttempt(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          autoFocus
        />
        <button className="btn btn-primary" onClick={submit}>
          Entrar
        </button>
        {error && <p style={{ color: "var(--danger)", fontSize: 13, textAlign: "center", marginTop: 10 }}>{error}</p>}
      </div>
    </div>
  );
}
