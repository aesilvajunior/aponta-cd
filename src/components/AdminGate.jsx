import React, { useState } from "react";
import { signIn } from "../lib/auth";

export default function AdminGate() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!email.trim() || !password) return;
    setError("");
    setLoading(true);
    const { error } = await signIn(email.trim(), password);
    setLoading(false);
    if (error) {
      setError(
        error.message?.includes("Invalid login")
          ? "E-mail ou senha incorretos."
          : "Erro ao entrar. Tente novamente."
      );
    }
    // Se der certo, o App.jsx percebe sozinho via onAuthStateChange —
    // não precisa fazer nada aqui.
  }

  return (
    <div>
      <h1 className="page-title">Área restrita</h1>
      <p className="page-sub">As métricas e a configuração da equipe são visíveis apenas para administradores.</p>
      <div className="card" style={{ width: 300 }}>
        <input
          type="email"
          className="field"
          style={{ width: "100%", marginBottom: 10 }}
          placeholder="E-mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          autoFocus
        />
        <input
          type="password"
          className="field"
          style={{ width: "100%", marginBottom: 12 }}
          placeholder="Senha"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        <button className="btn btn-primary" onClick={submit} disabled={loading} style={{ width: "100%" }}>
          {loading ? "Entrando..." : "Entrar"}
        </button>
        {error && <p style={{ color: "var(--danger)", fontSize: 13, textAlign: "center", marginTop: 10 }}>{error}</p>}
      </div>
    </div>
  );
}
