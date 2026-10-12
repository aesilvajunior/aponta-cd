import React, { useMemo, useState } from "react";
import { buildHeatmap, forecastNextDays, weekdayAverages, fairRanking, occupancyByOperator, WEEKDAYS } from "../lib/analytics";
import { fmtDuration } from "../lib/format";

const PERIODS = [
  { key: 28, label: "4 semanas" },
  { key: 56, label: "8 semanas" },
  { key: 112, label: "16 semanas" },
];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export default function Workload({ entries }) {
  const [days, setDays] = useState(56);

  const list = useMemo(() => {
    const since = Date.now() - days * 86400000;
    return entries.filter((e) => new Date(e.start_time).getTime() >= since);
  }, [entries, days]);

  const heat = useMemo(() => buildHeatmap(list), [list]);
  const averages = useMemo(() => weekdayAverages(list), [list]);
  const forecast = useMemo(() => forecastNextDays(list, 7), [list]);
  const ranking = useMemo(() => fairRanking(list), [list]);
  const occupancy = useMemo(() => occupancyByOperator(list), [list]);

  // Só mostra as horas em que há movimento (evita 24 colunas vazias)
  const activeHours = HOURS.filter((h) => heat.cells.some((row) => row[h] > 0));
  const hours = activeHours.length ? HOURS.slice(activeHours[0], activeHours[activeHours.length - 1] + 1) : [];
  const maxForecast = Math.max(1, ...forecast.map((f) => f.expected));

  return (
    <div>
      <div className="page-header-row" style={{ marginBottom: 22 }}>
        <div>
          <h1 className="page-title">Carga de trabalho</h1>
          <p className="page-sub" style={{ marginBottom: 0 }}>
            Em que dias e horários o CD mais trabalha, quanto deve vir nos próximos dias e quem está rendendo
            de forma justa. Base: {list.length} lançamentos.
          </p>
        </div>
        <select className="field" style={{ width: "auto" }} value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Período">
          {PERIODS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
        </select>
      </div>

      {list.length === 0 ? (
        <div className="card"><p style={{ margin: 0, color: "var(--text-muted)" }}>Sem lançamentos no período.</p></div>
      ) : (
        <>
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-title">Mapa de calor: lançamentos por dia e hora</div>
            <div className="heatmap-scroll">
              <table className="heatmap" aria-label="Mapa de calor de lançamentos por dia da semana e hora">
                <thead>
                  <tr>
                    <th scope="col"></th>
                    {hours.map((h) => <th key={h} scope="col">{h}h</th>)}
                  </tr>
                </thead>
                <tbody>
                  {[1, 2, 3, 4, 5, 6, 0].map((wd) => (
                    <tr key={wd}>
                      <th scope="row">{WEEKDAYS[wd]}</th>
                      {hours.map((h) => {
                        const v = heat.cells[wd][h];
                        const pct = heat.max ? v / heat.max : 0;
                        return (
                          <td
                            key={h}
                            className="heatmap-cell"
                            style={{ background: v ? `rgba(74, 123, 167, ${0.12 + pct * 0.88})` : "transparent" }}
                            title={`${WEEKDAYS[wd]} ${h}h: ${v} lançamento(s)`}
                          >
                            {v || ""}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-title">Previsão para os próximos 7 dias</div>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 0 }}>
              Média do mesmo dia da semana no período. É uma estimativa para dimensionar a equipe, não uma garantia.
            </p>
            <div className="forecast">
              {forecast.map((f) => (
                <div key={f.date} className="forecast-row">
                  <span className="forecast-day">{f.label} {f.date.slice(8)}/{f.date.slice(5, 7)}</span>
                  <span className="forecast-bar-wrap">
                    <span className="forecast-bar" style={{ width: `${(f.expected / maxForecast) * 100}%` }} />
                  </span>
                  <span className="forecast-val">
                    {f.basedOnDays ? `~${f.expected}` : "sem histórico"}
                  </span>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 12, color: "var(--text-faint)", marginBottom: 0 }}>
              Média por dia da semana:{" "}
              {averages.filter((a) => a.days).map((a) => `${a.label} ${a.avg.toFixed(0)}`).join(" · ") || "-"}
            </p>
          </div>

          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-title">Ranking justo (índice de desempenho)</div>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 0 }}>
              Cada lançamento é comparado com a mediana da própria atividade, então quem pega as atividades mais
              demoradas não é punido. <strong>1,00</strong> = na média; acima disso, mais rápido que a mediana.
              Só entram operadores com 5 ou mais lançamentos.
            </p>
            <table className="data-table">
              <thead><tr><th>#</th><th>Operador</th><th>Lançamentos</th><th>Índice</th></tr></thead>
              <tbody>
                {ranking.length === 0 && <tr><td colSpan={4}>Dados insuficientes.</td></tr>}
                {ranking.map((r, i) => (
                  <tr key={r.code}>
                    <td>{i + 1}</td>
                    <td>{r.name}</td>
                    <td>{r.records}</td>
                    <td><strong>{r.index.toFixed(2).replace(".", ",")}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card">
            <div className="card-title">Ocupação: tempo trabalhando x esperando</div>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 0 }}>
              Espera = intervalo entre o fim de um lançamento e o início do próximo, no mesmo dia, até 45 minutos
              (pausas maiores, como almoço, não contam).
            </p>
            <table className="data-table">
              <thead><tr><th>Operador</th><th>Trabalho</th><th>Espera</th><th>Ocupação</th></tr></thead>
              <tbody>
                {occupancy.map((o) => (
                  <tr key={o.code}>
                    <td>{o.name}</td>
                    <td>{fmtDuration(Math.round(o.workSeconds))}</td>
                    <td>{fmtDuration(Math.round(o.idleSeconds))}</td>
                    <td>{Math.round(o.occupancy * 100)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
