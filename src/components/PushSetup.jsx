import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  isPushSupported,
  getPushPermission,
  isPushEnabled,
  requestPushPermission,
  disablePush,
  notifySlaBottleneck,
} from "../lib/pushNotifications";
import { fetchPauseLogs, fetchTeamGoals } from "../lib/api";
import { fetchConferenceQueue } from "../lib/conference";
import {
  loadSlaConfig,
  readLocalSlaConfig,
  evaluateAllSlaBottlenecks,
} from "../lib/slaMonitor";
import { IconVolume2, IconX, IconAlertCircle, IconAlertTriangle } from "./Icons";

export default function PushSetup({
  activeSessions = [],
  entries = [],
  isLeader = false,
  onNavigate,
}) {
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

  // Monitor proativo de gargalos (SLA)
  const [slaConfig, setSlaConfig] = useState(() => readLocalSlaConfig());
  const [slaAlerts, setSlaAlerts] = useState([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const lastNotifiedRef = useRef(new Map()); // alert.id -> timestamp

  useEffect(() => {
    setSupported(isPushSupported());
    setPermission(getPushPermission());
    setEnabled(isPushEnabled());
    loadSlaConfig().then(setSlaConfig).catch(() => {});
  }, []);

  const checkBottlenecks = useCallback(async () => {
    if (!slaConfig?.enabled) {
      setSlaAlerts([]);
      return;
    }
    try {
      const [pausesRes, confRes, goalsRes] = await Promise.all([
        fetchPauseLogs({ days: 1, limit: 100 }).catch(() => ({ data: [] })),
        fetchConferenceQueue({ includeFinished: false }).catch(() => ({ data: [] })),
        fetchTeamGoals().catch(() => ({ data: [] })),
      ]);
      const openPauses = (pausesRes?.data || []).filter((p) => !p.resumed_at);
      const alerts = evaluateAllSlaBottlenecks({
        activeSessions,
        openPauseLogs: openPauses,
        conferenceQueue: confRes?.data || [],
        entries,
        teamGoals: goalsRes?.data || [],
        cfg: slaConfig,
        now: Date.now(),
      });
      setSlaAlerts(alerts);

      // Dispara notificação push proativa para o líder (com cooldown por alerta)
      if (isPushEnabled() && alerts.length > 0) {
        const cooldownMs = Math.max(1, Number(slaConfig.cooldownMinutes) || 15) * 60 * 1000;
        const now = Date.now();
        alerts.forEach((a) => {
          const prev = lastNotifiedRef.current.get(a.id) || 0;
          if (now - prev >= cooldownMs) {
            lastNotifiedRef.current.set(a.id, now);
            notifySlaBottleneck(a, (clicked) => {
              if (clicked?.tab && onNavigate) onNavigate(clicked.tab);
            });
          }
        });
      }
    } catch {
      /* melhor esforço */
    }
  }, [activeSessions, entries, slaConfig, onNavigate]);

  useEffect(() => {
    if (!enabled && !isLeader) return undefined;
    checkBottlenecks();
    const iv = setInterval(checkBottlenecks, 60 * 1000);
    return () => clearInterval(iv);
  }, [enabled, isLeader, checkBottlenecks]);

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
    setDrawerOpen(false);
  }

  function handleDismiss() {
    try { localStorage.setItem("aponta_push_dismissed", "1"); } catch {}
    setDismissed(true);
  }

  const hasAlerts = slaAlerts.length > 0;
  const hasCritical = slaAlerts.some((a) => a.severity === "critical");

  // Drawer flutuante com os gargalos SLA ativos
  const alertsPopover = drawerOpen && (
    <div
      style={{
        position: "fixed",
        bottom: 66,
        left: 20,
        width: 360,
        maxWidth: "calc(100vw - 40px)",
        background: "var(--bg-elevated)",
        border: `1px solid ${hasCritical ? "var(--danger)" : "var(--border-strong)"}`,
        borderRadius: 14,
        padding: 14,
        boxShadow: "var(--shadow-xl)",
        zIndex: 95,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <strong style={{ fontSize: 13.5, display: "flex", alignItems: "center", gap: 6 }}>
          <IconAlertTriangle size={15} /> Monitor de Gargalos (SLA)
        </strong>
        <button
          type="button"
          onClick={() => setDrawerOpen(false)}
          style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 4 }}
          aria-label="Fechar"
        >
          <IconX size={14} />
        </button>
      </div>

      {slaAlerts.length === 0 ? (
        <div style={{ fontSize: 12.5, color: "var(--ok)", padding: "8px 0" }}>
          ✓ Operação dentro do SLA (pausas, fila de conferência e turno sob controle).
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 260, overflowY: "auto" }}>
          {slaAlerts.map((a) => (
            <div
              key={a.id}
              style={{
                padding: "9px 11px",
                borderRadius: 10,
                background: a.severity === "critical" ? "var(--danger-soft)" : "var(--warning-soft)",
                border: `1px solid ${a.severity === "critical" ? "var(--danger)" : "var(--warning)"}`,
              }}
            >
              <div style={{ fontSize: 12.5, fontWeight: 700, color: a.severity === "critical" ? "var(--danger)" : "var(--text)" }}>
                {a.title}
              </div>
              <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}>{a.message}</div>
              {onNavigate && a.tab && (
                <button
                  type="button"
                  className="btn-small"
                  style={{ marginTop: 6, padding: "4px 8px", fontSize: 11 }}
                  onClick={() => {
                    onNavigate(a.tab);
                    setDrawerOpen(false);
                  }}
                >
                  Abrir tela →
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
        <button type="button" className="btn-small" style={{ fontSize: 11.5 }} onClick={checkBottlenecks}>
          Reavaliar agora
        </button>
        {enabled && (
          <button type="button" className="btn-small" style={{ fontSize: 11.5, color: "var(--danger)", borderColor: "var(--danger)" }} onClick={handleDisable}>
            Desativar push
          </button>
        )}
      </div>
    </div>
  );

  // Se já está ativado (ou se é líder com alertas SLA ativos), mostra chip com contador de gargalos
  if (enabled || (isLeader && hasAlerts)) {
    return (
      <>
        {alertsPopover}
        <button
          onClick={() => setDrawerOpen((v) => !v)}
          title={hasAlerts ? `${slaAlerts.length} alerta(s) de SLA ativo(s). Clique para ver.` : "Notificações e monitor de SLA ativos."}
          style={{
            position: "fixed",
            bottom: 20,
            left: 20,
            background: hasCritical ? "var(--danger)" : hasAlerts ? "var(--warning)" : "var(--surface)",
            color: hasAlerts ? "#fff" : "var(--ok)",
            border: `1px solid ${hasCritical ? "var(--danger)" : hasAlerts ? "var(--warning)" : "var(--ok)"}`,
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
          {hasAlerts ? <IconAlertTriangle size={14} /> : <IconVolume2 size={14} />}
          {hasAlerts
            ? `${slaAlerts.length} gargalo${slaAlerts.length > 1 ? "s" : ""} SLA`
            : "Notificações & SLA ativos"}
        </button>
      </>
    );
  }

  if (!supported) return null;
  if (permission === "denied") return null;
  if (dismissed && !enabled) return null;

  // Banner pedindo ativação
  return (
    <div
      style={{
        position: "fixed",
        bottom: 20,
        left: 20,
        right: 20,
        maxWidth: 500,
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
          Ativar notificações proativas (SLA)
        </div>
        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
          Avisar novos pedidos, pausas acima do limite, fila travada e queda de produtividade do turno
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
