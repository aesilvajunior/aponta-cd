import React, { useCallback, useEffect, useMemo, useState } from "react";
import { fetchEntries } from "../lib/api";
import {
  fetchFraudAlerts,
  scanAndPersistAlerts,
  resolveFraudAlert,
  deleteFraudAlert,
  deleteAllResolvedFraudAlerts,
  FRAUD_LABELS,
  SEVERITY_COLORS,
} from "../lib/fraud";
import { supabase } from "../supabaseClient";
import { fmtClock, fmtDate } from "../lib/format";
import {
  IconShield,
  IconRefresh,
  IconCheck,
  IconTrash,
  IconAlertTriangle,
  IconSearch,
} from "./Icons";

export default function FraudPanel({ operators = [] }) {
  const [alerts, setAlerts] = useState([]);
  const [resolvedAlerts, setResolvedAlerts] = useState([]);
  const [tab, setTab] = useState("abertos"); // "abertos" | "resolvidos"
  const [filterSeverity, setFilterSeverity] = useState("");
  const [filterType, setFilterType] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanMsg, setScanMsg] = useState("");
  const [error, setError] = useState("");

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [openRes, closedRes] = await Promise.all([
      fetchFraudAlerts({ resolved: false, limit: 300 }),
      fetchFraudAlerts({ resolved: true, limit: 200 }),
    ]);
    if (openRes.error || closedRes.error) {
      setError((openRes.error || closedRes.error).message);
      setLoading(false);
      return;
    }
    setAlerts(openRes.data || []);
    setResolvedAlerts(closedRes.data || []);
    setError("");
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAll();
    const ch = supabase
      .channel("fraud-alerts-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "fraud_alerts" }, loadAll)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [loadAll]);

  async function runScan() {
    setScanning(true);
    setScanMsg("");
    setError("");
    try {
      const { data: recentEntries, error: eErr } = await fetchEntries({ days: 30, limit: 5000 });
      if (eErr) {
        setError(eErr.message);
        return;
      }
      const res = await scanAndPersistAlerts(recentEntries || [], operators);
      if (res.error) {
        setError(res.error.message);
        return;
      }
      await loadAll();
      setScanMsg(
        res.inserted > 0
          ? `Varredura concluída: ${res.inserted} novo(s) padrão(ões) suspeito(s) encontrado(s).`
          : "Varredura concluída: nenhum novo padrão suspeito nos últimos 30 dias."
      );
    } finally {
      setScanning(false);
    }
  }

  async function handleResolve(id) {
    const { error: err } = await resolveFraudAlert(id, "admin");
    if (err) { setError(err.message); return; }
    await loadAll();
  }

  async function handleDelete(id) {
    if (!window.confirm("Excluir este alerta?")) return;
    const { error: err } = await deleteFraudAlert(id);
    if (err) { setError(err.message); return; }
    await loadAll();
  }

  async function handleClearResolved() {
    if (!window.confirm("Apagar todos os alertas já resolvidos?")) return;
    const { error: err } = await deleteAllResolvedFraudAlerts();
    if (err) { setError(err.message); return; }
    await loadAll();
  }

  const activeList = tab === "abertos" ? alerts : resolvedAlerts;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return activeList.filter((a) => {
      if (filterSeverity && a.severity !== filterSeverity) return false;
      if (filterType && a.alert_type !== filterType) return false;
      if (q) {
        const hay = `${a.operator_name || ""} ${a.operator_code || ""} ${a.details || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [activeList, filterSeverity, filterType, search]);

  const highCount = alerts.filter((a) => a.severity === "alta").length;
  const medCount = alerts.filter((a) => a.severity === "media").length;

  return (
    <div className="anim-fade-up">
      <div className="page-header-row" style={{ marginBottom: 22 }}>
        <div>
          <h1 className="page-title">Detecção de fraude</h1>
          <p className="page-sub" style={{ marginBottom: 0 }}>
            Identifica automaticamente apontamentos curtos (&lt;15s), muito longos (&gt;4h), excesso de encaixes e anomalias
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn-small btn-excel" onClick={runScan} disabled={scanning}>
            <IconShield size={14} /> {scanning ? "Analisando..." : "Escanear últimos 30 dias"}
          </button>
          <button className="btn-small" onClick={loadAll} disabled={loading}>
            <IconRefresh size={14} /> Atualizar
          </button>
        </div>
      </div>

      {error && (
        <div className="alert-card alert-danger" style={{ marginBottom: 16 }}>
          <IconAlertTriangle size={16} /> {error}
          <button className="btn-small" style={{ marginLeft: "auto" }} onClick={() => setError("")}>Fechar</button>
        </div>
      )}

      {scanMsg && (
        <div className="alert-card" style={{ marginBottom: 16, background: "var(--ok-soft)", borderColor: "var(--ok)", color: "var(--ok)" }}>
          <IconCheck size={16} /> {scanMsg}
        </div>
      )}

      <div className="stat-strip" style={{ marginBottom: 20 }}>
        <div className="stat-cell">
          <div className="stat-num accent">{alerts.length}</div>
          <div className="stat-label">Alertas abertos</div>
        </div>
        <div className="stat-cell">
          <div className="stat-num danger">{highCount}</div>
          <div className="stat-label">Severidade alta</div>
        </div>
        <div className="stat-cell">
          <div className="stat-num" style={{ color: "var(--warning)" }}>{medCount}</div>
          <div className="stat-label">Severidade média</div>
        </div>
        <div className="stat-cell">
          <div className="stat-num" style={{ color: "var(--ok)" }}>{resolvedAlerts.length}</div>
          <div className="stat-label">Resolvidos</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button className={`quick-filter-btn ${tab === "abertos" ? "active" : ""}`} onClick={() => setTab("abertos")}>
            Abertos ({alerts.length})
          </button>
          <button className={`quick-filter-btn ${tab === "resolvidos" ? "active" : ""}`} onClick={() => setTab("resolvidos")}>
            Resolvidos ({resolvedAlerts.length})
          </button>

          <select className="field" style={{ width: "auto" }} value={filterSeverity} onChange={(e) => setFilterSeverity(e.target.value)}>
            <option value="">Todas severidades</option>
            <option value="alta">Alta</option>
            <option value="media">Média</option>
            <option value="baixa">Baixa</option>
          </select>

          <select className="field" style={{ width: "auto" }} value={filterType} onChange={(e) => setFilterType(e.target.value)}>
            <option value="">Todos os tipos</option>
            {Object.entries(FRAUD_LABELS).map(([k, label]) => (
              <option key={k} value={k}>{label}</option>
            ))}
          </select>

          <div style={{ position: "relative", flex: 1, minWidth: 180 }}>
            <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-faint)", display: "flex" }}>
              <IconSearch size={14} />
            </span>
            <input
              className="field"
              style={{ paddingLeft: 34 }}
              placeholder="Buscar operador ou detalhe..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {tab === "resolvidos" && resolvedAlerts.length > 0 && (
            <button className="btn-small" style={{ color: "var(--danger)", borderColor: "var(--danger)" }} onClick={handleClearResolved}>
              <IconTrash size={13} /> Limpar resolvidos
            </button>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-title">
          {tab === "abertos" ? "Padrões suspeitos abertos" : "Histórico de resolvidos"} ({filtered.length})
        </div>

        {loading ? (
          <div className="schedule-empty">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="schedule-empty">
            <div className="schedule-empty-icon"><IconShield size={36} /></div>
            <div>
              {tab === "abertos"
                ? "Nenhum alerta aberto. Clique em 'Escanear últimos 30 dias' para rodar uma nova verificação."
                : "Nenhum alerta resolvido encontrado."}
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filtered.map((a) => {
              const sevColor = SEVERITY_COLORS[a.severity] || "var(--text-muted)";
              return (
                <div
                  key={a.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    padding: "14px 16px",
                    background: "var(--surface-raised)",
                    border: "1px solid var(--border)",
                    borderLeft: `4px solid ${sevColor}`,
                    borderRadius: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: 999,
                          fontSize: 10.5,
                          fontWeight: 700,
                          textTransform: "uppercase",
                          color: sevColor,
                          border: `1px solid ${sevColor}`,
                        }}
                      >
                        {a.severity || "media"}
                      </span>
                      <strong style={{ fontSize: 14 }}>
                        {FRAUD_LABELS[a.alert_type] || a.alert_type}
                      </strong>
                      <span style={{ fontSize: 12.5, color: "var(--accent)", fontWeight: 600 }}>
                        · {a.operator_name || a.operator_code} #{a.operator_code}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: "var(--text)", marginTop: 6 }}>{a.details}</div>
                    <div style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 4 }}>
                      Detectado em {fmtDate(a.created_at)} às {fmtClock(a.created_at).slice(0, 5)}
                      {a.resolved_at && ` · Resolvido em ${fmtDate(a.resolved_at)}`}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    {!a.resolved && (
                      <button
                        className="btn-small"
                        style={{ color: "var(--ok)", borderColor: "var(--ok)", background: "var(--ok-soft)" }}
                        onClick={() => handleResolve(a.id)}
                      >
                        <IconCheck size={13} /> Resolver
                      </button>
                    )}
                    <button
                      className="btn-small"
                      style={{ color: "var(--danger)", borderColor: "var(--danger)" }}
                      onClick={() => handleDelete(a.id)}
                      title="Excluir"
                    >
                      <IconTrash size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
