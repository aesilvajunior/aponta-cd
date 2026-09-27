import React, { useMemo } from "react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { fmtDate, fmtDuration, localISODate } from "../lib/format";
import { mean } from "../lib/metrics";
import {
  IconTrendingUp,
  IconZap,
  IconActivity,
  IconAlertTriangle,
  IconPackage,
  IconAward,
  IconTarget,
  IconClock,
  IconClipboardCheck,
} from "./Icons";

const COLORS = ["#1e3a5f", "#4a7ba7", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4", "#6b7280"];

function fmtDateTime(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function OperatorProfile({
  operator,
  entries,
  activities,
  separationErrors,
  shortagesByEntry,
  onBack,
}) {
  const opEntries = useMemo(
    () => entries.filter((e) => e.operator_code === operator.code),
    [entries, operator.code]
  );

  const allEntries = entries;

  const errorsAsOffender = useMemo(
    () => separationErrors.filter((e) => e.error_operator_code === operator.code),
    [separationErrors, operator.code]
  );

  const errorsAsReporter = useMemo(
    () => separationErrors.filter((e) => e.operator_code === operator.code),
    [separationErrors, operator.code]
  );

  const shortagesReported = useMemo(() => {
    const list = [];
    opEntries.forEach((e) => {
      (shortagesByEntry[e.id] || []).forEach((s) => {
        list.push({ entry: e, shortage: s });
      });
    });
    return list;
  }, [opEntries, shortagesByEntry]);

  const totalSegundos = opEntries.reduce((s, e) => s + (e.duration_seconds || 0), 0);
  const tempoMedio = opEntries.length > 0 ? Math.round(totalSegundos / opEntries.length) : 0;
  const totalEncaixes = opEntries.filter((e) => e.is_encaixe).length;
  const totalComFalta = opEntries.filter((e) => (shortagesByEntry[e.id]?.length || 0) > 0).length;

  const teamByOperator = useMemo(() => {
    const map = {};
    allEntries.forEach((e) => {
      if (!map[e.operator_code]) {
        map[e.operator_code] = {
          code: e.operator_code,
          name: e.operator_name,
          count: 0,
          total: 0,
        };
      }
      map[e.operator_code].count += 1;
      map[e.operator_code].total += e.duration_seconds || 0;
    });
    return Object.values(map).map((o) => ({
      ...o,
      media: o.count > 0 ? Math.round(o.total / o.count) : 0,
    }));
  }, [allEntries]);

  const teamAvgMedia = useMemo(() => {
    const valid = teamByOperator.filter((o) => o.media > 0);
    return valid.length > 0 ? Math.round(mean(valid.map((o) => o.media))) : 0;
  }, [teamByOperator]);

  const teamAvgRegistros = useMemo(() => {
    const valid = teamByOperator.filter((o) => o.count > 0);
    return valid.length > 0 ? Math.round(mean(valid.map((o) => o.count))) : 0;
  }, [teamByOperator]);

  const rankingByVolume = useMemo(
    () => [...teamByOperator].sort((a, b) => b.count - a.count),
    [teamByOperator]
  );

  const rankingBySpeed = useMemo(() => {
    const valid = teamByOperator.filter((o) => o.count >= 3 && o.media > 0);
    return [...valid].sort((a, b) => a.media - b.media);
  }, [teamByOperator]);

  const posVolume = rankingByVolume.findIndex((o) => o.code === operator.code) + 1;
  const posSpeed = rankingBySpeed.findIndex((o) => o.code === operator.code) + 1;

  const byActivity = useMemo(() => {
    const map = {};
    opEntries.forEach((e) => {
      if (!map[e.activity]) map[e.activity] = { name: e.activity, count: 0, total: 0 };
      map[e.activity].count += 1;
      map[e.activity].total += e.duration_seconds || 0;
    });
    return Object.values(map)
      .map((a) => ({ ...a, media: a.count > 0 ? Math.round(a.total / a.count) : 0 }))
      .sort((a, b) => b.count - a.count);
  }, [opEntries]);

  const last30Days = useMemo(() => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const days = [];
    const map = {};

    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const key = localISODate(d);
      map[key] = { date: key, count: 0, seconds: 0 };
      days.push(key);
    }

    opEntries.forEach((e) => {
      const key = localISODate(e.start_time);
      if (map[key]) {
        map[key].count += 1;
        map[key].seconds += e.duration_seconds || 0;
      }
    });

    return days.map((k) => ({
      label: `${k.slice(8, 10)}/${k.slice(5, 7)}`,
      count: map[k].count,
      minutos: Math.round(map[k].seconds / 60),
    }));
  }, [opEntries]);

  const daysWithActivity = last30Days.filter((d) => d.count > 0).length;

  const initials = operator.name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div>
      {/* Header */}
      <div className="profile-header">
        <button className="profile-back" onClick={onBack}>
          ← Voltar
        </button>

        <div className="profile-avatar">{initials}</div>

        <div className="profile-info">
          <h1 className="profile-name">{operator.name}</h1>
          <div className="profile-role">
            {operator.role} · #{operator.code}
          </div>
          <div className="profile-badge">
            <IconActivity size={13} />
            {opEntries.length} registros no período
            {daysWithActivity > 0 && ` · ${daysWithActivity} dia${daysWithActivity > 1 ? "s" : ""} ativo${daysWithActivity > 1 ? "s" : ""} (30d)`}
          </div>
        </div>
      </div>

      {/* Cards de métricas */}
      <div className="profile-stats">
        <div className="profile-stat">
          <div className="profile-stat-num accent">{opEntries.length}</div>
          <div className="profile-stat-label">Registros</div>
          {teamAvgRegistros > 0 && (
            <div className="profile-stat-hint">
              Média do time: {teamAvgRegistros}
            </div>
          )}
        </div>

        <div className="profile-stat">
          <div className="profile-stat-num">{fmtDuration(tempoMedio)}</div>
          <div className="profile-stat-label">Tempo médio</div>
          {teamAvgMedia > 0 && (
            <div className="profile-stat-hint">
              Média do time: {fmtDuration(teamAvgMedia)}
            </div>
          )}
        </div>

        <div className="profile-stat">
          <div className="profile-stat-num">{fmtDuration(totalSegundos)}</div>
          <div className="profile-stat-label">Tempo total</div>
        </div>

        <div className="profile-stat">
          <div className="profile-stat-num">{totalEncaixes}</div>
          <div className="profile-stat-label">Encaixes</div>
          {opEntries.length > 0 && (
            <div className="profile-stat-hint">
              {Math.round((totalEncaixes / opEntries.length) * 100)}% dos registros
            </div>
          )}
        </div>

        <div className="profile-stat">
          <div className="profile-stat-num danger">{errorsAsOffender.length}</div>
          <div className="profile-stat-label">Erros cometidos</div>
          <div className="profile-stat-hint">
            {errorsAsReporter.length} reportados por ele
          </div>
        </div>

        <div className="profile-stat">
          <div className="profile-stat-num danger">{shortagesReported.length}</div>
          <div className="profile-stat-label">Faltas reportadas</div>
          <div className="profile-stat-hint">
            {totalComFalta} pedido{totalComFalta !== 1 ? "s" : ""} afetado{totalComFalta !== 1 ? "s" : ""}
          </div>
        </div>
      </div>

      {/* Ranking + comparação com o time */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20, marginBottom: 20 }}>
        <div className="card">
          <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <IconAward size={16} /> Ranking por volume
          </div>
          {posVolume > 0 ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ fontSize: 32, fontWeight: 700, color: "var(--accent)" }}>
                  {posVolume}º
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>
                    de {rankingByVolume.length} operadores
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>
                    {opEntries.length} registros
                  </div>
                </div>
              </div>
              {teamAvgRegistros > 0 && (
                <div className="profile-compare">
                  <span style={{ minWidth: 80 }}>
                    {opEntries.length >= teamAvgRegistros ? "Acima da" : "Abaixo da"} média
                  </span>
                  <div className="profile-compare-bar">
                    <div
                      className={`profile-compare-fill ${opEntries.length >= teamAvgRegistros ? "better" : "worse"}`}
                      style={{
                        width: `${Math.min(100, (opEntries.length / Math.max(teamAvgRegistros * 2, opEntries.length)) * 100)}%`,
                      }}
                    />
                  </div>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--text-faint)" }}>
                    {teamAvgRegistros}
                  </span>
                </div>
              )}
            </>
          ) : (
            <p style={{ color: "var(--text-faint)", fontSize: 13 }}>Sem dados suficientes</p>
          )}
        </div>

        <div className="card">
          <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <IconZap size={16} /> Ranking por velocidade
          </div>
          {posSpeed > 0 ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ fontSize: 32, fontWeight: 700, color: "var(--ok)" }}>
                  {posSpeed}º
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>
                    de {rankingBySpeed.length} operadores
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>
                    tempo médio de {fmtDuration(tempoMedio)}
                  </div>
                </div>
              </div>
              {teamAvgMedia > 0 && (
                <div className="profile-compare">
                  <span style={{ minWidth: 80 }}>
                    {tempoMedio <= teamAvgMedia ? "Mais rápido" : "Mais lento"}
                  </span>
                  <div className="profile-compare-bar">
                    <div
                      className={`profile-compare-fill ${tempoMedio <= teamAvgMedia ? "better" : "worse"}`}
                      style={{
                        width: `${Math.min(100, (tempoMedio / Math.max(teamAvgMedia * 2, tempoMedio)) * 100)}%`,
                      }}
                    />
                  </div>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--text-faint)" }}>
                    {fmtDuration(teamAvgMedia)}
                  </span>
                </div>
              )}
            </>
          ) : (
            <p style={{ color: "var(--text-faint)", fontSize: 13 }}>
              Precisa de pelo menos 3 registros para entrar no ranking
            </p>
          )}
        </div>
      </div>

      {/* Gráfico 30 dias */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <IconTrendingUp size={16} /> Atividade nos últimos 30 dias
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={last30Days}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: "var(--text-muted)", fontSize: 10 }}
              interval={Math.floor(last30Days.length / 8)}
            />
            <YAxis tick={{ fill: "var(--text-muted)", fontSize: 11 }} allowDecimals={false} />
            <Tooltip
              contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", fontSize: 12, borderRadius: 10 }}
              labelStyle={{ color: "var(--text)" }}
              formatter={(value, name) => [value, name === "count" ? "Registros" : "Minutos"]}
            />
            <Bar dataKey="count" fill="var(--accent)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <p style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 12, marginBottom: 0 }}>
          Cada barra representa um dia. Total no período: {opEntries.filter((e) => {
            const d = new Date(e.start_time);
            const diff = (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24);
            return diff <= 30;
          }).length} registros.
        </p>
      </div>

      {/* Atividades que ele mais fez */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <IconActivity size={16} /> Atividades que ele mais fez
        </div>
        {byActivity.length > 0 ? (
          <ResponsiveContainer width="100%" height={Math.max(180, byActivity.length * 36)}>
            <BarChart data={byActivity.slice(0, 10)} layout="vertical">
              <CartesianGrid stroke="var(--border)" horizontal={false} />
              <XAxis type="number" tick={{ fill: "var(--text-muted)", fontSize: 11 }} allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={{ fill: "var(--text-muted)", fontSize: 11 }} width={150} />
              <Tooltip
                contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", fontSize: 12, borderRadius: 10 }}
                labelStyle={{ color: "var(--text)" }}
              />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {byActivity.slice(0, 10).map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p style={{ color: "var(--text-faint)", fontSize: 13 }}>Sem registros ainda.</p>
        )}

        {byActivity.length > 0 && (
          <table className="data-table" style={{ marginTop: 16 }}>
            <thead>
              <tr><th>Atividade</th><th>Registros</th><th>Tempo médio</th><th>Tempo total</th></tr>
            </thead>
            <tbody>
              {byActivity.map((a) => (
                <tr key={a.name}>
                  <td style={{ fontFamily: "var(--font-display)" }}>{a.name}</td>
                  <td>{a.count}</td>
                  <td>{fmtDuration(a.media)}</td>
                  <td>{fmtDuration(a.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Erros que ele cometeu */}
      {errorsAsOffender.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <IconAlertTriangle size={16} /> Erros que ele cometeu ({errorsAsOffender.length})
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Pedido/Transf.</th>
                  <th>Tipo de erro</th>
                  <th>Quem apontou</th>
                  <th>Observação</th>
                </tr>
              </thead>
              <tbody>
                {errorsAsOffender.slice(0, 30).map((e) => (
                  <tr key={e.id}>
                    <td>{fmtDateTime(e.created_at)}</td>
                    <td>{e.order_number || "—"}</td>
                    <td>{e.error_type}</td>
                    <td style={{ color: "var(--text-muted)" }}>{e.operator_name}</td>
                    <td style={{ color: "var(--text-muted)" }}>{e.note || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 12, marginBottom: 0 }}>
            Mostrando os 30 mais recentes.
          </p>
        </div>
      )}

      {/* Faltas que ele reportou */}
      {shortagesReported.length > 0 && (
        <div className="card">
          <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <IconPackage size={16} /> Faltas que ele reportou ({shortagesReported.length})
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Atividade</th>
                  <th>Pedido</th>
                  <th>Cliente</th>
                  <th>Produto</th>
                  <th>Qtd.</th>
                </tr>
              </thead>
              <tbody>
                {shortagesReported.slice(0, 30).map(({ entry: e, shortage: s }, i) => (
                  <tr key={`${e.id}-${i}`}>
                    <td>{fmtDate(e.start_time)}</td>
                    <td>{e.activity}</td>
                    <td>{e.order_number || "—"}</td>
                    <td style={{ color: "var(--text-muted)" }}>{e.customer_name || "—"}</td>
                    <td style={{ fontFamily: "var(--font-mono)" }}>{s.product_code}</td>
                    <td style={{ color: "var(--danger)", fontWeight: 600 }}>{s.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 12, marginBottom: 0 }}>
            Mostrando as 30 mais recentes.
          </p>
        </div>
      )}

      {opEntries.length === 0 && errorsAsOffender.length === 0 && shortagesReported.length === 0 && (
        <div className="card" style={{ textAlign: "center", padding: "60px 20px" }}>
          <div style={{ color: "var(--text-faint)", marginBottom: 16, display: "flex", justifyContent: "center" }}>
            <IconActivity size={48} strokeWidth={1} />
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text)" }}>
            Ainda não há dados para {operator.name}
          </div>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 8 }}>
            Quando esse operador registrar atividades, os dados vão aparecer aqui.
          </div>
        </div>
      )}
    </div>
  );
}