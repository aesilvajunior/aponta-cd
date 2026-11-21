import React, { useEffect, useMemo, useState } from "react";
import { fetchShortages, fetchEntries, fetchOperators, fetchActivities } from "../lib/api";
import { fetchMapAreas, fetchMapItems } from "../lib/stockMap";
import {
  fetchCyclicCountTasks,
  buildCyclicTaskFromShortage,
  createCyclicCountTask,
} from "../lib/cyclicInventory";
import { fmtClock, fmtDate, localISODate } from "../lib/format";
import { exportShortagesCsv } from "../utils/csv";
import { supabase } from "../supabaseClient";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import {
  IconDownload,
  IconPackage,
  IconBuilding,
  IconList,
  IconX,
} from "./Icons";

const COLORS = ["#1e3a5f", "#4a7ba7", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444"];

export default function ShortagePanel({ onOpenScanTask, initialScope = "all" }) {
  const [shortages, setShortages] = useState([]);
  const [entries, setEntries] = useState([]);
  const [operators, setOperators] = useState([]);
  const [activities, setActivities] = useState([]);
  const [mapAreas, setMapAreas] = useState([]);
  const [mapItems, setMapItems] = useState([]);
  const [cyclicTasks, setCyclicTasks] = useState([]);
  const [triggerMsg, setTriggerMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [scope, setScope] = useState(initialScope); // "all" | "pedido" | "transferencia"
  useEffect(() => { setScope(initialScope); }, [initialScope]);

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filterProduct, setFilterProduct] = useState("");
  const [filterCustomer, setFilterCustomer] = useState("");
  const [filterOperator, setFilterOperator] = useState("");
  const [filterEncaixe, setFilterEncaixe] = useState("");

  async function load() {
    setLoading(true);
    const [
      { data: s, error: e1 },
      { data: e, error: e2 },
      { data: o, error: e3 },
      { data: a, error: e4 },
    ] = await Promise.all([
      fetchShortages({ limit: 5000 }),
      fetchEntries({ limit: 5000 }),
      fetchOperators(),
      fetchActivities(),
    ]);
    const firstError = e1 || e2 || e3 || e4;
    if (firstError) {
      setError(firstError.message);
      setLoading(false);
      return;
    }
    setShortages(s || []);
    setEntries(e || []);
    setOperators(o || []);
    setActivities(a || []);
    setError("");
    setLoading(false);

    // Carrega mapa + tarefas de inventário cíclico (melhor esforço)
    Promise.all([
      fetchMapAreas().catch(() => ({ data: [] })),
      fetchMapItems().catch(() => ({ data: [] })),
      fetchCyclicCountTasks({ limit: 200 }).catch(() => ({ data: [] })),
    ]).then(([ma, mi, ct]) => {
      setMapAreas(ma?.data || []);
      setMapItems(mi?.data || []);
      setCyclicTasks(ct?.data || []);
    });
  }

  useEffect(() => {
    load();
    const ch = supabase
      .channel("shortage-panel-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "entry_shortages" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "entries" }, load)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, []);

  const entryById = useMemo(() => {
    const map = {};
    entries.forEach((e) => { map[e.id] = e; });
    return map;
  }, [entries]);

  const rows = useMemo(() => {
    return shortages
      .map((s) => {
        const e = entryById[s.entry_id];
        if (!e) return null;
        return {
          id: s.id,
          entryId: s.entry_id,
          date: e.start_time,
          time: fmtClock(e.start_time).slice(0, 5),
          productCode: s.product_code,
          quantity: s.quantity,
          operatorName: e.operator_name,
          operatorCode: e.operator_code,
          activity: e.activity,
          shift: e.shift,
          orderNumber: e.order_number,
          customerName: e.customer_name,
          isEncaixe: e.is_encaixe,
          station: e.station,
          note: e.note,
        };
      })
      .filter(Boolean);
  }, [shortages, entryById]);

  const filteredRows = useMemo(() => {
    return rows
      .filter((r) => {
        const d = localISODate(r.date);
        if (dateFrom && d < dateFrom) return false;
        if (dateTo && d > dateTo) return false;
        return true;
      })
      .filter((r) => !filterProduct.trim() || r.productCode.toLowerCase().includes(filterProduct.trim().toLowerCase()))
      .filter((r) => !filterCustomer.trim() || (r.customerName || "").toLowerCase().includes(filterCustomer.trim().toLowerCase()))
      .filter((r) => !filterOperator || r.operatorCode === filterOperator)
      .filter((r) => {
        if (filterEncaixe === "yes") return r.isEncaixe === true;
        if (filterEncaixe === "no") return !r.isEncaixe;
        return true;
      })
      .filter((r) => {
        if (scope === "all") return true;
        const ord = String(r.orderNumber || "").toUpperCase();
        const act = String(r.activity || "").toLowerCase();
        const cust = String(r.customerName || "").toLowerCase();
        const isTransf =
          ord.startsWith("AP") ||
          ord.startsWith("ZN") ||
          ord.includes("TRANSF") ||
          act.includes("transf") ||
          cust.includes("transf") ||
          cust.includes("filial");
        return scope === "transferencia" ? isTransf : !isTransf;
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [rows, dateFrom, dateTo, filterProduct, filterCustomer, filterOperator, filterEncaixe, scope]);

  const stats = useMemo(() => {
    const totalFaltas = filteredRows.length;
    const totalPedidos = new Set(filteredRows.map((r) => r.orderNumber).filter(Boolean)).size;
    const totalQtd = filteredRows.reduce((sum, r) => sum + (r.quantity || 0), 0);
    const totalProdutos = new Set(filteredRows.map((r) => r.productCode)).size;
    return { totalFaltas, totalPedidos, totalQtd, totalProdutos };
  }, [filteredRows]);

  const topProducts = useMemo(() => {
    const byCode = {};
    filteredRows.forEach((r) => {
      if (!byCode[r.productCode]) byCode[r.productCode] = { code: r.productCode, totalQty: 0, count: 0 };
      byCode[r.productCode].totalQty += r.quantity || 0;
      byCode[r.productCode].count += 1;
    });
    return Object.values(byCode).sort((a, b) => b.totalQty - a.totalQty).slice(0, 10);
  }, [filteredRows]);

  const topCustomers = useMemo(() => {
    const byCustomer = {};
    filteredRows.forEach((r) => {
      const name = r.customerName || "(sem cliente)";
      if (!byCustomer[name]) byCustomer[name] = { name, totalQty: 0, count: 0 };
      byCustomer[name].totalQty += r.quantity || 0;
      byCustomer[name].count += 1;
    });
    return Object.values(byCustomer).sort((a, b) => b.totalQty - a.totalQty).slice(0, 10);
  }, [filteredRows]);

  function clearFilters() {
    setDateFrom("");
    setDateTo("");
    setFilterProduct("");
    setFilterCustomer("");
    setFilterOperator("");
    setFilterEncaixe("");
  }

  function handleExport() {
    if (!filteredRows.length) {
      alert("Nada para exportar.");
      return;
    }
    exportShortagesCsv(filteredRows);
  }

  const taskByShortageRef = useMemo(() => {
    const m = {};
    cyclicTasks.forEach((t) => {
      if (t.trigger_ref_id) m[t.trigger_ref_id] = t;
    });
    return m;
  }, [cyclicTasks]);

  const pendingCyclicCount = useMemo(
    () => cyclicTasks.filter((t) => t.status === "pendente" && t.trigger_source === "falta").length,
    [cyclicTasks]
  );

  async function triggerCountForRow(row, openAfter = false) {
    const entry = entryById[row.entryId] || { id: row.entryId, order_number: row.orderNumber };
    const payload = buildCyclicTaskFromShortage({
      shortage: { id: row.id, product_code: row.productCode, quantity: row.quantity },
      entry,
      areas: mapAreas,
      items: mapItems,
    });
    const res = await createCyclicCountTask(payload);
    if (res.data) {
      setCyclicTasks((prev) => [res.data, ...prev.filter((t) => t.id !== res.data.id)]);
      setTriggerMsg(
        res.duplicate
          ? `Contagem cega para ${row.productCode} já estava na fila (${res.data.area_code}).`
          : `Contagem cega gerada para ${row.productCode} em ${res.data.area_code}.`
      );
      setTimeout(() => setTriggerMsg(""), 3500);
      if (openAfter && onOpenScanTask) onOpenScanTask(res.data);
    }
  }

  async function triggerAllFilteredShortages() {
    const recent = filteredRows.slice(0, 20);
    let created = 0;
    for (const r of recent) {
      const ref = `shortage:${r.id}`;
      if (taskByShortageRef[ref]) continue;
      const entry = entryById[r.entryId] || { id: r.entryId, order_number: r.orderNumber };
      const payload = buildCyclicTaskFromShortage({
        shortage: { id: r.id, product_code: r.productCode, quantity: r.quantity },
        entry,
        areas: mapAreas,
        items: mapItems,
      });
      const res = await createCyclicCountTask(payload);
      if (res.data && !res.duplicate) created += 1;
    }
    const { data: updated } = await fetchCyclicCountTasks({ limit: 200 });
    setCyclicTasks(updated || []);
    setTriggerMsg(
      created > 0
        ? `${created} tarefa(s) de contagem cega gerada(s) para o inventário cíclico.`
        : "Todas as faltas recentes já possuem tarefa de contagem cega."
    );
    setTimeout(() => setTriggerMsg(""), 4000);
  }

  const hasFilters = dateFrom || dateTo || filterProduct || filterCustomer || filterOperator || filterEncaixe;

    return (
    <div>
      <div className="page-header-row" style={{ marginBottom: 16 }}>
        <div>
          <h1 className="page-title">
            {scope === "transferencia"
              ? "Faltas por transferência"
              : scope === "pedido"
              ? "Faltas em pedidos"
              : "Todas as faltas"}
          </h1>
          <p className="page-sub" style={{ marginBottom: 0 }}>
            {filteredRows.length} falta{filteredRows.length !== 1 ? "s" : ""} no período · {stats.totalPedidos} pedido{stats.totalPedidos !== 1 ? "s" : ""} afetado{stats.totalPedidos !== 1 ? "s" : ""}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn-small" onClick={triggerAllFilteredShortages} disabled={filteredRows.length === 0}>
            Gerar contagem cega ({pendingCyclicCount} pendente{pendingCyclicCount !== 1 ? "s" : ""})
          </button>
          {onOpenScanTask && pendingCyclicCount > 0 && (
            <button className="btn-small btn-excel" onClick={() => onOpenScanTask(null)}>
              Abrir inventário cíclico →
            </button>
          )}
          <button className="btn-small btn-excel" onClick={handleExport}>
            <IconDownload size={14} /> Exportar CSV
          </button>
        </div>
      </div>

      {/* Filtro rápido de escopo de faltas */}
      <div className="quick-filters" style={{ marginBottom: 18 }}>
        <span className="quick-filters-label">Categoria:</span>
        {[
          { key: "all", label: "Todas as faltas" },
          { key: "transferencia", label: "Por transferência" },
          { key: "pedido", label: "Somente pedidos" },
        ].map((opt) => (
          <button
            key={opt.key}
            type="button"
            className={`quick-filter-btn ${scope === opt.key ? "active" : ""}`}
            onClick={() => setScope(opt.key)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {triggerMsg && (
        <div className="alert-card" style={{ marginBottom: 16, background: "var(--ok-soft)", borderColor: "var(--ok)", color: "var(--ok)" }}>
          {triggerMsg}
        </div>
      )}

      {error && (
        <div className="alert-card alert-danger" style={{ marginBottom: 20 }}>
          Erro ao carregar: <code>{error}</code>
        </div>
      )}

      <div className="stat-strip" style={{ marginBottom: 20 }}>
        <div className="stat-cell">
          <div className="stat-num danger">{stats.totalFaltas}</div>
          <div className="stat-label">Faltas registradas</div>
        </div>
        <div className="stat-cell">
          <div className="stat-num">{stats.totalPedidos}</div>
          <div className="stat-label">Pedidos afetados</div>
        </div>
        <div className="stat-cell">
          <div className="stat-num accent">{stats.totalProdutos}</div>
          <div className="stat-label">Produtos distintos</div>
        </div>
        <div className="stat-cell">
          <div className="stat-num">{stats.totalQtd}</div>
          <div className="stat-label">Unidades faltantes</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">Filtros</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input type="date" className="field" style={{ width: "auto" }} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          <span style={{ color: "var(--text-faint)", fontSize: 12 }}>até</span>
          <input type="date" className="field" style={{ width: "auto" }} value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          <input className="field" style={{ width: 160, fontFamily: "var(--font-mono)" }} placeholder="Código produto" value={filterProduct} onChange={(e) => setFilterProduct(e.target.value)} />
          <input className="field" style={{ width: 200 }} placeholder="Cliente" value={filterCustomer} onChange={(e) => setFilterCustomer(e.target.value)} />
          <select className="field" style={{ width: "auto" }} value={filterOperator} onChange={(e) => setFilterOperator(e.target.value)}>
            <option value="">Todos operadores</option>
            {operators.map((o) => (
              <option key={o.code} value={o.code}>{o.name}</option>
            ))}
          </select>
          <select className="field" style={{ width: "auto" }} value={filterEncaixe} onChange={(e) => setFilterEncaixe(e.target.value)}>
            <option value="">Todos (encaixe)</option>
            <option value="yes">Só encaixes</option>
            <option value="no">Sem encaixe</option>
          </select>
          {hasFilters && (
            <button className="btn-small" onClick={clearFilters}>
              <IconX size={13} /> Limpar filtros
            </button>
          )}
        </div>
      </div>

      {topProducts.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-title">Produtos que mais faltam</div>
          <ResponsiveContainer width="100%" height={Math.max(180, topProducts.length * 32)}>
            <BarChart data={topProducts} layout="vertical">
              <CartesianGrid stroke="var(--border)" horizontal={false} />
              <XAxis type="number" tick={{ fill: "var(--text-muted)", fontSize: 11 }} allowDecimals={false} />
              <YAxis
                type="category"
                dataKey="code"
                tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                width={90}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  fontSize: 12,
                  borderRadius: 10,
                }}
                labelStyle={{ color: "var(--text)" }}
              />
              <Bar dataKey="totalQty" name="Quantidade" radius={[0, 4, 4, 0]}>
                {topProducts.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {topCustomers.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-title">Clientes mais afetados</div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Faltas</th>
                <th>Quantidade total</th>
              </tr>
            </thead>
            <tbody>
              {topCustomers.map((c) => (
                <tr key={c.name}>
                  <td style={{ fontFamily: "var(--font-display)" }}>{c.name}</td>
                  <td>{c.count}</td>
                  <td style={{ color: "var(--danger)", fontWeight: 600 }}>{c.totalQty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="card">
        <div className="card-title">Todas as faltas</div>

        {loading ? (
          <div className="schedule-empty">Carregando...</div>
        ) : filteredRows.length === 0 ? (
          <div className="schedule-empty">
            <div className="schedule-empty-icon"><IconPackage size={36} /></div>
            <div>Nenhuma falta registrada {hasFilters ? "com esses filtros" : "ainda"}.</div>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Hora</th>
                  <th>Cód. Produto</th>
                  <th>Qtd.</th>
                  <th>Operador</th>
                  <th>Atividade</th>
                  <th>Pedido</th>
                  <th>Cliente</th>
                  <th>Encaixe</th>
                  <th>Estação</th>
                  <th>Contagem cega</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.slice(0, 300).map((r) => {
                  const task = taskByShortageRef[`shortage:${r.id}`];
                  return (
                  <tr key={r.id}>
                    <td>{fmtDate(r.date)}</td>
                    <td style={{ fontFamily: "var(--font-mono)" }}>{r.time}</td>
                    <td style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>{r.productCode}</td>
                    <td style={{ color: "var(--danger)", fontWeight: 600 }}>{r.quantity}</td>
                    <td style={{ fontFamily: "var(--font-display)" }}>{r.operatorName}</td>
                    <td>{r.activity}</td>
                    <td style={{ fontFamily: "var(--font-mono)" }}>{r.orderNumber || "—"}</td>
                    <td style={{ color: "var(--text-muted)" }}>{r.customerName || "—"}</td>
                    <td>
                      {r.isEncaixe ? (
                        <span
                          style={{
                            background: "var(--accent-2-soft)",
                            color: "var(--accent-2)",
                            padding: "3px 8px",
                            borderRadius: 5,
                            fontSize: 10.5,
                            fontWeight: 700,
                          }}
                        >
                          ENC.
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td style={{ color: "var(--text-muted)" }}>{r.station || "—"}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {task ? (
                        task.status === "concluida" ? (
                          <span style={{ color: "var(--ok)", fontWeight: 700, fontSize: 11.5 }}>
                            ✓ Contado ({task.counted_quantity ?? 0})
                          </span>
                        ) : (
                          <button
                            className="btn-small"
                            style={{ padding: "4px 8px", fontSize: 11 }}
                            onClick={() => onOpenScanTask?.(task)}
                          >
                            Contar ({task.area_code}) →
                          </button>
                        )
                      ) : (
                        <button
                          className="btn-small"
                          style={{ padding: "4px 8px", fontSize: 11 }}
                          onClick={() => triggerCountForRow(r, !!onOpenScanTask)}
                        >
                          + Contagem cega
                        </button>
                      )}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredRows.length > 300 && (
              <p
                style={{
                  fontSize: 12,
                  color: "var(--text-faint)",
                  marginTop: 14,
                  textAlign: "center",
                }}
              >
                Mostrando 300 de {filteredRows.length} faltas. Use os filtros ou exporte o CSV para ver tudo.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}