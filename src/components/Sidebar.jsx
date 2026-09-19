import React from "react";
import logo from "../assets/logo.png";

export default function Sidebar({ tab, setTab, isAdmin, onLock, onResetKiosk }) {
  return (
    <nav className="sidebar">
      <div className="sidebar-brand">
        <img src={logo} alt="Hidráulica Tropeiro" />
        <div className="sidebar-brand-text">
          Aponta CD
          <span>Hidráulica Tropeiro</span>
        </div>
      </div>

      <div
        className={`nav-item ${tab === "kiosk" ? "active" : ""}`}
        onClick={() => {
          setTab("kiosk");
          onResetKiosk?.();
        }}
      >
        Registrar
      </div>
      <div className={`nav-item ${tab === "errors-kiosk" ? "active" : ""}`} onClick={() => setTab("errors-kiosk")}>
        Registrar Erro
      </div>
      <div className={`nav-item ${tab === "panel" ? "active" : ""}`} onClick={() => setTab("panel")}>
        Painel
      </div>
      <div className={`nav-item ${tab === "manual" ? "active" : ""}`} onClick={() => setTab("manual")}>
        Lançar registro
      </div>
      <div className={`nav-item ${tab === "team" ? "active" : ""}`} onClick={() => setTab("team")}>
        Equipe
      </div>

      {isAdmin && (
        <div style={{ marginTop: "auto", padding: "12px 22px" }}>
          <button className="btn-small" onClick={onLock} style={{ width: "100%" }}>
            Sair do admin
          </button>
        </div>
      )}
    </nav>
  );
}
