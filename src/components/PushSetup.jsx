import React, { useEffect, useState } from "react";
import {
  isPushSupported,
  getPushPermission,
  isPushEnabled,
  requestPushPermission,
  disablePush,
} from "../lib/pushNotifications";
import { IconVolume2, IconVolumeX, IconX, IconAlertCircle } from "./Icons";

export default function PushSetup() {
  const [supported, setSupported] = useState(true);
  const [permission, setPermission] = useState("default");
  const [enabled, setEnabled] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem("aponta_push_dismissed") === "1";
    } catch {
      return false;
    }
  });
  const [working, setWorking] = useState(false);

  useEffect(() => {
    setSupported(isPushSupported());
    setPermission(getPushPermission());
    setEnabled(isPushEnabled());
  }, []);

  async function handleEnable() {
    setWorking(true);
    const { granted } = await requestPushPermission();
    setPermission(getPushPermission());
    setEnabled(granted === true);
    setWorking(false);
  }

  function handleDisable() {
    disablePush();
    setEnabled(false);
  }

  function handleDismiss() {
    try { localStorage.setItem("aponta_push_dismissed", "1"); } catch {}
    setDismissed(true);
  }

  if (!supported) return null;
  if (permission === "denied") return null;
  if (dismissed && !enabled) return null;

  // Se já está ativado, mostra um chip pequeno no canto
  if (enabled) {
    return (
      <button
        onClick={handleDisable}
        title="Notificações ativadas. Clique para desativar."
        style={{
          position: "fixed",
          bottom: 20,
          left: 20,
          background: "var(--surface)",
          color: "var(--ok)",
          border: "1px solid var(--ok)",
          borderRadius: 10,
          padding: "8px 12px",
          fontSize: 12,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontFamily: "inherit",
          fontWeight: 600,
          boxShadow: "var(--shadow-md)",
          zIndex: 90,
        }}
      >
        <IconVolume2 size={14} />
        Notificações ativas
      </button>
    );
  }

  // Banner pedindo ativação
  return (
    <div
      style={{
        position: "fixed",
        bottom: 20,
        left: 20,
        right: 20,
        maxWidth: 480,
        background: "var(--bg-elevated)",
        border: "1px solid var(--accent)",
        borderRadius: 14,
        padding: "14px 18px",
        display: "flex",
        gap: 12,
        alignItems: "center",
        boxShadow: "var(--shadow-xl)",
        zIndex: 90,
      }}
    >
      <div style={{ color: "var(--accent)", display: "flex", flexShrink: 0 }}>
        <IconAlertCircle size={20} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>
          Ativar notificações
        </div>
        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
          Avisar quando um pedido entra na mesa de conferência
        </div>
      </div>
      <button
        className="btn-small btn-excel"
        onClick={handleEnable}
        disabled={working}
        style={{ flexShrink: 0 }}
      >
        <IconVolume2 size={13} /> Ativar
      </button>
      <button
        onClick={handleDismiss}
        title="Não mostrar novamente"
        style={{
          background: "transparent",
          border: "none",
          color: "var(--text-faint)",
          cursor: "pointer",
          padding: 6,
          display: "flex",
          flexShrink: 0,
        }}
      >
        <IconX size={14} />
      </button>
    </div>
  );
}