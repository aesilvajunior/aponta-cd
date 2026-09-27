import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import {
  fetchAlertSettings,
  updateAlertSettings,
  fetchAlertLog,
} from "../lib/api";
import { fmtClock, fmtDate } from "../lib/format";
import {
  IconAlertCircle,
  IconRefresh,
  IconCheck,
  IconShield,
  IconX,
  IconVolume2,
} from "./Icons";

export default function AlertSettings() {
  const [settings, setSettings] = useState({
    whatsapp_enabled: false,
    whatsapp_number: "",
    alert_late_multiplier: 3,
    alert_mesa_threshold: 10,
    alert_shortage_critical: true,
    alert_missing_hours: 4,
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
    if (s) setSettings({ ...settings, ...s });
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
    const { error: err } = await updateAlertSettings({
      whatsapp_enabled: settings.whatsapp_enabled,
      whatsapp_number: settings.whatsapp_number.trim() || null,
      alert_late_multiplier: Number(settings.alert_late_multiplier) || 3,
      alert_mesa_threshold: Number(settings.alert_mesa_threshold) || 10,
      alert_shortage_critical: !!settings.alert_shortage_critical,
      alert_missing_hours: Number(settings.alert_missing_hours) || 4,
    });
    setSaving(false);
    if (err) return setError(err.message);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function sendTest() {
    if (!settings.whatsapp_number) return;
    setTestSending(true);
    setTestResult(null);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-whatsapp`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            to: settings.whatsapp_number,
            message: "🔔 Teste do Aponta CD — alertas WhatsApp configurados com sucesso.",
            alertType: "test",
          }),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao enviar");
      setTestResult({ ok: true, message: "Mensagem enviada!" });
    } catch (e) {
      setTestResult({ ok: false, message: e.message });
    } finally {
      setTestSending(false);
    }
  }

  return (
    <div>
      <div className="page-header-row" style={{ marginBottom: 22 }}>
        <div>
          <h1 className="page-title">Alertas WhatsApp</h1>
          <p className="page-sub" style={{ marginBottom: 0 }}>
            Receba notificações críticas no WhatsApp do gestor
          </p>
        </div>
        <button className="btn-small" onClick={loadAll}>
          <IconRefresh size={14} /> Atualizar
        </button>
      </div>

      {error && <div className="alert-card alert-danger" style={{ marginBottom: 20 }}>{error}</div>}

      <div className="alert-card alert-warning" style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <IconAlertCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <strong>Requer configuração de Edge Function.</strong> Os alertas são enviados pela função
            <code style={{ margin: "0 6px" }}>send-whatsapp</code> que roda no Supabase. Configure os secrets
            <code style={{ margin: "0 6px" }}>WHATSAPP_TOKEN</code> e
            <code style={{ margin: "0 6px" }}>WHATSAPP_PHONE_ID</code> antes de ativar.
          </div>
        </div>
      </div>

      {loading ? (
        <div className="schedule-empty">Carregando...</div>
      ) : (
        <>
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <IconVolume2 size={16} /> Configuração
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, padding: "14px 16px", background: "var(--surface-raised)", border: "1px solid var(--border)", borderRadius: 10 }}>
              <input
                type="checkbox"
                checked={settings.whatsapp_enabled}
                onChange={(e) => set("whatsapp_enabled", e.target.checked)}
                disabled={saving}
                id="wa-enabled"
                style={{ width: 18, height: 18, cursor: "pointer" }}
              />
              <label htmlFor="wa-enabled" style={{ flex: 1, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                Alertas WhatsApp {settings.whatsapp_enabled ? "ativados" : "desativados"}
              </label>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label className="schedule-modal-label">Número do WhatsApp (com DDI)</label>
              <input
                className="field"
                style={{ width: "100%", fontFamily: "var(--font-mono)" }}
                placeholder="Ex: 5511999998888"
                value={settings.whatsapp_number || ""}
                onChange={(e) => set("whatsapp_number", e.target.value.replace(/\D/g, ""))}
                disabled={saving}
              />
              <p style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 6 }}>
                Formato: 55 (Brasil) + DDD + número. Ex: 5511987654321
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginBottom: 16 }}>
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
                  Alerta se tempo exceder X vezes a meta
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
                  Alerta quando a mesa de conferência passar disso
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
                  Alerta se operador ficar "esquecido" com sessão aberta
                </p>
              </div>
            </div>

            <label style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={settings.alert_shortage_critical}
                onChange={(e) => set("alert_shortage_critical", e.target.checked)}
                disabled={saving}
                style={{ width: 16, height: 16 }}
              />
              <span style={{ fontSize: 13 }}>Alertar sobre faltas registradas (resumo por hora)</span>
            </label>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button className="btn-small btn-excel" onClick={save} disabled={saving}>
                {saved ? <><IconCheck size={14} /> Salvo</> : saving ? "Salvando..." : "Salvar configurações"}
              </button>
              <button
                className="btn-small"
                onClick={sendTest}
                disabled={testSending || !settings.whatsapp_number}
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
                }}
              >
                {testResult.ok ? <IconCheck size={14} /> : <IconX size={14} />} {testResult.message}
              </div>
            )}
          </div>

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
                          {l.error_message || (l.payload?.summary || JSON.stringify(l.payload).slice(0, 80))}
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