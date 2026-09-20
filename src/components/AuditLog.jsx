import React, { useEffect, useMemo, useState } from "react";
import { fetchAuditLog, deleteAllAuditLog } from "../lib/api";
import { supabase } from "../supabaseClient";
import { fmtClock, fmtDate } from "../lib/format";

// Ações possíveis (com ícone e cor)
const ACTIONS = {
  criar: { icon: "＋", label: "criou", className: "criar" },
  editar: { icon: "✎", label: "editou", className: "editar" },
  remover: { icon: "✕", label: "removeu", className: "remover" },
};

// Entidades (com nome amigável)
const ENTITIES = {
  operator: "Operador",
  activity: "Atividade",
  vehicle: "Veículo",
  error_type: "Tipo de erro",
  admin_config: "Configuração",
  entry: "Registro",
  separation_error: "Erro de separação",
  shortage: "Falta",
  session: "Sessão",
};

function fmtDateTimeFull(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// Formata um objeto JSON como string legível
function prettyJson(obj) {
  if (!obj) return null;
  try {
    const keys = Object.keys(obj);
    if (keys.length === 0) return null;
    return keys
      .filter((k) => obj[k] !== null && obj[k] !== undefined && obj[k] !== "")
      .map((k) => `${k}: ${JSON.stringify(obj[k])}`)
      .join(" · ");
  } catch {
    return String(obj);
  }
}

export default function AuditLog() {
  const [log, setLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterEntity, setFilterEntity] = useState("");
  const [filterAction, setFilterAction] = useState("");
  const [filterActor, setFilterActor] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [confirmingReset, setConfirmingReset] = useState(false);
  const [resetPhrase, setResetPhrase] = useState("");
  const [resetting, setResetting] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await fetchAuditLog({ limit: 1000 });
    if (!error && data) setLog(data);
    setLoading(false);
  }

  useEffect(() => {
    load();

    const channel = supabase
      .channel("audit-log-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "audit_log" }, () => {
        load();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Lista de operadores que aparecem no log (pra filtro)
  const knownActors = useMemo(() => {
    const map = new Map();
    log.forEach((item) => {
      if (item.actor_code && !map.has(item.actor_code)) {
        map.set(item.actor_code, item.actor_name || item.actor_code);
      }
    });
    return Array.from(map.entries())
      .map(([code, name]) => ({ code, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [log]);

  const filtered = useMemo(() => {
    return log.filter((item) => {
      if (filterEntity && item.entity !== filterEntity) return false;
      if (filterAction && item.action !== filterAction) return false;
      if (filterActor && item.actor_code !== filterActor) return false;
      const d = new Date(item.created_at);
      if (dateFrom && d < new Date(dateFrom + "T00:00:00")) return false;
      if (dateTo && d > new Date(dateTo + "T23:59:59")) return false;
      return true;
    });
  }, [log, filterEntity, filterAction, filterActor, dateFrom, dateTo]);

  function clearFilters() {
    setFilterEntity("");
    setFilterAction("");
    setFilterActor("");
    setDateFrom("");
    setDateTo("");
  }

  async function confirmReset() {
    if (resetPhrase.trim().toUpperCase() !== "ZERAR") return;
    setResetting(true);
    await deleteAllAuditLog();
    setResetting(false);
    setConfirmingReset(false);
    setResetPhrase("");
    await load();
  }

  const hasFilters = filterEntity || filterAction || filterActor || dateFrom || dateTo;

  return (
    <div>
      <div className="page-header-row" style={{ marginBottom: 22 }}>
        <div>
          <h1 className="page-title">Histórico de alterações</h1>
          <p className="page-sub" style={{ marginBottom: 0 }}>
            Todas as alterações feitas em operadores, atividades, veículos, tipos de erro e configurações.
            {filtered.length !== log.length && ` Mostrando ${filtered.length} de ${log.length}.`}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn-small" onClick={load}>Atualizar</button>
          <button className="btn-danger-outline" onClick={() => setConfirmingReset((v) => !v)}>
            Zerar histórico
          </button>
        </div>
      </div>

      {confirmingReset && (
        <div className="confirm-box" style={{ marginBottom: 22 }}>
          <strong style={{ color: "var(--danger)", fontSize: 14 }}>
            Isso apaga todo o histórico de alterações, permanentemente.
          </strong>
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "6px 0 12px 0" }}>
            As ações em si <strong>não</strong> são desfeitas — só o registro do que foi feito. Digite <strong>ZERAR</strong> abaixo.
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              className="field"
              style={{ flex: 1 }}
              placeholder="Digite ZERAR"
              value={resetPhrase}
              onChange={(e) => setResetPhrase(e.target.value)}
            />
            <button
              className="btn-danger-outline"
              onClick={confirmReset}
              disabled={resetPhrase.trim().toUpperCase() !== "ZERAR" || resetting}
            >
              {resetting ? "Apagando..." : "Confirmar"}
            </button>
            <button className="btn-small" onClick={() => { setConfirmingReset(false); setResetPhrase(""); }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="audit-filters">
          <select className="field" style={{ width: "auto" }} value={filterEntity} onChange={(e) => setFilterEntity(e.target.value)}>
            <option value="">Todas as entidades</option>
            {Object.entries(ENTITIES).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>

          <select className="field" style={{ width: "auto" }} value={filterAction} onChange={(e) => setFilterAction(e.target.value)}>
            <option value="">Todas as ações</option>
            <option value="criar">Criações</option>
            <option value="editar">Edições</option>
            <option value="remover">Remoções</option>
          </select>

          {knownActors.length > 0 && (
            <select className="field" style={{ width: "auto" }} value={filterActor} onChange={(e) => setFilterActor(e.target.value)}>
              <option value="">Todos os autores</option>
              {knownActors.map((a) => (
                <option key={a.code} value={a.code}>{a.name}</option>
              ))}
            </select>
          )}

          <span style={{ color: "var(--text-faint)", fontSize: 12 }}>de</span>
          <input type="date" className="field" style={{ width: "auto" }} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          <span style={{ color: "var(--text-faint)", fontSize: 12 }}>até</span>
          <input type="date" className="field" style={{ width: "auto" }} value={dateTo} onChange={(e) => setDateTo(e.target.value)} />

          {hasFilters && <button className="btn-small" onClick={clearFilters}>Limpar filtros</button>}
        </div>
      </div>

      {/* Lista */}
      <div className="card">
        {loading ? (
          <div className="audit-empty">
            <div className="loading-spinner" style={{ margin: "0 auto 12px auto" }} />
            <div>Carregando histórico…</div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="audit-empty">
            <div className="audit-empty-icon">📭</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>
              {log.length === 0 ? "Nenhuma alteração registrada ainda" : "Nenhum resultado com esses filtros"}
            </div>
            <div style={{ fontSize: 13 }}>
              {log.length === 0
                ? "Quando alguém criar, editar ou remover algo, vai aparecer aqui."
                : "Tenta limpar os filtros pra ver tudo."}
            </div>
          </div>
        ) : (
          <div className="audit-timeline">
            {filtered.map((item) => {
              const action = ACTIONS[item.action] || { icon: "•", label: item.action, className: "" };
              const entityLabel = ENTITIES[item.entity] || item.entity;
              const before = prettyJson(item.before_data);
              const after = prettyJson(item.after_data);

              return (
                <div key={item.id} className="audit-item">
                  <div className={`audit-icon ${action.className}`}>
                    {action.icon}
                  </div>

                  <div className="audit-content">
                    <div className="audit-header">
                      <span className="audit-actor">{item.actor_name || "Sistema"}</span>
                      <span className="audit-action">{action.label}</span>
                      <span className="audit-entity">{entityLabel}</span>
                      {item.entity_id && (
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--text-muted)" }}>
                          {item.entity_id}
                        </span>
                      )}
                      <span className="audit-date">{fmtDateTimeFull(item.created_at)}</span>
                    </div>

                    {item.details && (
                      <div className="audit-details">{item.details}</div>
                    )}

                    {(before || after) && item.action === "editar" && (
                      <div className="audit-diff">
                        {before && <span className="audit-diff-before">{before}</span>}
                        {before && after && <span style={{ margin: "0 8px" }}>→</span>}
                        {after && <span className="audit-diff-after">{after}</span>}
                      </div>
                    )}

                    {!before && after && item.action === "criar" && (
                      <div className="audit-diff">
                        <span className="audit-diff-after">{after}</span>
                      </div>
                    )}
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