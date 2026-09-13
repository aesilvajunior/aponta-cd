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
      <p className="page-sub">
        As métricas e a configuração da equipe são visíveis apenas para o administrador (líder do CD).
      </p>
      <div className="card" style={{ maxWidth: 320 }}>
        <input
          type="password"
          className="field"
          style={{ width: "100%", textAlign: "center", fontSize: 20, letterSpacing: 4, marginBottom: 12 }}
          placeholder="PIN"
          value={attempt}
          onChange={(e) => setAttempt(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          autoFocus
        />
        <button className="btn btn-primary" onClick={submit}>
          Entrar
        </button>
        {error && (
          <p style={{ color: "var(--danger)", fontSize: 13, textAlign: "center", marginTop: 10 }}>{error}</p>
        )}
      </div>
    </div>
  );
}
