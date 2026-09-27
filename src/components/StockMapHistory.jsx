import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { fetchStockMapHistory } from "../lib/api";
import { fmtClock, fmtDate } from "../lib/format";
import { IconRefresh, IconList, IconHistory } from "./Icons";

const ACTION_LABEL = {
  criar: "Criou área",
  editar: "Editou área",
  mover: "Moveu área",
  resize: "Redimensionou área",
  remover: "Removeu área",
  item_add: "Adicionou item",
  item_edit: "Editou item",
  item_remove: "Removeu item",
};

const ACTION_COLOR = {
  criar: "var(--ok)",
  editar: "var(--accent)",
  mover: "var(--warning)",
  resize: "var(--warning)",
  remover: "var(--danger)",
  item_add: "var(--ok)",
  item_edit: "var(--accent)",
  item_remove: "var(--danger)",
};

export default function StockMapHistory() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterArea, setFilterArea] = useState("");

  async function load() {
    setLoading(true);
    const { data } = await fetchStockMapHistory({ limit: 500 });
    setHistory(data || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const ch = supabase
      .channel("stock-map-history")
      .on("postgres_changes", { event: "*", schema: "public", table: "stock_map_history" }, load)
      .subscribe();
    return () => supabase.removeChannel(ch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = history.filter((h) => {
    if (!filterArea.trim()) return true;
    return (h.area_code || "").toLowerCase().includes(filterArea.toLowerCase());
  });

  function prettyDiff(h) {
    if (h.action !== "editar" && h.action !== "mover" && h.action !== "resize") return null;
    const before = h.before_data || {};
    const after = h.after_data || {};
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    const diffs = [];
    keys.forEach((k) => {
      if (before[k] !== after[k]) {
        diffs.push(`${k}: ${JSON.stringify(before[k])} → ${JSON.stringify(after[k])}`);
      }
    });
    return diffs.length > 0 ? diffs.join(" · ") : null;
  }

  return (
    <div>
      <div className="page-header-row" style={{ marginBottom: 20 }}>
        <div>
          <h1 className="page-title">Histórico do mapa</h1>
          <p className="page-sub" style={{ marginBottom: 0 }}>
            Todas as alterações no mapa de estoque
          </p>
        </div>
        <button className="btn-small" onClick={load}><IconRefresh size={14} /> Atualizar</button>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">Filtros</div>
        <input
          className="field"
          placeholder="Buscar por código da área..."
          value={filterArea}
          onChange={(e) => setFilterArea(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="schedule-empty">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <div className="schedule-empty">
            <div className="schedule-empty-icon"><IconHistory size={36} /></div>
            <div>Nenhuma alteração registrada.</div>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="card-title">Alterações ({filtered.length})</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filtered.map((h) => {
              const color = ACTION_COLOR[h.action] || "var(--text-muted)";
              const diff = prettyDiff(h);
              return (
                <div key={h.id} style={{ padding: "12px 14px", background: "var(--surface-raised)", border: "1px solid var(--border)", borderLeft: `3px solid ${color}`, borderRadius: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color }}>{ACTION_LABEL[h.action] || h.action}</span>
                        {h.area_code && (
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--accent)" }}>
                            {h.area_code}
                          </span>
                        )}
                        {h.actor_name && (
                          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                            por {h.actor_name}
                          </span>
                        )}
                      </div>
                      {diff && (
                        <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 6, fontFamily: "var(--font-mono)" }}>
                          {diff}
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--text-faint)", whiteSpace: "nowrap" }}>
                      {fmtDate(h.created_at)} {fmtClock(h.created_at).slice(0, 5)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}