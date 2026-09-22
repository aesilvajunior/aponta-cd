import React, { useState } from "react";
import { supabase } from "../supabaseClient";
import logo from "../assets/logo.png";

// ============================================================
// Tela de login do Aponta CD
// Login por e-mail + senha (Supabase Auth)
// ============================================================

export default function LoginScreen() {
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
      // Mensagens em português
      if (err.message.includes("Invalid login credentials")) {
        setError("E-mail ou senha incorretos.");
      } else if (err.message.includes("Email not confirmed")) {
        setError("E-mail ainda não confirmado. Fale com o administrador.");
      } else {
        setError(err.message || "Erro ao entrar. Tente novamente.");
      }
      return;
    }

    // Login OK → o AuthContext detecta e o App mostra o site
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <img src={logo} alt="Hidráulica Tropeiro" />
          <div>
            <div className="login-brand-title">Aponta CD</div>
            <div className="login-brand-sub">Hidráulica Tropeiro</div>
          </div>
        </div>

        <h1 className="login-title">Entrar</h1>
        <p className="login-sub">Acesso restrito à equipe</p>

        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
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
                style={{ paddingRight: 60 }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                style={{
                  position: "absolute",
                  right: 8,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "transparent",
                  border: "none",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                  fontSize: 11.5,
                  fontWeight: 600,
                  padding: "4px 8px",
                  fontFamily: "inherit",
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
            style={{ marginTop: 6 }}
            disabled={loading}
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <p style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 20, textAlign: "center", lineHeight: 1.5 }}>
          Não tem acesso? Fale com o administrador do sistema.
        </p>
      </div>

      <div className="login-footer">
        Hidráulica Tropeiro · Aponta CD
      </div>
    </div>
  );
}