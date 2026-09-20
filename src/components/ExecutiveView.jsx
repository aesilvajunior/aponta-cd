import React, { useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend, LineChart, Line,
} from "recharts";
import { fmtDate, fmtDuration } from "../lib/format";

const COLORS = ["#0a3d7a", "#00a0e4", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444"];

function fmtDateShort(iso) {
  const d = new Date(iso + "T12:00:00");
  if (isNaN(d.getTime())) return "—";
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
}

function monthLabel(key) {
  const [year, month] = key.split("-");
  const names = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${names[parseInt(month, 10) - 1]}/${year.slice(2)}`;
}

function todayISO() {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d - tz).toISOString().slice(0, 10);
}

function getMonthRange(date = new Date()) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  const toISO = (d) => {
    const tz = d.getTimezoneOffset() * 60000;
    return new Date(d - tz).toISOString().slice(0, 10);
  };
  return { from: toISO(first), to: toISO(last) };
}

function getPrevMonthRange() {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return getMonthRange(d);
}

function getWeekRange() {
  const today = new Date();
  const day = today.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(today);
  monday.setDate(today.getDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const toISO = (d) => {
    const tz = d.getTimezoneOffset() * 60000;
    return new Date(d - tz).toISOString().slice(0, 10);
  };
  return { from: toISO(monday), to: toISO(sunday) };
}

export default function ExecutiveView({
  entries,
  activities,
  operators,
  activeSessions,
  separationErrors = [],
  shortages = [],
  onViewOperator,
}) {
  // Período selecionado: "hoje" | "semana" | "mes"
  const [period, setPeriod] = useState("mes");

  // Range atual
  const range = useMemo(() => {
    if (period === "hoje") {
      const t = todayISO();
      return { from: t, to: t };
    }
    if (period === "semana") return getWeekRange();
    return getMonthRange();
  }, [period]);

  // Range anterior (pra comparação)
  const prevRange = useMemo(() => {
    if (period === "hoje") {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      const tz = y.getTimezoneOffset() * 60000;
      const iso = new Date(y - tz).toISOString().slice(0, 10);
      return { from: iso, to: iso };
    }
    if (period === "semana") {
      const { from } = getWeekRange();
      const d = new Date(from + "T12:00:00");
      d.setDate(d.getDate() - 7);
      const d2 = new Date(d);
      d2.setDate(d.getDate() + 6);
      const toISO = (x) => {
        const tz = x.getTimezoneOffset() * 60000;
        return new Date(x - tz).toISOString().slice(0, 10);
      };
      return { from: toISO(d), to: toISO(d2) };
    }
    return getPrevMonthRange();
  }, [period]);

  // Filtra registros por range
  const filterByRange = (list, r) => {
    return list.filter((e) => {
      const d = e.start_time.slice(0, 10);
      return d >= r.from && d <= r.to;
    });
  };

  const currentEntries = useMemo(() => filterByRange(entries, range), [entries, range]);
  const prevEntries = useMemo(() => filterByRange(entries, prevRange), [entries, prevRange]);

  const currentErrors = useMemo(() => {
    return separationErrors.filter((e) => {
      const d = e.created_at.slice(0, 10);
      return d >= range.from && d <= range.to;
    });
  }, [separationErrors, range]);

  const prevErrors = useMemo(() => {
    return separationErrors.filter((e) => {
      const d = e.created_at.slice(0, 10);
      return d >= prevRange.from && d <= prevRange.to;
    });
  }, [separationErrors, prevRange]);

  const shortagesByEntry = useMemo(() => {
    const map = {};
    shortages.forEach((s) => {
      if (!map[s.entry_id]) map[s.entry_id] = [];
      map[s.entry_id].push(s);
    });
    return map;
  }, [shortages]);

  const currentEntriesWithShortage = currentEntries.filter((e) => (shortagesByEntry[e.id]?.length || 0) > 0);
  const prevEntriesWithShortage = prevEntries.filter((e) => (shortagesByEntry[e.id]?.length || 0) > 0);

  // ============================================================
  // KPIs
  // ============================================================
  const kpis = useMemo(() => {
    const calc = (list) => {
      const total = list.length;
      const totalSec = list.reduce((s, e) => s + (e.duration_seconds || 0), 0);
      const avgSec = total > 0 ? Math.round(totalSec / total) : 0;
      const encaixes = list.filter((e) => e.is_encaixe).length;
      return { total, totalSec, avgSec, encaixes };
    };
    return {
      current: calc(currentEntries),
      previous: calc(prevEntries),
    };
  }, [currentEntries, prevEntries]);

  const goalStats = useMemo(() => {
    const activitiesWithTarget = activities.filter((a) => a.target_seconds);
    if (activitiesWithTarget.length === 0) return { achieved: 0, total: 0, list: [] };

    const list = activitiesWithTarget.map((a) => {
      const entriesForAct = currentEntries.filter((e) => e.activity === a.name);
      if (entriesForAct.length === 0) return { name: a.name, target: a.target_seconds, avg: 0, achieved: null, count: 0 };
      const avg = entriesForAct.reduce((s, e) => s + (e.duration_seconds || 0), 0) / entriesForAct.length;
      return {
        name: a.name,
        target: a.target_seconds,
        avg,
        achieved: avg <= a.target_seconds,
        count: entriesForAct.length,
      };
    });

    const withData = list.filter((l) => l.achieved !== null);
    const achieved = withData.filter((l) => l.achieved).length;
    return { achieved, total: withData.length, list };
  }, [activities, currentEntries]);

  // ============================================================
  // Ranking operadores no período
  // ============================================================
  const opRanking = useMemo(() => {
    const byOp = {};
    currentEntries.forEach((e) => {
      if (!byOp[e.operator_name]) {
        byOp[e.operator_name] = {
          name: e.operator_name,
          code: e.operator_code,
          count: 0,
          totalSeconds: 0,
          activityCount: {},
        };
      }
      const op = byOp[e.operator_name];
      op.count += 1;
      op.totalSeconds += e.duration_seconds || 0;
      op.activityCount[e.activity] = (op.activityCount[e.activity] || 0) + 1;
    });
    return Object.values(byOp)
      .map((op) => {
        const entries = Object.entries(op.activityCount);
        entries.sort((a, b) => b[1] - a[1]);
        return { ...op, mainActivity: entries[0]?.[0] || "—" };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [currentEntries]);

  // ============================================================
  // Top problemas
  // ============================================================
  const topShortages = useMemo(() => {
    const byCode = {};
    currentEntries.forEach((e) => {
      const list = shortagesByEntry[e.id] || [];
      list.forEach((s) => {
        const code = s.product_code;
        if (!byCode[code]) byCode[code] = { code, count: 0, totalQty: 0 };
        byCode[code].count += 1;
        byCode[code].totalQty += s.quantity || 0;
      });
    });
    return Object.values(byCode).sort((a, b) => b.totalQty - a.totalQty).slice(0, 5);
  }, [currentEntries, shortagesByEntry]);

  const topErrors = useMemo(() => {
    const byType = {};
    currentErrors.forEach((e) => {
      byType[e.error_type] = (byType[e.error_type] || 0) + 1;
    });
    return Object.entries(byType).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 5);
  }, [currentErrors]);

  const topErrorOperators = useMemo(() => {
    const byOp = {};
    currentErrors.forEach((e) => {
      if (!e.error_operator_code) return;
      const key = e.error_operator_code;
      if (!byOp[key]) byOp[key] = { code: key, name: e.error_operator_name || key, count: 0 };
      byOp[key].count += 1;
    });
    return Object.values(byOp).sort((a, b) => b.count - a.count).slice(0, 5);
  }, [currentErrors]);

  const topShortageCustomers = useMemo(() => {
    const byCustomer = {};
    currentEntries.forEach((e) => {
      const list = shortagesByEntry[e.id] || [];
      if (list.length === 0) return;
      const name = e.customer_name || "(sem cliente)";
      if (!byCustomer[name]) byCustomer[name] = { name, entriesCount: 0, totalFaltas: 0 };
      byCustomer[name].entriesCount += 1;
      byCustomer[name].totalFaltas += list.length;
    });
    return Object.values(byCustomer).sort((a, b) => b.totalFaltas - a.totalFaltas).slice(0, 5);
  }, [currentEntries, shortagesByEntry]);

  // ============================================================
  // Evolução diária (linha)
  // ============================================================
  const dailyEvolution = useMemo(() => {
    const byDay = {};
    currentEntries.forEach((e) => {
      const day = e.start_time.slice(0, 10);
      if (!byDay[day]) byDay[day] = { day, count: 0, seconds: 0 };
      byDay[day].count += 1;
      byDay[day].seconds += e.duration_seconds || 0;
    });
    return Object.values(byDay)
      .sort((a, b) => a.day.localeCompare(b.day))
      .map((d) => ({
        label: fmtDateShort(d.day),
        registros: d.count,
        minutos: Math.round(d.seconds / 60),
      }));
  }, [currentEntries]);

  // ============================================================
  // Alertas executivos
  // ============================================================
  const executiveAlerts = useMemo(() => {
    const alerts = [];

    // 1. Sessões em andamento
    const lateSessions = activeSessions.filter((s) => {
      const elapsed = (Date.now() - new Date(s.start_time).getTime()) / 1000;
      const config = activities.find((a) => a.name === s.activity);
      const threshold = config?.target_seconds || 1800;
      return elapsed > threshold;
    });
    if (lateSessions.length > 0) {
      alerts.push({
        level: "danger",
        icon: "⚠",
        title: `${lateSessions.length} atividade(s) em andamento há mais tempo que o esperado`,
        desc: "Verifique se operadores esqueceram de finalizar.",
      });
    }

    // 2. Metas não atingidas
    if (goalStats.total > 0 && goalStats.achieved < goalStats.total) {
      const missing = goalStats.total - goalStats.achieved;
      alerts.push({
        level: "warning",
        icon: "🎯",
        title: `${missing} meta(s) não atingida(s) no período`,
        desc: `Apenas ${goalStats.achieved} de ${goalStats.total} atividades ficaram dentro do tempo esperado.`,
      });
    }

    // 3. Aumento de faltas em relação ao período anterior
    if (currentEntriesWithShortage.length > prevEntriesWithShortage.length && prevEntriesWithShortage.length > 0) {
      const delta = currentEntriesWithShortage.length - prevEntriesWithShortage.length;
      alerts.push({
        level: "warning",
        icon: "📦",
        title: `Faltas aumentaram ${delta > 0 ? "+" : ""}${delta} em relação ao período anterior`,
        desc: `Eram ${prevEntriesWithShortage.length} antes, agora são ${currentEntriesWithShortage.length}.`,
      });
    }

    // 4. Aumento de erros
    if (currentErrors.length > prevErrors.length && prevErrors.length > 0) {
      const delta = currentErrors.length - prevErrors.length;
      alerts.push({
        level: "warning",
        icon: "🚨",
        title: `Erros de separação aumentaram ${delta > 0 ? "+" : ""}${delta}`,
        desc: `Eram ${prevErrors.length} antes, agora são ${currentErrors.length}.`,
      });
    }

    // 5. Tempo médio piorando
    if (kpis.previous.avgSec > 0 && kpis.current.avgSec > kpis.previous.avgSec * 1.1) {
      const deltaPct = Math.round(((kpis.current.avgSec - kpis.previous.avgSec) / kpis.previous.avgSec) * 100);
      alerts.push({
        level: "warning",
        icon: "⏱",
        title: `Tempo médio aumentou ${deltaPct}%`,
        desc: `Antes ${fmtDuration(kpis.previous.avgSec)}, agora ${fmtDuration(kpis.current.avgSec)}.`,
      });
    }

    return alerts;
  }, [activeSessions, activities, goalStats, currentEntriesWithShortage, prevEntriesWithShortage, currentErrors, prevErrors, kpis]);

  // Helper de comparação
  function deltaPct(current, previous) {
    if (previous === 0) return null;
    return Math.round(((current - previous) / previous) * 100);
  }

  function DeltaBadge({ current, previous, invert = false }) {
    const pct = deltaPct(current, previous);
    if (pct === null) return null;
    const isGood = invert ? pct < 0 : pct > 0;
    const isBad = invert ? pct > 0 : pct < 0;
    const color = pct === 0 ? "var(--text-muted)" : isGood ? "var(--ok)" : isBad ? "var(--danger)" : "var(--text-muted)";
    return (
      <span style={{ fontSize: 12, fontWeight: 600, color }}>
        {pct > 0 ? "↑ +" : pct < 0 ? "↓ " : ""}{pct}%
      </span>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="page-header-row" style={{ marginBottom: 22 }}>
        <div>
          <h1 className="page-title">Visão executiva</h1>
          <p className="page-sub" style={{ marginBottom: 0 }}>
            Resumo do desempenho — sem detalhes, só o que importa.
          </p>
        </div>
      </div>

      {/* Período */}
      <div className="quick-filters" style={{ marginBottom: 20 }}>
        <span className="quick-filters-label">Período:</span>
        <button className={`quick-filter-btn ${period === "hoje" ? "active" : ""}`} onClick={() => setPeriod("hoje")}>Hoje</button>
        <button className={`quick-filter-btn ${period === "semana" ? "active" : ""}`} onClick={() => setPeriod("semana")}>Esta semana</button>
        <button className={`quick-filter-btn ${period === "mes" ? "active" : ""}`} onClick={() => setPeriod("mes")}>Este mês</button>
      </div>

      {/* Alertas executivos */}
      {executiveAlerts.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          {executiveAlerts.map((a, i) => (
            <div
              key={i}
              className={`alert-card ${a.level === "danger" ? "alert-danger" : "alert-warning"}`}
              style={{ marginBottom: 10, display: "flex", gap: 14, alignItems: "flex-start" }}
            >
              <span style={{ fontSize: 22, lineHeight: 1 }}>{a.icon}</span>
              <div>
                <strong style={{ fontSize: 14 }}>{a.title}</strong>
                <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "4px 0 0 0" }}>{a.desc}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* KPIs principais */}
      <div className="exec-kpis">
        <div className="exec-kpi">
          <div className="exec-kpi-label">Registros</div>
          <div className="exec-kpi-value">{kpis.current.total}</div>
          <div className="exec-kpi-delta">
            <DeltaBadge current={kpis.current.total} previous={kpis.previous.total} />
            {kpis.previous.total > 0 && (
              <span style={{ marginLeft: 6, fontSize: 11.5, color: "var(--text-faint)" }}>
                vs. {kpis.previous.total} antes
              </span>
            )}
          </div>
        </div>

        <div className="exec-kpi">
          <div className="exec-kpi-label">Tempo médio</div>
          <div className="exec-kpi-value">{fmtDuration(kpis.current.avgSec)}</div>
          <div className="exec-kpi-delta">
            <DeltaBadge current={kpis.current.avgSec} previous={kpis.previous.avgSec} invert />
            {kpis.previous.avgSec > 0 && (
              <span style={{ marginLeft: 6, fontSize: 11.5, color: "var(--text-faint)" }}>
                antes {fmtDuration(kpis.previous.avgSec)}
              </span>
            )}
          </div>
        </div>

        <div className="exec-kpi">
          <div className="exec-kpi-label">Tempo total</div>
          <div className="exec-kpi-value">{fmtDuration(kpis.current.totalSec)}</div>
          <div className="exec-kpi-delta">
            <DeltaBadge current={kpis.current.totalSec} previous={kpis.previous.totalSec} />
          </div>
        </div>

        <div className="exec-kpi">
          <div className="exec-kpi-label">Metas atingidas</div>
          <div className="exec-kpi-value" style={{ color: goalStats.total === 0 ? "var(--text-faint)" : goalStats.achieved === goalStats.total ? "var(--ok)" : "var(--warning)" }}>
            {goalStats.total > 0 ? `${goalStats.achieved}/${goalStats.total}` : "—"}
          </div>
          <div className="exec-kpi-delta">
            <span style={{ fontSize: 11.5, color: "var(--text-faint)" }}>
              {goalStats.total > 0 ? "atividades com meta definida" : "sem metas definidas"}
            </span>
          </div>
        </div>

        <div className="exec-kpi">
          <div className="exec-kpi-label">Encaixes</div>
          <div className="exec-kpi-value">{kpis.current.encaixes}</div>
          <div className="exec-kpi-delta">
            {kpis.current.total > 0 && (
              <span style={{ fontSize: 11.5, color: "var(--text-faint)" }}>
                {Math.round((kpis.current.encaixes / kpis.current.total) * 100)}% do total
              </span>
            )}
          </div>
        </div>

        <div className="exec-kpi">
          <div className="exec-kpi-label">Pedidos com falta</div>
          <div className="exec-kpi-value" style={{ color: currentEntriesWithShortage.length > 0 ? "var(--danger)" : "var(--text)" }}>
            {currentEntriesWithShortage.length}
          </div>
          <div className="exec-kpi-delta">
            <DeltaBadge current={currentEntriesWithShortage.length} previous={prevEntriesWithShortage.length} invert />
          </div>
        </div>

        <div className="exec-kpi">
          <div className="exec-kpi-label">Erros de separação</div>
          <div className="exec-kpi-value" style={{ color: currentErrors.length > 0 ? "var(--danger)" : "var(--text)" }}>
            {currentErrors.length}
          </div>
          <div className="exec-kpi-delta">
            <DeltaBadge current={currentErrors.length} previous={prevErrors.length} invert />
          </div>
        </div>
      </div>

      {/* Evolução diária */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">📈 Evolução no período</div>
        {dailyEvolution.length > 1 ? (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={dailyEvolution}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
              <YAxis tick={{ fill: "var(--text-muted)", fontSize: 11 }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", fontSize: 12, borderRadius: 8 }}
                labelStyle={{ color: "var(--text)" }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="registros" name="Registros" stroke="#0a3d7a" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="minutos" name="Minutos" stroke="#00a0e4" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p style={{ fontSize: 12.5, color: "var(--text-faint)" }}>Dados insuficientes para mostrar evolução.</p>
        )}
      </div>

      {/* Top operadores */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">🏆 Top operadores do período</div>
        {opRanking.length > 0 ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>Posição</th>
                <th>Operador</th>
                <th>Registros</th>
                <th>Tempo total</th>
                <th>Atividade principal</th>
              </tr>
            </thead>
            <tbody>
              {opRanking.map((op, i) => (
                <tr key={op.code}>
                  <td>
                    <span style={{ fontSize: 16 }}>
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}º`}
                    </span>
                  </td>
                  <td
                    className={onViewOperator ? "clickable-name" : ""}
                    onClick={onViewOperator ? () => {
                      const fullOp = operators.find((o) => o.code === op.code);
                      if (fullOp) onViewOperator(fullOp);
                    } : undefined}
                    style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
                  >
                    {op.name}
                  </td>
                  <td>{op.count}</td>
                  <td>{fmtDuration(op.totalSeconds)}</td>
                  <td style={{ color: "var(--text-muted)" }}>{op.mainActivity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p style={{ fontSize: 12.5, color: "var(--text-faint)" }}>Nenhum registro no período.</p>
        )}
      </div>

      {/* Grid de problemas */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20, marginBottom: 20 }}>
        {/* Faltas */}
        <div className="card">
          <div className="card-title">📦 Produtos com mais faltas</div>
          {topShortages.length > 0 ? (
            <table className="data-table">
              <thead><tr><th>Código</th><th>Ocorrências</th><th>Qtd.</th></tr></thead>
              <tbody>
                {topShortages.map((p) => (
                  <tr key={p.code}>
                    <td style={{ fontFamily: "var(--font-mono)" }}>{p.code}</td>
                    <td>{p.count}</td>
                    <td style={{ color: "var(--danger)", fontWeight: 600 }}>{p.totalQty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p style={{ fontSize: 12.5, color: "var(--text-faint)" }}>Sem faltas registradas.</p>
          )}
        </div>

        {/* Clientes afetados */}
        <div className="card">
          <div className="card-title">🏢 Clientes mais afetados</div>
          {topShortageCustomers.length > 0 ? (
            <table className="data-table">
              <thead><tr><th>Cliente</th><th>Pedidos</th><th>Faltas</th></tr></thead>
              <tbody>
                {topShortageCustomers.map((c) => (
                  <tr key={c.name}>
                    <td style={{ fontFamily: "var(--font-display)" }}>{c.name}</td>
                    <td>{c.entriesCount}</td>
                    <td style={{ color: "var(--danger)", fontWeight: 600 }}>{c.totalFaltas}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p style={{ fontSize: 12.5, color: "var(--text-faint)" }}>Nenhum cliente afetado.</p>
          )}
        </div>

        {/* Erros por tipo */}
        <div className="card">
          <div className="card-title">🚨 Erros por tipo</div>
          {topErrors.length > 0 ? (
            <table className="data-table">
              <thead><tr><th>Tipo</th><th>Ocorrências</th></tr></thead>
              <tbody>
                {topErrors.map((e) => (
                  <tr key={e.name}>
                    <td>{e.name}</td>
                    <td style={{ color: "var(--danger)", fontWeight: 600 }}>{e.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p style={{ fontSize: 12.5, color: "var(--text-faint)" }}>Nenhum erro registrado.</p>
          )}
        </div>

        {/* Quem mais errou */}
        <div className="card">
          <div className="card-title">⚠ Operadores que mais erraram</div>
          {topErrorOperators.length > 0 ? (
            <table className="data-table">
              <thead><tr><th>Operador</th><th>Erros</th></tr></thead>
              <tbody>
                {topErrorOperators.map((e) => (
                  <tr key={e.code}>
                    <td style={{ fontFamily: "var(--font-display)" }}>{e.name}</td>
                    <td style={{ color: "var(--danger)", fontWeight: 600 }}>{e.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p style={{ fontSize: 12.5, color: "var(--text-faint)" }}>Nenhum erro por operador.</p>
          )}
        </div>
      </div>

      {/* Metas detalhadas */}
      {goalStats.list.filter((g) => g.achieved !== null).length > 0 && (
        <div className="card">
          <div className="card-title">🎯 Metas por atividade</div>
          <table className="data-table">
            <thead>
              <tr><th>Atividade</th><th>Meta</th><th>Real (média)</th><th>Status</th></tr>
            </thead>
            <tbody>
              {goalStats.list
                .filter((g) => g.achieved !== null)
                .map((g) => (
                  <tr key={g.name}>
                    <td style={{ fontFamily: "var(--font-display)" }}>{g.name}</td>
                    <td>{fmtDuration(g.target)}</td>
                    <td>{fmtDuration(Math.round(g.avg))}</td>
                    <td>
                      <span
                        style={{
                          color: g.achieved ? "var(--ok)" : "var(--danger)",
                          fontWeight: 600,
                          fontSize: 12.5,
                        }}
                      >
                        {g.achieved ? "✓ Atingida" : "✗ Fora da meta"}
                      </span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}