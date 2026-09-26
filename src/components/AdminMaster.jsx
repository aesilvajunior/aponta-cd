import React, { useEffect, useMemo, useState } from "react";
import {
  fetchEntries,
  fetchShortages,
  fetchActiveSessions,
  fetchSeparationErrors,
  fetchConferenceQueue,
  fetchConferenceHistory,
  logAudit,
} from "../lib/api";
import { supabase } from "../supabaseClient";
import { fmtClock, fmtDate, fmtDuration } from "../lib/format";

// ============================================================
// Admin Master — Central de controle total
// ============================================================

const TABS = [
  { key: "entries", label: "Lançamentos", icon: "📋" },
  { key: "conference", label: "Mesa de conferência", icon: "✅" },
  { key: "shortages", label: "Faltas de material", icon: "📦" },
  { key: "sessions", label: "Sessões em andamento", icon: "⏱" },
  { key: "errors", label: "Erros de separação", icon: "🚨" },
];

function fmtDateTime(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AdminMaster({ operators }) {
  const [tab, setTab] = useState("entries");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Dados
  const [entries, setEntries] = useState([]);
  const [shortages, setShortages] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [errors, setErrors] = useState([]);
  const [queue, setQueue] = useState([]);
  const [history, setHistory] = useState([]);

  // Filtros
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filterOperator, setFilterOperator] = useState("");

  async function loadAll() {
    setLoading(true);
    const [
      { data: e },
      { data: sh },
      { data: s },
      { data: er },
      { data: q },
      { data: h },
    ] = await Promise.all([
      fetchEntries({ limit: 3000 }),
      fetchShortages({ limit: 3000 }),
      fetchActiveSessions(),
      fetchSeparationErrors(),
      fetchConferenceQueue(),
      fetchConferenceHistory({ limit: 2000 }),
    ]);
    setEntries(e || []);
    setShortages(sh || []);
    setSessions(s || []);
    setErrors(er || []);
    setQueue(q || []);
    setHistory(h || []);
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    const ch = supabase
      .channel("admin-master-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "entries" }, loadAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "entry_shortages" }, loadAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "active_sessions" }, loadAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "separation_errors" }, loadAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "conference_queue" }, loadAll)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, []);

  // Mapa entry_id -> lista de faltas
  const shortagesByEntry = useMemo(() => {
    const map = {};
    shortages.forEach((s) => {
      if (!map[s.entry_id]) map[s.entry_id] = [];
      map[s.entry_id].push(s);
    });
    return map;
  }, [shortages]);

  // Busca + filtros genéricos
  function applyFilters(list, getDate, getSearchText) {
    const q = search.trim().toLowerCase();
    return list.filter((item) => {
      if (dateFrom || dateTo) {
        const d = new Date(getDate(item));
        if (dateFrom && d < new Date(dateFrom + "T00:00:00")) return false;
        if (dateTo && d > new Date(dateTo + "T23:59:59")) return false;
      }
      if (filterOperator && item.operator_code !== filterOperator && item.separated_by_code !== filterOperator && item.error_operator_code !== filterOperator) {
        return false;
      }
      if (q) {
        const text = getSearchText(item).toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }

  const filteredEntries = useMemo(
    () => applyFilters(
      entries,
      (e) => e.start_time,
      (e) => `${e.operator_name} ${e.operator_code} ${e.activity} ${e.order_number || ""} ${e.customer_name || ""} ${e.transfer_number || ""}`
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entries, search, dateFrom, dateTo, filterOperator]
  );

  const filteredQueue = useMemo(
    () => applyFilters(
      queue,
      (c) => c.separated_at,
      (c) => `${c.order_number || ""} ${c.customer_name || ""} ${c.separated_by_name || ""} ${c.transfer_number || ""}`
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queue, search, dateFrom, dateTo, filterOperator]
  );

  const filteredHistory = useMemo(
    () => applyFilters(
      history,
      (c) => c.conference_finished_at || c.separated_at,
      (c) => `${c.order_number || ""} ${c.customer_name || ""} ${c.separated_by_name || ""} ${c.conference_finished_by_name || ""}`
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [history, search, dateFrom, dateTo, filterOperator]
  );

  const filteredShortages = useMemo(() => {
    const q = search.trim().toLowerCase();
    return shortages.filter((s) => {
      if (dateFrom || dateTo) {
        const d = new Date(s.created_at);
        if (dateFrom && d < new Date(dateFrom + "T00:00:00")) return false;
        if (dateTo && d > new Date(dateTo + "T23:59:59")) return false;
      }
      if (q) {
        const text = `${s.product_code} ${s.entry_id}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [shortages, search, dateFrom, dateTo]);

  const filteredSessions = useMemo(
    () => applyFilters(
      sessions,
      (s) => s.start_time,
      (s) => `${s.operator_name} ${s.operator_code} ${s.activity} ${s.order_number || ""} ${s.customer_name || ""}`
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessions, search, dateFrom, dateTo, filterOperator]
  );

  const filteredErrors = useMemo(
    () => applyFilters(
      errors,
      (e) => e.created_at,
      (e) => `${e.operator_name} ${e.error_operator_name || ""} ${e.error_type} ${e.order_number || ""}`
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [errors, search, dateFrom, dateTo, filterOperator]
  );

  function clearFilters() {
    setSearch("");
    setDateFrom("");
    setDateTo("");
    setFilterOperator("");
  }

  const hasFilters = search || dateFrom || dateTo || filterOperator;

  // Contadores por aba
  const counts = {
    entries: filteredEntries.length,
    conference: filteredQueue.length + filteredHistory.length,
    shortages: filteredShortages.length,
    sessions: filteredSessions.length,
    errors: filteredErrors.length,
  };

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div>
      <div className="page-header-row" style={{ marginBottom: 22 }}>
        <div>
          <h1 className="page-title">Admin Master</h1>
          <p className="page-sub" style={{ marginBottom: 0 }}>
            Central de controle total — visualize, edite e apague qualquer dado do sistema
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn-small" onClick={loadAll}>🔄 Atualizar</button>
        </div>
      </div>

      {error && (
        <div className="alert-card alert-danger" style={{ marginBottom: 20 }}>
          Erro: <code>{error}</code>
          <button className="btn-small" style={{ marginLeft: 12 }} onClick={() => setError("")}>Fechar</button>
        </div>
      )}

      {/* Abas */}
      <div className="quick-filters" style={{ marginBottom: 20 }}>
        <span className="quick-filters-label">Seção:</span>
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`quick-filter-btn ${tab === t.key ? "active" : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.icon} {t.label} ({counts[t.key]})
          </button>
        ))}
      </div>

      {/* Filtros */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">Filtros</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input
            className="field"
            style={{ flex: 1, minWidth: 200 }}
            placeholder="🔍 Buscar por nome, pedido, cliente, código..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select className="field" style={{ width: "auto" }} value={filterOperator} onChange={(e) => setFilterOperator(e.target.value)}>
            <option value="">Todos operadores</option>
            {operators.map((o) => <option key={o.code} value={o.code}>{o.name}</option>)}
          </select>
          <span style={{ color: "var(--text-faint)", fontSize: 12 }}>de</span>
          <input type="date" className="field" style={{ width: "auto" }} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          <span style={{ color: "var(--text-faint)", fontSize: 12 }}>até</span>
          <input type="date" className="field" style={{ width: "auto" }} value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          {hasFilters && <button className="btn-small" onClick={clearFilters}>Limpar filtros</button>}
        </div>
      </div>

      {loading ? (
        <div className="schedule-empty">
          <div className="loading-spinner" style={{ margin: "0 auto 12px auto" }} />
          <div>Carregando…</div>
        </div>
      ) : (
        <>
          {tab === "entries" && (
            <EntriesView
              entries={filteredEntries}
              shortagesByEntry={shortagesByEntry}
              operators={operators}
            />
          )}
          {tab === "conference" && (
            <ConferenceView
              queue={filteredQueue}
              history={filteredHistory}
            />
          )}
          {tab === "shortages" && (
            <ShortagesView
              shortages={filteredShortages}
              entries={entries}
            />
          )}
          {tab === "sessions" && (
            <SessionsView
              sessions={filteredSessions}
            />
          )}
          {tab === "errors" && (
            <ErrorsView
              errors={filteredErrors}
              operators={operators}
            />
          )}
        </>
      )}
    </div>
  );
}

// ============================================================
// Sub-componentes (views)
// ============================================================

function EntriesView({ entries, shortagesByEntry, operators }) {
  if (entries.length === 0) {
    return (
      <div className="card">
        <div className="schedule-empty">
          <div className="schedule-empty-icon">📭</div>
          <div>Nenhum lançamento encontrado com esses filtros.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-title">📋 Lançamentos ({entries.length})</div>
      <p style={{ fontSize: 12, color: "var(--text-faint)", marginTop: -8, marginBottom: 12 }}>
        Fase 3 trará edição e exclusão individual. Por enquanto, visualize tudo.
      </p>
      <div style={{ overflowX: "auto" }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Hora</th>
              <th>Operador</th>
              <th>Atividade</th>
              <th>Tipo</th>
              <th>Pedido/Transf.</th>
              <th>Cliente</th>
              <th>Duração</th>
              <th>Faltas</th>
              <th>Flags</th>
            </tr>
          </thead>
          <tbody>
            {entries.slice(0, 300).map((e) => {
              const faltas = shortagesByEntry[e.id] || [];
              const op = operators.find((x) => x.code === e.operator_code);
              const tipo = e.is_encaixe ? "⚡ Encaixe" : e.transfer_type ? `🔄 ${e.transfer_type}` : e.order_number ? "📦 Pedido" : "—";
              const ordem = e.transfer_number || e.order_number || "—";
              return (
                <tr key={e.id}>
                  <td>{fmtDate(e.start_time)}</td>
                  <td style={{ fontFamily: "var(--font-mono)" }}>{fmtClock(e.start_time).slice(0, 5)}</td>
                  <td style={{ fontFamily: "var(--font-display)" }}>{op?.name || e.operator_name}</td>
                  <td>{e.activity}</td>
                  <td>{tipo}</td>
                  <td style={{ fontFamily: "var(--font-mono)" }}>{ordem}</td>
                  <td style={{ color: "var(--text-muted)" }}>{e.customer_name || "—"}</td>
                  <td>{fmtDuration(e.duration_seconds)}</td>
                  <td style={{ color: faltas.length > 0 ? "var(--danger)" : "var(--text-muted)", fontWeight: faltas.length > 0 ? 600 : 400 }}>
                    {faltas.length > 0 ? `${faltas.length}` : "—"}
                  </td>
                  <td>
                    {e.manual_entry && <span className="outlier-tag" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>manual</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {entries.length > 300 && (
          <p style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 12, textAlign: "center" }}>
            Mostrando 300 de {entries.length}. Use os filtros pra refinar.
          </p>
        )}
      </div>
    </div>
  );
}

function ConferenceView({ queue, history }) {
  return (
    <>
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">⏳ Aguardando / Em conferência ({queue.length})</div>
        {queue.length === 0 ? (
          <div className="schedule-empty" style={{ padding: "20px 0" }}>
            <div style={{ fontSize: 13 }}>Mesa vazia.</div>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Pedido/Transf.</th>
                  <th>Cliente</th>
                  <th>Separado por</th>
                  <th>Separado em</th>
                  <th>Conferindo</th>
                  <th>Flags</th>
                </tr>
              </thead>
              <tbody>
                {queue.map((c) => (
                  <tr key={c.id}>
                    <td>
                      {c.status === "aguardando" ? (
                        <span style={{ color: "var(--warning)", fontWeight: 600 }}>⏳ Aguardando</span>
                      ) : (
                        <span style={{ color: "var(--accent)", fontWeight: 600 }}>🔍 Em conferência</span>
                      )}
                    </td>
                    <td style={{ fontFamily: "var(--font-mono)" }}>
                      {c.transfer_type ? `${c.transfer_type} #${c.transfer_number || ""}` : c.order_number ? `#${c.order_number}` : "—"}
                    </td>
                    <td style={{ color: "var(--text-muted)" }}>{c.customer_name || "—"}</td>
                    <td>{c.separated_by_name || "—"}</td>
                    <td>{fmtDateTime(c.separated_at)}</td>
                    <td>{c.conference_started_by_name || "—"}</td>
                    <td>
                      {c.is_encaixe && <span style={{ background: "var(--accent-2-soft)", color: "var(--accent-2)", padding: "2px 7px", borderRadius: 4, fontSize: 10, fontWeight: 600, marginRight: 4 }}>ENC.</span>}
                      {c.transfer_urgent && <span style={{ background: "var(--danger-soft)", color: "var(--danger)", padding: "2px 7px", borderRadius: 4, fontSize: 10, fontWeight: 600 }}>URGENTE</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-title">✅ Histórico de conferências ({history.length})</div>
        {history.length === 0 ? (
          <div className="schedule-empty" style={{ padding: "20px 0" }}>
            <div style={{ fontSize: 13 }}>Nenhuma conferência registrada.</div>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Pedido/Transf.</th>
                  <th>Cliente</th>
                  <th>Separado por</th>
                  <th>Conferido por</th>
                  <th>Finalizado em</th>
                  <th>Duração</th>
                </tr>
              </thead>
              <tbody>
                {history.slice(0, 200).map((c) => (
                  <tr key={c.id}>
                    <td>
                      {c.status === "conferido" ? (
                        <span style={{ color: "var(--ok)", fontWeight: 600 }}>✓ OK</span>
                      ) : (
                        <span style={{ color: "var(--danger)", fontWeight: 600 }}>⚠ {c.problem_reason || "Problema"}</span>
                      )}
                    </td>
                    <td style={{ fontFamily: "var(--font-mono)" }}>
                      {c.transfer_type ? `${c.transfer_type} #${c.transfer_number || ""}` : c.order_number ? `#${c.order_number}` : "—"}
                    </td>
                    <td style={{ color: "var(--text-muted)" }}>{c.customer_name || "—"}</td>
                    <td>{c.separated_by_name || "—"}</td>
                    <td>{c.conference_finished_by_name || "—"}</td>
                    <td>{c.conference_finished_at ? fmtDateTime(c.conference_finished_at) : "—"}</td>
                    <td>{c.duration_seconds ? fmtDuration(c.duration_seconds) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

function ShortagesView({ shortages, entries }) {
  const entryById = useMemo(() => {
    const map = {};
    entries.forEach((e) => { map[e.id] = e; });
    return map;
  }, [entries]);

  if (shortages.length === 0) {
    return (
      <div className="card">
        <div className="schedule-empty">
          <div className="schedule-empty-icon">📭</div>
          <div>Nenhuma falta encontrada com esses filtros.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-title">📦 Faltas de material ({shortages.length})</div>
      <div style={{ overflowX: "auto" }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Produto</th>
              <th>Qtd.</th>
              <th>Pedido</th>
              <th>Cliente</th>
              <th>Operador</th>
              <th>Atividade</th>
            </tr>
          </thead>
          <tbody>
            {shortages.slice(0, 300).map((s) => {
              const e = entryById[s.entry_id];
              return (
                <tr key={s.id}>
                  <td>{s.created_at ? fmtDate(s.created_at) : "—"}</td>
                  <td style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>{s.product_code}</td>
                  <td style={{ color: "var(--danger)", fontWeight: 600 }}>{s.quantity}</td>
                  <td style={{ fontFamily: "var(--font-mono)" }}>{e?.order_number || "—"}</td>
                  <td style={{ color: "var(--text-muted)" }}>{e?.customer_name || "—"}</td>
                  <td>{e?.operator_name || "—"}</td>
                  <td>{e?.activity || "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {shortages.length > 300 && (
          <p style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 12, textAlign: "center" }}>
            Mostrando 300 de {shortages.length}.
          </p>
        )}
      </div>
    </div>
  );
}

function SessionsView({ sessions }) {
  if (sessions.length === 0) {
    return (
      <div className="card">
        <div className="schedule-empty">
          <div className="schedule-empty-icon">📭</div>
          <div>Nenhuma sessão em andamento agora.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-title">⏱ Sessões em andamento ({sessions.length})</div>
      <p style={{ fontSize: 12, color: "var(--text-faint)", marginTop: -8, marginBottom: 12 }}>
        Fase 6 trará edição, finalização forçada e cancelamento. Por enquanto, visualize tudo.
      </p>
      <div style={{ overflowX: "auto" }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Operador</th>
              <th>Atividade</th>
              <th>Início</th>
              <th>Tempo decorrido</th>
              <th>Pedido/Transf.</th>
              <th>Cliente</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => {
              const elapsed = Math.round((Date.now() - new Date(s.start_time).getTime()) / 1000);
              return (
                <tr key={s.operator_code}>
                  <td style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}>{s.operator_name}</td>
                  <td>{s.activity}</td>
                  <td>{fmtDateTime(s.start_time)}</td>
                  <td style={{ fontFamily: "var(--font-mono)", color: "var(--accent)", fontWeight: 600 }}>
                    {fmtDuration(elapsed)}
                  </td>
                  <td style={{ fontFamily: "var(--font-mono)" }}>
                    {s.transfer_type ? `${s.transfer_type} #${s.transfer_number || ""}` : s.order_number ? `#${s.order_number}` : "—"}
                  </td>
                  <td style={{ color: "var(--text-muted)" }}>{s.customer_name || "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ErrorsView({ errors, operators }) {
  if (errors.length === 0) {
    return (
      <div className="card">
        <div className="schedule-empty">
          <div className="schedule-empty-icon">📭</div>
          <div>Nenhum erro encontrado com esses filtros.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-title">🚨 Erros de separação ({errors.length})</div>
      <div style={{ overflowX: "auto" }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Pedido/Transf.</th>
              <th>Tipo de erro</th>
              <th>Quem errou</th>
              <th>Quem apontou</th>
              <th>Observação</th>
            </tr>
          </thead>
          <tbody>
            {errors.slice(0, 300).map((e) => {
              const opErr = operators.find((x) => x.code === e.error_operator_code);
              const opApo = operators.find((x) => x.code === e.operator_code);
              return (
                <tr key={e.id}>
                  <td>{fmtDate(e.created_at)}</td>
                  <td style={{ fontFamily: "var(--font-mono)" }}>{e.order_number || "—"}</td>
                  <td>{e.error_type}</td>
                  <td style={{ color: "var(--danger)", fontWeight: 600 }}>{opErr?.name || e.error_operator_name || "—"}</td>
                  <td style={{ color: "var(--text-muted)" }}>{opApo?.name || e.operator_name}</td>
                  <td style={{ color: "var(--text-muted)" }}>{e.note || "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {errors.length > 300 && (
          <p style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 12, textAlign: "center" }}>
            Mostrando 300 de {errors.length}.
          </p>
        )}
      </div>
    </div>
  );
}