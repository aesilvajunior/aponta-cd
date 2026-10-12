import React, { useState } from "react";
import { IconLock, IconShield } from "./Icons";
import { verifyAdminPin } from "../lib/api";

export default function AdminGate({ onUnlock }) {
  const [attempt, setAttempt] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  async function submit() {
    if (checking || attempt.trim().length < 4) return;
    setChecking(true);
    setError("");
    const { ok, error: verifyError } = await verifyAdminPin(attempt.trim());
    setChecking(false);
    setAttempt("");
    if (ok) {
      onUnlock();
    } else if (verifyError) {
      // O servidor bloqueia por alguns minutos depois de 5 erros seguidos
      setError(
        /tentativas/i.test(verifyError.message || "")
          ? verifyError.message
          : "Não foi possível verificar o PIN. Confira a conexão e tente de novo."
      );
    } else {
      setError("PIN incorreto.");
    }
  }

  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 40, gap: 20 }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            background: "var(--accent-soft)",
            color: "var(--accent)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <IconLock size={28} strokeWidth={1.5} />
        </div>

        <div style={{ textAlign: "center" }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", margin: 0, color: "var(--text)" }}>
            Área restrita
          </h1>
          <p style={{ fontSize: 13.5, color: "var(--text-muted)", marginTop: 6, maxWidth: 340 }}>
            Digite o PIN de administrador para continuar
          </p>
        </div>

        <div className="card" style={{ width: 320, padding: "28px 26px 24px 26px" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 18, color: "var(--text-faint)" }}>
            <IconShield size={18} strokeWidth={1.5} />
          </div>

          <input
            type="password"
            className="login-field"
            style={{
              width: "100%",
              textAlign: "center",
              fontSize: 26,
              letterSpacing: 12,
              fontFamily: "var(--font-mono)",
              fontWeight: 600,
              paddingTop: 14,
              paddingBottom: 14,
              marginBottom: 14,
            }}
            placeholder="PIN"
            value={attempt}
            onChange={(e) => setAttempt(e.target.value.replace(/\D/g, ""))}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            maxLength={8}
            inputMode="numeric"
            autoComplete="off"
            aria-label="PIN de administrador"
            autoFocus
          />

          <button className="btn btn-primary" onClick={submit} disabled={attempt.length < 4 || checking}>
            {checking ? "Verificando..." : "Entrar"}
          </button>

          {error && (
            <p role="alert" style={{
              color: "var(--danger)",
              fontSize: 12.5,
              textAlign: "center",
              marginTop: 12,
              marginBottom: 0,
              fontWeight: 500,
            }}>
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}