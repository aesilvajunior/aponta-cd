import React, { useEffect, useMemo, useState } from "react";
import {
  fetchEntries,
  fetchSeparationErrors,
  fetchShortages,
  fetchMonthlyReports,
  saveMonthlyReport,
} from "../lib/api";
import { fmtDuration, localISODate } from "../lib/format";
import { IconRefresh, IconDownload, IconTrophy, IconAlertTriangle, IconCheck } from "./Icons";

function monthKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key) {
  const [y, m] = key.split("-");
  const names = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  return `${names[parseInt(m, 10) - 1]} ${y}`;
}

export default function MonthlyReport() {
  const [month, setMonth] = useState(monthKey());
  const [entries, setEntries] = useState([]);
  const [errors, setErrors] = useState([]);
  const [shortages, setShortages] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    const [e, er, sh, rep] = await Promise.all([
      fetchEntries({ limit: 10000 }),
      fetchSeparationErrors(),
      fetchShortages({ limit: 5000 }),
      fetchMonthlyReports({ limit: 12 }),
    ]);
    setEntries(e.data || []);
    setErrors(er.data || []);
    setShortages(sh.data || []);
    setReports(rep.data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return entries.filter((e) => localISODate(e.start_time).slice(0, 7) === month);
  }, [entries, month]);

  const filteredErrors = useMemo(
    () => errors.filter((e) => localISODate(e.created_at).slice(0, 7) === month),
    [errors, month]
  );

  const filteredShortages = useMemo(() => {
    return shortages.filter((s) => {
      const entry = entries.find((e) => e.id === s.entry_id);
      return entry && localISODate(entry.start_time).slice(0, 7) === month;
    });
  }, [shortages, entries, month]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const totalSec = filtered.reduce((s, e) => s + (e.duration_seconds || 0), 0);
    const avg = total > 0 ? Math.round(totalSec / total) : 0;
    const encaixes = filtered.filter((e) => e.is_encaixe).length;

    const byOp = {};
    filtered.forEach((e) => {
      const k = e.operator_code;
      if (!byOp[k]) byOp[k] = { name: e.operator_name, code: k, count: 0, totalSec: 0 };
      byOp[k].count += 1;
      byOp[k].totalSec += e.duration_seconds || 0;
    });
    const ranking = Object.values(byOp)
      .map((o) => ({ ...o, avg: o.count > 0 ? Math.round(o.totalSec / o.count) : 0 }))
      .sort((a, b) => b.count - a.count);

    const byActivity = {};
    filtered.forEach((e) => {
      if (!byActivity[e.activity]) byActivity[e.activity] = { name: e.activity, count: 0, totalSec: 0 };
      byActivity[e.activity].count += 1;
      byActivity[e.activity].totalSec += e.duration_seconds || 0;
    });
    const activities = Object.values(byActivity)
      .map((a) => ({ ...a, avg: a.count > 0 ? Math.round(a.totalSec / a.count) : 0 }))
      .sort((a, b) => b.count - a.count);

    const byErrorType = {};
    filteredErrors.forEach((e) => {
      byErrorType[e.error_type] = (byErrorType[e.error_type] || 0) + 1;
    });
    const topErrors = Object.entries(byErrorType)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    const byShortageProduct = {};
    filteredShortages.forEach((s) => {
      if (!byShortageProduct[s.product_code]) byShortageProduct[s.product_code] = { code: s.product_code, qty: 0, count: 0 };
      byShortageProduct[s.product_code].qty += s.quantity || 0;
      byShortageProduct[s.product_code].count += 1;
    });
    const topShortages = Object.values(byShortageProduct)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10);

    return {
      total, totalSec, avg, encaixes,
      ranking, activities, topErrors, topShortages,
      errorsCount: filteredErrors.length,
      shortagesCount: filteredShortages.length,
    };
  }, [filtered, filteredErrors, filteredShortages]);

  async function generateAndSave() {
    setGenerating(true);
    setError("");
    try {
      await saveMonthlyReport(month, {
        generatedAt: new Date().toISOString(),
        month,
        stats,
      });
      await load();
    } catch (e) {
      setError(String(e));
    }
    setGenerating(false);
  }

  function openPrintable() {
    const esc = (s) =>
      String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

    const rankingRows = stats.ranking
      .map((o, i) => `<tr><td class="center">${i + 1}º</td><td>${esc(o.name)}</td><td class="right">${o.count}</td><td>${esc(fmtDuration(o.avg))}</td><td>${esc(fmtDuration(o.totalSec))}</td></tr>`)
      .join("");

    const activityRows = stats.activities
      .map((a) => `<tr><td>${esc(a.name)}</td><td class="right">${a.count}</td><td>${esc(fmtDuration(a.avg))}</td></tr>`)
      .join("");

    const errorRows = stats.topErrors
      .map((e) => `<tr><td>${esc(e.name)}</td><td class="right">${e.count}</td></tr>`)
      .join("");

    const shortageRows = stats.topShortages
      .map((s) => `<tr><td>${esc(s.code)}</td><td class="right">${s.count}</td><td class="right">${s.qty}</td></tr>`)
      .join("");

    const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório Mensal — ${esc(monthLabel(month))}</title>
<style>
  @page { size: A4; margin: 14mm 12mm; }
  body { font-family: Inter, Arial, sans-serif; color: #1a1d21; font-size: 11.5px; margin: 0; }
  header { border-bottom: 3px solid #1e3a5f; padding-bottom: 14px; margin-bottom: 18px; }
  h1 { font-size: 22px; margin: 0; color: #1e3a5f; }
  .meta { color: #555; font-size: 11px; margin-top: 4px; }
  .summary { background: #f5f7fa; border-left: 4px solid #1e3a5f; padding: 12px 16px; margin-bottom: 18px; }
  .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px 20px; }
  .summary-item strong { color: #1e3a5f; display: block; font-size: 18px; margin-bottom: 2px; }
  h2 { font-size: 14px; margin: 22px 0 8px 0; color: #1e3a5f; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 10.5px; margin-top: 6px; }
  th, td { border: 1px solid #d1d5db; padding: 6px 8px; text-align: left; }
  th { background: #eef2f7; color: #1e3a5f; font-weight: 600; }
  .right { text-align: right; }
  .center { text-align: center; }
  footer { margin-top: 30px; padding-top: 12px; border-top: 1px solid #ddd; font-size: 10px; color: #888; text-align: center; }
</style></head>
<body>
  <header>
    <h1>Relatório Mensal — ${esc(monthLabel(month))}</h1>
    <div class="meta">Aponta CD · Gerado em ${new Date().toLocaleString("pt-BR")}</div>
  </header>

  <div class="summary">
    <div class="summary-grid">
      <div class="summary-item"><strong>${stats.total}</strong>Registros</div>
      <div class="summary-item"><strong>${fmtDuration(stats.avg)}</strong>Tempo médio</div>
      <div class="summary-item"><strong>${fmtDuration(stats.totalSec)}</strong>Tempo total</div>
      <div class="summary-item"><strong>${stats.encaixes}</strong>Encaixes</div>
      <div class="summary-item"><strong>${stats.errorsCount}</strong>Erros registrados</div>
      <div class="summary-item"><strong>${stats.shortagesCount}</strong>Faltas registradas</div>
    </div>
  </div>

  ${rankingRows ? `<h2>Ranking de operadores</h2><table><thead><tr><th class="center">Posição</th><th>Operador</th><th class="right">Registros</th><th>Tempo médio</th><th>Tempo total</th></tr></thead><tbody>${rankingRows}</tbody></table>` : ""}

  ${activityRows ? `<h2>Atividades mais executadas</h2><table><thead><tr><th>Atividade</th><th class="right">Registros</th><th>Tempo médio</th></tr></thead><tbody>${activityRows}</tbody></table>` : ""}

  ${errorRows ? `<h2>Top erros</h2><table><thead><tr><th>Tipo</th><th class="right">Ocorrências</th></tr></thead><tbody>${errorRows}</tbody></table>` : ""}

  ${shortageRows ? `<h2>Top produtos com falta</h2><table><thead><tr><th>Produto</th><th class="right">Ocorrências</th><th class="right">Qtd total</th></tr></thead><tbody>${shortageRows}</tbody></table>` : ""}

  <footer>Aponta CD — relatório gerado automaticamente</footer>
</body></html>`;

    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.onload = () => { win.focus(); win.print(); };
  }

  return (
    <div>
      <div className="page-header-row" style={{ marginBottom: 20 }}>
        <div>
          <h1 className="page-title">Relatório mensal</h1>
          <p className="page-sub" style={{ marginBottom: 0 }}>
            Fechamento consolidado do mês
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input type="month" className="field" style={{ width: "auto" }} value={month} onChange={(e) => setMonth(e.target.value)} />
          <button className="btn-small" onClick={load}><IconRefresh size={14} /> Atualizar</button>
          <button className="btn-small btn-excel" onClick={openPrintable}><IconDownload size={14} /> Gerar PDF</button>
          <button className="btn-small" onClick={generateAndSave} disabled={generating}>
            {generating ? "Salvando..." : "Salvar snapshot"}
          </button>
        </div>
      </div>

      {error && <div className="alert-card alert-danger" style={{ marginBottom: 20 }}>{error}</div>}

      <div className="stat-strip" style={{ marginBottom: 20 }}>
        <div className="stat-cell">
          <div className="stat-num accent">{stats.total}</div>
          <div className="stat-label">Registros no mês</div>
        </div>
        <div className="stat-cell">
          <div className="stat-num">{fmtDuration(stats.avg)}</div>
          <div className="stat-label">Tempo médio</div>
        </div>
        <div className="stat-cell">
          <div className="stat-num">{fmtDuration(stats.totalSec)}</div>
          <div className="stat-label">Tempo total</div>
        </div>
        <div className="stat-cell">
          <div className="stat-num danger">{stats.errorsCount}</div>
          <div className="stat-label">Erros</div>
        </div>
        <div className="stat-cell">
          <div className="stat-num danger">{stats.shortagesCount}</div>
          <div className="stat-label">Faltas</div>
        </div>
      </div>

      {stats.ranking.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <IconTrophy size={16} /> Ranking do mês
          </div>
          <table className="data-table">
            <thead><tr><th>Posição</th><th>Operador</th><th>Registros</th><th>Tempo médio</th><th>Tempo total</th></tr></thead>
            <tbody>
              {stats.ranking.map((o, i) => (
                <tr key={o.code}>
                  <td style={{ fontWeight: 700, color: i < 3 ? "var(--accent)" : "var(--text-muted)" }}>{i + 1}º</td>
                  <td style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}>{o.name}</td>
                  <td>{o.count}</td>
                  <td>{fmtDuration(o.avg)}</td>
                  <td>{fmtDuration(o.totalSec)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {reports.length > 0 && (
        <div className="card">
          <div className="card-title">Snapshots salvos</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {reports.map((r) => (
              <div key={r.id} style={{ padding: "8px 12px", background: "var(--surface-raised)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12.5 }}>
                <div style={{ fontWeight: 700 }}>{monthLabel(r.month_key)}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  {r.payload?.stats?.total || 0} registros
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}