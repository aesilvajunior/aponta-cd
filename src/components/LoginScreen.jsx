import React, { useState } from "react";
import { supabase } from "../supabaseClient";
import BrandMark from "./BrandMark";

export default function LoginScreen({ onBackToLanding }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setError("");

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return setError("Digite seu e-mail.");
    if (!password) return setError("Digite sua senha.");

    setLoading(true);
    const { error: err } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });
    setLoading(false);

    if (err) {
      if (err.message.includes("Invalid login credentials")) {
        setError("E-mail ou senha incorretos.");
      } else if (err.message.includes("Email not confirmed")) {
        setError("E-mail ainda não confirmado. Fale com o administrador.");
      } else {
        setError(err.message || "Erro ao entrar. Tente novamente.");
      }
      return;
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand" style={{ justifyContent: "center" }}>
          <BrandMark variant="lockup" />
        </div>

        <h1 className="login-title">Entrar</h1>
        <p className="login-sub">Acesso restrito à equipe</p>

        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label className="login-label">E-mail</label>
            <input
              type="email"
              className="login-field"
              placeholder="seuemail@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
              autoComplete="email"
              disabled={loading}
            />
          </div>

          <div>
            <label className="login-label">Senha</label>
            <div style={{ position: "relative" }}>
              <input
                type={showPassword ? "text" : "password"}
                className="login-field"
                placeholder="Sua senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                disabled={loading}
                style={{ paddingRight: 80 }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                style={{
                  position: "absolute",
                  right: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "transparent",
                  border: "none",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "6px 10px",
                  fontFamily: "inherit",
                  letterSpacing: "0.05em",
                  borderRadius: 6,
                }}
              >
                {showPassword ? "OCULTAR" : "MOSTRAR"}
              </button>
            </div>
          </div>

          {error && (
            <div className="login-error">{error}</div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            style={{ marginTop: 8 }}
            disabled={loading}
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <p style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 22, textAlign: "center", lineHeight: 1.5 }}>
          Não tem acesso? Fale com o administrador do sistema.
        </p>
        {onBackToLanding && (
          <button
            type="button"
            className="btn-small"
            style={{ width: "100%", marginTop: 12, justifyContent: "center" }}
            onClick={onBackToLanding}
          >
            ← Voltar para a apresentação
          </button>
        )}
      </div>

      <div className="login-footer">
        Aponta CD
      </div>
    </div>
  );
}