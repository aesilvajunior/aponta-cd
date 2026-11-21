import React, { useEffect, useMemo, useState } from "react";
import { buildHeatmap, forecastNextDays, weekdayAverages, fairRanking, occupancyByOperator, WEEKDAYS } from "../lib/analytics";
import { fmtDuration } from "../lib/format";
import {
  readLocalSlaConfig,
  loadSlaConfig,
  saveSlaConfig,
  computeShiftProductivityStatus,
  evaluateAllSlaBottlenecks,
} from "../lib/slaMonitor";
import { fetchConferenceQueue } from "../lib/conference";
import { fetchPauseLogs, fetchTeamGoals } from "../lib/api";
import { IconCloudSun, IconSun, IconX } from "./Icons";

const PERIODS = [
  { key: 7, label: "7 dias" },
  { key: 14, label: "14 dias" },
  { key: 28, label: "4 semanas" },
  { key: 56, label: "8 semanas" },
  { key: 112, label: "16 semanas" },
  { key: 0, label: "Todo o histórico" },
];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export default function Workload({ entries = [], activeSessions = [], onNavigate }) {
  const [days, setDays] = useState(56);
  const [filterShift, setFilterShift] = useState("");
  const [filterActivity, setFilterActivity] = useState("");
  const [filterOperator, setFilterOperator] = useState("");
  const [filterWeekday, setFilterWeekday] = useState("");
  const [filterStation, setFilterStation] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const [slaConfig, setSlaConfig] = useState(() => readLocalSlaConfig());
  const [slaEditOpen, setSlaEditOpen] = useState(false);
  const [slaSavedMsg, setSlaSavedMsg] = useState("");
  const [conferenceQueue, setConferenceQueue] = useState([]);
  const [openPauses, setOpenPauses] = useState([]);
  const [teamGoals, setTeamGoals] = useState([]);

  useEffect(() => {
    loadSlaConfig().then(setSlaConfig).catch(() => {});
    Promise.all([
      fetchConferenceQueue({ includeFinished: false }).catch(() => ({ data: [] })),
      fetchPauseLogs({ days: 1, limit: 100 }).catch(() => ({ data: [] })),
      fetchTeamGoals().catch(() => ({ data: [] })),
    ]).then(([cq, pl, tg]) => {
      setConferenceQueue(cq?.data || []);
      setOpenPauses((pl?.data || []).filter((p) => !p.resumed_at));
      setTeamGoals(tg?.data || []);
    });
  }, []);

  // Opções dinâmicas para os filtros
  const filterOptions = useMemo(() => {
    const acts = new Set();
    const ops = new Map();
    const stations = new Set();
    entries.forEach((e) => {
      if (e.activity) acts.add(e.activity);
      if (e.operator_code) ops.set(e.operator_code, e.operator_name || e.operator_code);
      if (e.station) stations.add(e.station);
    });
    return {
      activities: [...acts].sort((a, b) => a.localeCompare(b, "pt-BR")),
      operators: [...ops.entries()].sort((a, b) => a[1].localeCompare(b[1], "pt-BR")),
      stations: [...stations].sort((a, b) => a.localeCompare(b, "pt-BR")),
    };
  }, [entries]);

  const list = useMemo(() => {
    const since = days > 0 ? Date.now() - days * 86400000 : 0;
    const q = searchQuery.trim().toLowerCase();
    return entries.filter((e) => {
      const startMs = new Date(e.start_time).getTime();
      if (since && startMs < since) return false;
      if (filterShift) {
        const sh = e.shift || (new Date(startMs).getHours() < 14 ? "Manhã" : "Tarde");
        if (sh !== filterShift) return false;
      }
      if (filterActivity && e.activity !== filterActivity) return false;
      if (filterOperator && e.operator_code !== filterOperator) return false;
      if (filterWeekday !== "" && new Date(startMs).getDay() !== Number(filterWeekday)) return false;
      if (filterStation && (e.station || "") !== filterStation) return false;
      if (q) {
        const hay = `${e.operator_name || ""} ${e.operator_code || ""} ${e.activity || ""} ${e.order_number || ""} ${e.customer_name || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [entries, days, filterShift, filterActivity, filterOperator, filterWeekday, filterStation, searchQuery]);

  const hasExtraFilters = Boolean(
    filterShift || filterActivity || filterOperator || filterWeekday !== "" || filterStation || searchQuery.trim()
  );

  function clearFilters() {
    setFilterShift("");
    setFilterActivity("");
    setFilterOperator("");
    setFilterWeekday("");
    setFilterStation("");
    setSearchQuery("");
  }

  const shiftStatus = useMemo(
    () => computeShiftProductivityStatus(entries, teamGoals, slaConfig),
    [entries, teamGoals, slaConfig]
  );

  const slaAlerts = useMemo(
    () =>
      evaluateAllSlaBottlenecks({
        activeSessions,
        openPauseLogs: openPauses,
        conferenceQueue,
        entries,
        teamGoals,
        cfg: slaConfig,
      }),
    [activeSessions, openPauses, conferenceQueue, entries, teamGoals, slaConfig]
  );

  async function handleSaveSla() {
    const { config } = await saveSlaConfig(slaConfig);
    setSlaConfig(config);
    setSlaSavedMsg("Limites de SLA salvos!");
    setTimeout(() => setSlaSavedMsg(""), 2500);
  }

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
    <div className="anim-fade-up">
      <div className="page-header-row" style={{ marginBottom: 18 }}>
        <div>
          <h1 className="page-title">Carga de trabalho</h1>
          <p className="page-sub" style={{ marginBottom: 0 }}>
            Em que dias e horários o CD mais trabalha, quanto deve vir nos próximos dias e quem está rendendo
            de forma justa. Base: <strong>{list.length}</strong>{hasExtraFilters ? ` de ${entries.length}` : ""} lançamentos.
          </p>
        </div>
        <select className="field" style={{ width: "auto" }} value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Período">
          {PERIODS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
        </select>
      </div>

      {/* Barra completa de filtros */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "inline-flex", gap: 4 }}>
            <button
              type="button"
              className={`quick-filter-btn ${filterShift === "" ? "active" : ""}`}
              onClick={() => setFilterShift("")}
            >
              Todos turnos
            </button>
            <button
              type="button"
              className={`quick-filter-btn ${filterShift === "Manhã" ? "active" : ""}`}
              onClick={() => setFilterShift(filterShift === "Manhã" ? "" : "Manhã")}
              style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
            >
              <IconCloudSun size={14} /> Manhã
            </button>
            <button
              type="button"
              className={`quick-filter-btn ${filterShift === "Tarde" ? "active" : ""}`}
              onClick={() => setFilterShift(filterShift === "Tarde" ? "" : "Tarde")}
              style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
            >
              <IconSun size={14} /> Tarde
            </button>
          </div>

          <select className="field" style={{ width: "auto", minWidth: 160 }} value={filterActivity} onChange={(e) => setFilterActivity(e.target.value)} aria-label="Filtrar por atividade">
            <option value="">Todas atividades</option>
            {filterOptions.activities.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>

          <select className="field" style={{ width: "auto", minWidth: 160 }} value={filterOperator} onChange={(e) => setFilterOperator(e.target.value)} aria-label="Filtrar por operador">
            <option value="">Todos operadores</option>
            {filterOptions.operators.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
          </select>

          <select className="field" style={{ width: "auto" }} value={filterWeekday} onChange={(e) => setFilterWeekday(e.target.value)} aria-label="Filtrar por dia da semana">
            <option value="">Todos os dias</option>
            {[1, 2, 3, 4, 5, 6, 0].map((wd) => <option key={wd} value={wd}>{WEEKDAYS[wd]}</option>)}
          </select>

          {filterOptions.stations.length > 0 && (
            <select className="field" style={{ width: "auto" }} value={filterStation} onChange={(e) => setFilterStation(e.target.value)} aria-label="Filtrar por estação">
              <option value="">Todas estações</option>
              {filterOptions.stations.map((st) => <option key={st} value={st}>{st}</option>)}
            </select>
          )}

          <input
            className="field"
            style={{ flex: 1, minWidth: 160 }}
            placeholder="Buscar pedido, cliente ou operador..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Buscar lançamentos"
          />

          {hasExtraFilters && (
            <button type="button" className="btn-small" onClick={clearFilters}>
              <IconX size={13} /> Limpar filtros
            </button>
          )}
        </div>
      </div>

      {list.length === 0 ? (
        <div className="card">
          <p style={{ margin: 0, color: "var(--text-muted)" }}>
            {hasExtraFilters ? "Nenhum lançamento encontrado com os filtros aplicados." : "Sem lançamentos no período."}
          </p>
        </div>
      ) : (
        <>
          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
              <div className="card-title" style={{ marginBottom: 0 }}>
                Monitor Proativo de Gargalos (SLA)
                {slaAlerts.length > 0 && (
                  <span style={{ background: "var(--danger)", color: "#fff", padding: "2px 8px", borderRadius: 999, fontSize: 11 }}>
                    {slaAlerts.length} alerta{slaAlerts.length > 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <button type="button" className="btn-small" onClick={() => setSlaEditOpen((v) => !v)}>
                {slaEditOpen ? "Fechar limites" : "Configurar limites SLA"}
              </button>
            </div>

            {shiftStatus.active && (
              <div style={{ padding: "10px 14px", borderRadius: 10, background: shiftStatus.belowSla ? "var(--danger-soft)" : "var(--surface-raised)", border: `1px solid ${shiftStatus.belowSla ? "var(--danger)" : "var(--border)"}`, marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 13, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 6 }}>
                    {shiftStatus.shift === "Manhã" ? <IconCloudSun size={15} /> : <IconSun size={15} />}
                    Turno {shiftStatus.shift} (em andamento · {shiftStatus.elapsedHours}h)
                  </span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: shiftStatus.belowSla ? "var(--danger)" : "var(--ok)" }}>
                    {shiftStatus.todayCount} / ~{shiftStatus.expectedSoFar} esperados
                    {shiftStatus.pctOfTarget != null ? ` (${shiftStatus.pctOfTarget}%)` : ""}
                  </span>
                </div>
                <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 4 }}>
                  Meta mínima SLA: {shiftStatus.targetPct}% ({shiftStatus.source === "meta" ? "baseado na meta da equipe" : "baseado na média histórica do turno"})
                </div>
              </div>
            )}

            {slaAlerts.length === 0 ? (
              <div style={{ fontSize: 13, color: "var(--ok)", fontWeight: 600 }}>
                ✓ Nenhum gargalo crítico detectado no momento (pausas, fila de conferência e turno dentro do SLA).
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {slaAlerts.map((a) => (
                  <div
                    key={a.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 10,
                      padding: "10px 12px",
                      borderRadius: 10,
                      background: a.severity === "critical" ? "var(--danger-soft)" : "var(--warning-soft)",
                      border: `1px solid ${a.severity === "critical" ? "var(--danger)" : "var(--warning)"}`,
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{a.title}</div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{a.message}</div>
                    </div>
                    {onNavigate && a.tab && a.tab !== "workload" && (
                      <button type="button" className="btn-small" onClick={() => onNavigate(a.tab)}>
                        Ver detalhes →
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {slaEditOpen && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
                  <label style={{ fontSize: 12 }}>
                    Pausa padrão máx. (min)
                    <input
                      type="number"
                      min="1"
                      className="field"
                      value={slaConfig.maxPauseMinutes}
                      onChange={(e) => setSlaConfig((c) => ({ ...c, maxPauseMinutes: Number(e.target.value) || 20 }))}
                    />
                  </label>
                  <label style={{ fontSize: 12 }}>
                    Conferência travada (min)
                    <input
                      type="number"
                      min="1"
                      className="field"
                      value={slaConfig.conferenceStallMinutes}
                      onChange={(e) => setSlaConfig((c) => ({ ...c, conferenceStallMinutes: Number(e.target.value) || 20 }))}
                    />
                  </label>
                  <label style={{ fontSize: 12 }}>
                    Fila conferência máx. (pedidos)
                    <input
                      type="number"
                      min="1"
                      className="field"
                      value={slaConfig.conferenceMaxQueue}
                      onChange={(e) => setSlaConfig((c) => ({ ...c, conferenceMaxQueue: Number(e.target.value) || 8 }))}
                    />
                  </label>
                  <label style={{ fontSize: 12 }}>
                    Produtividade mín. turno (%)
                    <input
                      type="number"
                      min="10"
                      max="150"
                      className="field"
                      value={slaConfig.shiftProductivityMinPct}
                      onChange={(e) => setSlaConfig((c) => ({ ...c, shiftProductivityMinPct: Number(e.target.value) || 80 }))}
                    />
                  </label>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
                  <button type="button" className="btn-small btn-excel" onClick={handleSaveSla}>
                    Salvar limites SLA
                  </button>
                  {slaSavedMsg && <span style={{ fontSize: 12.5, color: "var(--ok)", fontWeight: 600 }}>{slaSavedMsg}</span>}
                </div>
              </div>
            )}
          </div>

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
