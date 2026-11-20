import React, { useCallback, useEffect, useMemo, useState } from "react";
import { fetchPauseLogs } from "../lib/api";
import { summarizePauses, pausesByOperator } from "../lib/analytics";
import { reasonLabel } from "../lib/pauseReasons";
import {
  readLocalSlaConfig,
  loadSlaConfig,
  pauseLimitSecondsFor,
  evaluatePauseSlas,
} from "../lib/slaMonitor";
import { fmtDuration, fmtDate, fmtClock } from "../lib/format";
import { IconRefresh } from "./Icons";

const PERIODS = [
  { key: 7, label: "7 dias" },
  { key: 30, label: "30 dias" },
  { key: 90, label: "90 dias" },
];

export default function PauseReasons({ activeSessions = [] }) {
  const [days, setDays] = useState(30);
  const [logs, setLogs] = useState([]);
  const [slaConfig, setSlaConfig] = useState(() => readLocalSlaConfig());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data, error: err }, cfg] = await Promise.all([
      fetchPauseLogs({ days }),
      loadSlaConfig().catch(() => readLocalSlaConfig()),
    ]);
    setSlaConfig(cfg);
    setLoading(false);
    if (err) {
      setError(err);
      setLogs([]);
      return;
    }
    setError(null);
    setLogs(data || []);
  }, [days]);

  useEffect(() => { load(); }, [load]);

  const closed = useMemo(() => logs.filter((l) => l.duration_seconds != null), [logs]);
  const openLogs = useMemo(() => logs.filter((l) => l.duration_seconds == null && !l.resumed_at), [logs]);
  const livePauseAlerts = useMemo(
    () => evaluatePauseSlas(activeSessions, openLogs, slaConfig),
    [activeSessions, openLogs, slaConfig]
  );
  const overdueClosedCount = useMemo(
    () => closed.filter((l) => (l.duration_seconds || 0) > pauseLimitSecondsFor(l.reason, slaConfig)).length,
    [closed, slaConfig]
  );
  const byReason = useMemo(() => summarizePauses(closed), [closed]);
  const byOperator = useMemo(() => pausesByOperator(closed), [closed]);
  const totalSeconds = byReason.reduce((s, r) => s + r.seconds, 0);
  const maxSeconds = Math.max(1, ...byReason.map((r) => r.seconds));

  const tableMissing = error && (error.code === "42P01" || error.code === "PGRST205" || /could not find the table|does not exist/i.test(error.message || ""));

  return (
    <div>
      <div className="page-header-row" style={{ marginBottom: 22 }}>
        <div>
          <h1 className="page-title">Pausas</h1>
          <p className="page-sub" style={{ marginBottom: 0 }}>
            Motivos informados pelos operadores ao pausar uma atividade e quanto tempo cada um consome.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <select className="field" style={{ width: "auto" }} value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Período">
            {PERIODS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
          <button className="btn-small" onClick={load}><IconRefresh size={14} /> Atualizar</button>
        </div>
      </div>

      {tableMissing && (
        <div className="alert-card alert-danger">
          <strong>Recurso ainda não ativado no banco.</strong>
          <p className="alert-detail">
            Rode <code>supabase/migrations/2026-10-11_features.sql</code> no SQL Editor do Supabase para
            criar a tabela de pausas.
          </p>
        </div>
      )}
      {error && !tableMissing && (
        <div className="alert-card alert-danger"><strong>Erro ao carregar:</strong> <code>{error.message}</code></div>
      )}

      {!error && (
        <>
          {livePauseAlerts.length > 0 && (
            <div className="alert-card alert-danger" style={{ marginBottom: 20, flexDirection: "column", gap: 6 }}>
              <strong>⚠ {livePauseAlerts.length} pausa(s) em andamento acima do tempo limite (SLA)</strong>
              {livePauseAlerts.map((a) => (
                <div key={a.id} style={{ fontSize: 13 }}>{a.message}</div>
              ))}
            </div>
          )}

          <div className="stat-strip" style={{ marginBottom: 20 }}>
            <div className="stat-cell"><div className="stat-num">{closed.length}</div><div className="stat-label">Pausas concluídas</div></div>
            <div className="stat-cell"><div className="stat-num">{fmtDuration(totalSeconds)}</div><div className="stat-label">Tempo total pausado</div></div>
            <div className="stat-cell">
              <div className="stat-num">{closed.length ? fmtDuration(Math.round(totalSeconds / closed.length)) : "-"}</div>
              <div className="stat-label">Duração média</div>
            </div>
            <div className="stat-cell">
              <div className="stat-num danger">{overdueClosedCount}</div>
              <div className="stat-label">
                Acima do SLA ({closed.length ? `${Math.round((overdueClosedCount / closed.length) * 100)}%` : "0%"})
              </div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-title">Tempo pausado por motivo</div>
            {loading && <p style={{ color: "var(--text-muted)" }}>Carregando...</p>}
            {!loading && byReason.length === 0 && (
              <p style={{ color: "var(--text-muted)", margin: 0 }}>Nenhuma pausa registrada no período.</p>
            )}
            <div className="forecast">
              {byReason.map((r) => (
                <div key={r.reason} className="forecast-row">
                  <span className="forecast-day" style={{ minWidth: 220 }}>{reasonLabel(r.reason)}</span>
                  <span className="forecast-bar-wrap">
                    <span className="forecast-bar" style={{ width: `${(r.seconds / maxSeconds) * 100}%` }} />
                  </span>
                  <span className="forecast-val" style={{ minWidth: 150 }}>
                    {fmtDuration(r.seconds)} · {r.count}x
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-title">Por operador</div>
            <table className="data-table">
              <thead><tr><th>Operador</th><th>Pausas</th><th>Tempo total</th></tr></thead>
              <tbody>
                {byOperator.length === 0 && <tr><td colSpan={3}>Sem dados.</td></tr>}
                {byOperator.map((o) => (
                  <tr key={o.code}><td>{o.name || o.code}</td><td>{o.count}</td><td>{fmtDuration(o.seconds)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card">
            <div className="card-title">Últimas pausas</div>
            <table className="data-table">
              <thead><tr><th>Quando</th><th>Operador</th><th>Atividade</th><th>Motivo</th><th>Duração</th></tr></thead>
              <tbody>
                {logs.slice(0, 40).map((l) => {
                  const limitSec = pauseLimitSecondsFor(l.reason, slaConfig);
                  const exceeded = l.duration_seconds != null && l.duration_seconds > limitSec;
                  return (
                  <tr key={l.id}>
                    <td>{fmtDate(l.paused_at)} {fmtClock(l.paused_at)}</td>
                    <td>{l.operator_name || l.operator_code}</td>
                    <td>{l.activity || "-"}</td>
                    <td>{reasonLabel(l.reason)}</td>
                    <td>
                      {l.duration_seconds != null ? fmtDuration(l.duration_seconds) : "em andamento"}
                      {exceeded && (
                        <span style={{ marginLeft: 8, background: "var(--danger-soft)", color: "var(--danger)", padding: "2px 6px", borderRadius: 4, fontSize: 10.5, fontWeight: 700 }}>
                          SLA &gt; {Math.round(limitSec / 60)}m
                        </span>
                      )}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
