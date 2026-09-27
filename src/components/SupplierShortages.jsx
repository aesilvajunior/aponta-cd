import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import { fetchEntries, fetchShortages } from "../lib/api";
import { fmtDate } from "../lib/format";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { IconPackage, IconRefresh, IconDownload } from "./Icons";

const COLORS = ["#ef4444", "#f97316", "#f59e0b", "#eab308", "#84cc16", "#22c55e", "#10b981"];

export default function SupplierShortages() {
  const [shortages, setShortages] = useState([]);
  const [entries, setEntries] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  async function load() {
    setLoading(true);
    const [{ data: sh }, { data: en }, { data: sc }] = await Promise.all([
      fetchShortages({ limit: 5000 }),
      fetchEntries({ limit: 5000 }),
      supabase.from("delivery_schedules").select("supplier_name, invoice_number, scheduled_date").limit(5000),
    ]);
    setShortages(sh || []);
    setEntries(en || []);
    setSchedules(sc || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const ch = supabase
      .channel("supplier-shortages")
      .on("postgres_changes", { event: "*", schema: "public", table: "entry_shortages" }, load)
      .subscribe();
    return () => supabase.removeChannel(ch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const entryById = useMemo(() => {
    const m = {};
    entries.forEach((e) => { m[e.id] = e; });
    return m;
  }, [entries]);

  const supplierByInvoice = useMemo(() => {
    const m = {};
    schedules.forEach((s) => {
      if (s.invoice_number) m[String(s.invoice_number)] = s.supplier_name;
    });
    return m;
  }, [schedules]);

  const rows = useMemo(() => {
    return shortages.map((s) => {
      const e = entryById[s.entry_id];
      if (!e) return null;
      return {
        id: s.id,
        date: e.start_time,
        productCode: s.product_code,
        quantity: s.quantity,
        supplierName: s.supplier_name || supplierByInvoice[String(e.invoice_number)] || "Não identificado",
        orderNumber: e.order_number,
        customerName: e.customer_name,
        operatorName: e.operator_name,
        activity: e.activity,
      };
    }).filter(Boolean);
  }, [shortages, entryById, supplierByInvoice]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const d = new Date(r.date);
      if (dateFrom && d < new Date(dateFrom + "T00:00:00")) return false;
      if (dateTo && d > new Date(dateTo + "T23:59:59")) return false;
      return true;
    });
  }, [rows, dateFrom, dateTo]);

  const bySupplier = useMemo(() => {
    const m = {};
    filtered.forEach((r) => {
      const key = r.supplierName || "Não identificado";
      if (!m[key]) m[key] = { supplier: key, occurrences: 0, totalQty: 0, products: new Set() };
      m[key].occurrences += 1;
      m[key].totalQty += r.quantity || 0;
      m[key].products.add(r.productCode);
    });
    return Object.values(m)
      .map((x) => ({ ...x, products: x.products.size }))
      .sort((a, b) => b.totalQty - a.totalQty);
  }, [filtered]);

  function exportCsv() {
    if (filtered.length === 0) return alert("Nada para exportar.");
    const lines = [];
    lines.push("FALTAS POR FORNECEDOR");
    lines.push("");
    lines.push("Data;Fornecedor;Produto;Qtd;Pedido;Cliente;Operador");
    filtered.forEach((r) => {
      lines.push([
        fmtDate(r.date), r.supplierName, r.productCode, r.quantity,
        r.orderNumber || "—", r.customerName || "—", r.operatorName || "—",
      ].join(";"));
    });
    const csv = "\ufeff" + lines.join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `faltas_fornecedor_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="page-header-row" style={{ marginBottom: 20 }}>
        <div>
          <h1 className="page-title">Faltas por fornecedor</h1>
          <p className="page-sub" style={{ marginBottom: 0 }}>
            Identifique quais fornecedores estão gerando mais faltas
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn-small" onClick={load}><IconRefresh size={14} /> Atualizar</button>
          <button className="btn-small btn-excel" onClick={exportCsv}><IconDownload size={14} /> Exportar</button>
        </div>
      </div>

      {error && <div className="alert-card alert-danger" style={{ marginBottom: 20 }}>{error}</div>}

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">Filtros</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "var(--text-faint)" }}>de</span>
          <input type="date" className="field" style={{ width: "auto" }} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          <span style={{ fontSize: 12, color: "var(--text-faint)" }}>até</span>
          <input type="date" className="field" style={{ width: "auto" }} value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
      </div>

      {loading ? (
        <div className="schedule-empty">Carregando...</div>
      ) : bySupplier.length === 0 ? (
        <div className="card">
          <div className="schedule-empty">
            <div className="schedule-empty-icon"><IconPackage size={36} /></div>
            <div>Nenhuma falta registrada no período.</div>
          </div>
        </div>
      ) : (
        <>
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-title">Top fornecedores com falta</div>
            <ResponsiveContainer width="100%" height={Math.max(200, bySupplier.length * 34)}>
              <BarChart data={bySupplier.slice(0, 10)} layout="vertical">
                <CartesianGrid stroke="var(--border)" horizontal={false} />
                <XAxis type="number" tick={{ fill: "var(--text-muted)", fontSize: 11 }} allowDecimals={false} />
                <YAxis type="category" dataKey="supplier" tick={{ fill: "var(--text-muted)", fontSize: 11 }} width={180} />
                <Tooltip
                  contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", fontSize: 12, borderRadius: 10 }}
                />
                <Bar dataKey="totalQty" name="Qtd. faltante" radius={[0, 4, 4, 0]}>
                  {bySupplier.slice(0, 10).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card">
            <div className="card-title">Detalhes ({bySupplier.length} fornecedor{bySupplier.length > 1 ? "es" : ""})</div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fornecedor</th>
                  <th>Ocorrências</th>
                  <th>Qtd. total</th>
                  <th>Produtos distintos</th>
                </tr>
              </thead>
              <tbody>
                {bySupplier.map((s) => (
                  <tr key={s.supplier}>
                    <td style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}>{s.supplier}</td>
                    <td>{s.occurrences}</td>
                    <td style={{ color: "var(--danger)", fontWeight: 700 }}>{s.totalQty}</td>
                    <td>{s.products}</td>
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