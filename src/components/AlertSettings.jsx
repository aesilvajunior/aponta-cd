import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import {
  fetchAlertSettings,
  updateAlertSettings,
  fetchAlertLog,
} from "../lib/api";
import { fmtClock, fmtDate } from "../lib/format";
import {
  IconRefresh,
  IconCheck,
  IconShield,
  IconX,
  IconVolume2,
  IconAlertTriangle,
  IconClock,
  IconTarget,
  IconPackage,
  IconClipboardCheck,
  IconMessageCircle,
} from "./Icons";

const ALERT_TYPES = [
  {
    field: "alert_late_enabled",
    icon: <IconAlertTriangle size={16} />,
    label: "Atividade demorada",
    description: "Quando uma atividade passa muito do tempo esperado",
    example: "⚠️ Atividade muito atrasada\nJoão Silva — Separação\nTempo: 45min (meta: 15min)",
  },
  {
    field: "alert_mesa_enabled",
    icon: <IconClipboardCheck size={16} />,
    label: "Mesa acumulada",
    description: "Quando a mesa de conferência passa do limite",
    example: "🔴 Mesa de conferência acumulando\n12 pedidos aguardando",
  },
  {
    field: "alert_missing_enabled",
    icon: <IconClock size={16} />,
    label: "Operador esquecido",
    description: "Sessão aberta há muito tempo sem finalizar",
    example: "👻 Sessão esquecida\nMaria Souza — Recebimento\nAberta há 5.2h",
  },
  {
    field: "alert_shortage_realtime_enabled",
    icon: <IconPackage size={16} />,
    label: "Falta registrada (tempo real)",
    description: "Avisa assim que uma falta é registrada no kiosk",
    example: "📦 Falta registrada\nProduto: PARAF-1234 (3un)\nPor: João Silva",
  },
  {
    field: "alert_conference_problem_enabled",
    icon: <IconAlertTriangle size={16} />,
    label: "Problema na conferência",
    description: "Quando um conferente reporta problema",
    example: "🚨 Problema na conferência\nPedido #1234 — Falta produto\nPor: Carlos Lima",
  },
  {
    field: "alert_goal_enabled",
    icon: <IconTarget size={16} />,
    label: "Meta da equipe atingida",
    description: "Quando uma equipe bate a meta do período",
    example: "🏆 Meta atingida!\nEquipe Manhã — 210 registros",
  },
];

export default function AlertSettings() {
  const [settings, setSettings] = useState({
    whatsapp_enabled: false,
    alert_late_multiplier: 3,
    alert_mesa_threshold: 10,
    alert_shortage_critical: true,
    alert_missing_hours: 4,
    alert_late_enabled: true,
    alert_mesa_enabled: true,
    alert_missing_enabled: true,
    alert_goal_enabled: false,
    alert_conference_problem_enabled: true,
    alert_shortage_realtime_enabled: false,
    message_header: "🚨 Aponta CD",
    quiet_hours_enabled: false,
    quiet_hours_start: 22,
    quiet_hours_end: 6,
  });
  const [log, setLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState(null);

  async function loadAll() {
    setLoading(true);
    const [{ data: s }, { data: l }] = await Promise.all([
      fetchAlertSettings(),
      fetchAlertLog({ limit: 100 }),
    ]);
    if (s) setSettings((prev) => ({ ...prev, ...s }));
    if (l) setLog(l);
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    const ch = supabase
      .channel("alert-settings")
      .on("postgres_changes", { event: "*", schema: "public", table: "alert_settings" }, loadAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "alert_log" }, loadAll)
      .subscribe();
    return () => supabase.removeChannel(ch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function set(field, value) {
    setSettings((s) => ({ ...s, [field]: value }));
  }

  async function save() {
    setSaving(true);
    setError("");
    const payload = {
      whatsapp_enabled: settings.whatsapp_enabled,
      alert_late_multiplier: Number(settings.alert_late_multiplier) || 3,
      alert_mesa_threshold: Number(settings.alert_mesa_threshold) || 10,
      alert_shortage_critical: !!settings.alert_shortage_critical,
      alert_missing_hours: Number(settings.alert_missing_hours) || 4,
      alert_late_enabled: !!settings.alert_late_enabled,
      alert_mesa_enabled: !!settings.alert_mesa_enabled,
      alert_missing_enabled: !!settings.alert_missing_enabled,
      alert_goal_enabled: !!settings.alert_goal_enabled,
      alert_conference_problem_enabled: !!settings.alert_conference_problem_enabled,
      alert_shortage_realtime_enabled: !!settings.alert_shortage_realtime_enabled,
      message_header: (settings.message_header || "").trim() || "🚨 Aponta CD",
      quiet_hours_enabled: !!settings.quiet_hours_enabled,
      quiet_hours_start: Number(settings.quiet_hours_start) || 22,
      quiet_hours_end: Number(settings.quiet_hours_end) || 6,
    };
    const { error: err } = await updateAlertSettings(payload);
    setSaving(false);
    if (err) return setError(err.message);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function sendTest() {
    setTestSending(true);
    setTestResult(null);
    try {
      const header = settings.message_header || "🚨 Aponta CD";
      const message = `${header}\n\n🔔 <b>Teste de alerta</b>\nSe você está vendo isso, os alertas estão funcionando perfeitamente!`;
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-telegram`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ text: message, alertType: "test" }),
        }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.ok === false) {
        throw new Error(json.error || `Erro HTTP ${res.status}`);
      }
      setTestResult({ ok: true, message: "Mensagem enviada! Verifica no Telegram." });
    } catch (e) {
      setTestResult({ ok: false, message: e.message });
    } finally {
      setTestSending(false);
    }
  }

  const enabledCount = ALERT_TYPES.filter((a) => settings[a.field]).length;

  return (
    <div>
      <div className="page-header-row" style={{ marginBottom: 22 }}>
        <div>
          <h1 className="page-title">Alertas Telegram</h1>
          <p className="page-sub" style={{ marginBottom: 0 }}>
            Receba notificações críticas no Telegram do gestor
          </p>
        </div>
        <button className="btn-small" onClick={loadAll}>
          <IconRefresh size={14} /> Atualizar
        </button>
      </div>

      {error && <div className="alert-card alert-danger" style={{ marginBottom: 20 }}>{error}</div>}

      {loading ? (
        <div className="schedule-empty">Carregando...</div>
      ) : (
        <>
          {/* MASTER SWITCH */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <input
                type="checkbox"
                checked={settings.whatsapp_enabled}
                onChange={(e) => set("whatsapp_enabled", e.target.checked)}
                disabled={saving}
                id="tg-enabled"
                style={{ width: 20, height: 20, cursor: "pointer" }}
              />
              <label htmlFor="tg-enabled" style={{ flex: 1, fontSize: 16, fontWeight: 700, cursor: "pointer" }}>
                {settings.whatsapp_enabled ? "✅ Alertas Telegram ativados" : "⏸ Alertas Telegram desativados"}
              </label>
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                {enabledCount} de {ALERT_TYPES.length} tipos ativos
              </div>
            </div>
          </div>

          {/* PERSONALIZAÇÃO DA MENSAGEM */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <IconMessageCircle size={16} /> Personalização da mensagem
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              <div>
                <label className="schedule-modal-label">Cabeçalho de todas as mensagens</label>
                <input
                  className="field"
                  style={{ width: "100%", fontSize: 15, fontFamily: "var(--font-mono)" }}
                  placeholder="🚨 Aponta CD"
                  value={settings.message_header || ""}
                  onChange={(e) => set("message_header", e.target.value)}
                  disabled={saving}
                  maxLength={40}
                />
                <p style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 6 }}>
                  Aparece no topo de todas as mensagens enviadas. Aceita emoji.
                </p>
              </div>

              <div>
                <label className="schedule-modal-label">Preview</label>
                <div
                  style={{
                    padding: "12px 14px",
                    background: "var(--surface-sunken)",
                    borderRadius: 10,
                    border: "1px solid var(--border)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 12.5,
                    whiteSpace: "pre-wrap",
                    color: "var(--text-muted)",
                    minHeight: 80,
                  }}
                >
                  {settings.message_header || "🚨 Aponta CD"}
                  {"\n\n"}
                  ⚠️ Atividade muito atrasada
                  {"\n"}João Silva — Separação
                  {"\n"}Tempo: 45min (meta: 15min)
                </div>
              </div>
            </div>
          </div>

          {/* TIPOS DE ALERTA */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-title">Tipos de alerta</div>
            <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: -4, marginBottom: 16 }}>
              Escolha quais eventos disparam notificação. Cada tipo tem uma mensagem própria.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {ALERT_TYPES.map((alert) => {
                const enabled = settings[alert.field];
                return (
                  <div
                    key={alert.field}
                    style={{
                      display: "flex",
                      gap: 14,
                      padding: "14px 16px",
                      background: enabled ? "var(--accent-soft)" : "var(--surface-raised)",
                      border: `1px solid ${enabled ? "var(--accent)" : "var(--border)"}`,
                      borderRadius: 10,
                      alignItems: "flex-start",
                      transition: "all 150ms ease",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={!!enabled}
                      onChange={(e) => set(alert.field, e.target.checked)}
                      disabled={saving}
                      style={{ width: 18, height: 18, marginTop: 2, cursor: "pointer", flexShrink: 0 }}
                    />
                    <div style={{ color: enabled ? "var(--accent)" : "var(--text-muted)", flexShrink: 0, marginTop: 1 }}>
                      {alert.icon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: enabled ? "var(--text)" : "var(--text-muted)" }}>
                        {alert.label}
                      </div>
                      <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 3 }}>
                        {alert.description}
                      </div>
                      <div
                        style={{
                          fontSize: 11.5,
                          color: "var(--text-faint)",
                          marginTop: 8,
                          padding: "8px 10px",
                          background: "var(--surface-sunken)",
                          borderRadius: 6,
                          fontFamily: "var(--font-mono)",
                          whiteSpace: "pre-wrap",
                          opacity: enabled ? 1 : 0.5,
                        }}
                      >
                        {alert.example}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* CONFIGURAÇÃO DE LIMITES */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-title">Limites de disparo</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
              <div>
                <label className="schedule-modal-label">Multiplicador de atraso</label>
                <input
                  type="number"
                  step="0.5"
                  min="1"
                  className="field"
                  style={{ width: "100%", fontFamily: "var(--font-mono)" }}
                  value={settings.alert_late_multiplier}
                  onChange={(e) => set("alert_late_multiplier", e.target.value)}
                  disabled={saving}
                />
                <p style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 4 }}>
                  Ex: se a meta é 10min, com multiplicador 3 o alerta dispara em 30min
                </p>
              </div>
              <div>
                <label className="schedule-modal-label">Mesa acumulada (nº pedidos)</label>
                <input
                  type="number"
                  min="1"
                  className="field"
                  style={{ width: "100%", fontFamily: "var(--font-mono)" }}
                  value={settings.alert_mesa_threshold}
                  onChange={(e) => set("alert_mesa_threshold", e.target.value)}
                  disabled={saving}
                />
                <p style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 4 }}>
                  Alerta quando a mesa de conferência passar desse número
                </p>
              </div>
              <div>
                <label className="schedule-modal-label">Horas sem atividade</label>
                <input
                  type="number"
                  min="1"
                  className="field"
                  style={{ width: "100%", fontFamily: "var(--font-mono)" }}
                  value={settings.alert_missing_hours}
                  onChange={(e) => set("alert_missing_hours", e.target.value)}
                  disabled={saving}
                />
                <p style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 4 }}>
                  Alerta se sessão ficar aberta mais tempo que isso
                </p>
              </div>
            </div>
          </div>

          {/* HORÁRIO DE SILÊNCIO */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <IconClock size={16} /> Horário de silêncio
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={settings.quiet_hours_enabled}
                onChange={(e) => set("quiet_hours_enabled", e.target.checked)}
                disabled={saving}
                style={{ width: 18, height: 18 }}
              />
              <span style={{ fontSize: 14 }}>
                Não enviar alertas nesse período (útil para não incomodar de madrugada)
              </span>
            </label>

            {settings.quiet_hours_enabled && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <label className="schedule-modal-label">Início do silêncio (hora)</label>
                  <input
                    type="number"
                    min="0"
                    max="23"
                    className="field"
                    style={{ width: "100%", fontFamily: "var(--font-mono)", textAlign: "center" }}
                    value={settings.quiet_hours_start}
                    onChange={(e) => set("quiet_hours_start", e.target.value)}
                    disabled={saving}
                  />
                </div>
                <div>
                  <label className="schedule-modal-label">Fim do silêncio (hora)</label>
                  <input
                    type="number"
                    min="0"
                    max="23"
                    className="field"
                    style={{ width: "100%", fontFamily: "var(--font-mono)", textAlign: "center" }}
                    value={settings.quiet_hours_end}
                    onChange={(e) => set("quiet_hours_end", e.target.value)}
                    disabled={saving}
                  />
                </div>
                <div className="schedule-modal-full" style={{ gridColumn: "1 / -1", fontSize: 12, color: "var(--text-muted)" }}>
                  Alertas serão silenciados das <strong>{String(settings.quiet_hours_start).padStart(2, "0")}:00</strong> às{" "}
                  <strong>{String(settings.quiet_hours_end).padStart(2, "0")}:00</strong>
                </div>
              </div>
            )}
          </div>

          {/* SALVAR + TESTAR */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button className="btn-small btn-excel" onClick={save} disabled={saving}>
                {saved ? <><IconCheck size={14} /> Salvo</> : saving ? "Salvando..." : "Salvar configurações"}
              </button>
              <button
                className="btn-small"
                onClick={sendTest}
                disabled={testSending}
              >
                {testSending ? "Enviando..." : "Enviar mensagem de teste"}
              </button>
            </div>

            {testResult && (
              <div
                style={{
                  marginTop: 14,
                  padding: "10px 14px",
                  borderRadius: 8,
                  background: testResult.ok ? "var(--ok-soft)" : "var(--danger-soft)",
                  border: `1px solid ${testResult.ok ? "var(--ok)" : "var(--danger)"}`,
                  color: testResult.ok ? "var(--ok)" : "var(--danger)",
                  fontSize: 13,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                {testResult.ok ? <IconCheck size={14} /> : <IconX size={14} />} {testResult.message}
              </div>
            )}
          </div>

          {/* HISTÓRICO */}
          <div className="card">
            <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <IconShield size={16} /> Histórico de alertas ({log.length})
            </div>
            {log.length === 0 ? (
              <div className="schedule-empty" style={{ padding: "30px 0" }}>
                Nenhum alerta enviado ainda.
              </div>
            ) : (
              <div style={{ overflowX: "auto", maxHeight: 400 }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Quando</th>
                      <th>Tipo</th>
                      <th>Status</th>
                      <th>Detalhe</th>
                    </tr>
                  </thead>
                  <tbody>
                    {log.map((l) => (
                      <tr key={l.id}>
                        <td>{fmtDate(l.sent_at)} {fmtClock(l.sent_at).slice(0, 5)}</td>
                        <td style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>{l.alert_type}</td>
                        <td>
                          {l.success ? (
                            <span style={{ color: "var(--ok)", fontWeight: 600 }}>OK</span>
                          ) : (
                            <span style={{ color: "var(--danger)", fontWeight: 600 }}>Falha</span>
                          )}
                        </td>
                        <td style={{ color: "var(--text-muted)", fontSize: 12 }}>
                          {l.error_message || (l.payload?.text || JSON.stringify(l.payload).slice(0, 80))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}