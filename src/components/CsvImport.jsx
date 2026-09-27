import React, { useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { fetchEntries } from "../lib/api";
import {
  IconUpload,
  IconDownload,
  IconX,
  IconCheck,
  IconAlertTriangle,
  IconTrendingUp,
  IconPackage,
} from "./Icons";

export default function CsvImport() {
  const [fileName, setFileName] = useState("");
  const [csvRows, setCsvRows] = useState([]);
  const [csvHeaders, setCsvHeaders] = useState([]);
  const [parseError, setParseError] = useState("");
  const [busy, setBusy] = useState(false);
  const [entries, setEntries] = useState([]);
  const [loadedEntries, setLoadedEntries] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [orderColumn, setOrderColumn] = useState("");
  const fileInputRef = useRef(null);

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setBusy(true);
    setParseError("");
    setFileName(file.name);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      encoding: "UTF-8",
      complete: (results) => {
        if (results.errors && results.errors.length > 0) {
          setParseError(`Erro ao interpretar CSV: ${results.errors[0].message}`);
          setBusy(false);
          return;
        }
        setCsvRows(results.data || []);
        setCsvHeaders(results.meta?.fields || Object.keys(results.data?.[0] || {}));
        setBusy(false);
      },
      error: (err) => {
        setParseError(err.message || "Erro ao ler arquivo.");
        setBusy(false);
      },
    });
  }

  async function loadEntriesForCrossCheck() {
    setBusy(true);
    const { data, error } = await fetchEntries({ limit: 5000 });
    setBusy(false);
    if (error) {
      setParseError("Erro ao buscar dados do Aponta CD: " + error.message);
      return;
    }
    setEntries(data || []);
    setLoadedEntries(true);
  }

  function clearAll() {
    setFileName("");
    setCsvRows([]);
    setCsvHeaders([]);
    setParseError("");
    setSearchTerm("");
    setOrderColumn("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const stats = useMemo(() => {
    if (csvRows.length === 0) return null;
    const totalRows = csvRows.length;
    const totalCols = csvHeaders.length;
    return { totalRows, totalCols };
  }, [csvRows, csvHeaders]);

  const numericColumns = useMemo(() => {
    if (csvRows.length === 0 || csvHeaders.length === 0) return [];
    return csvHeaders.filter((h) => {
      let numericCount = 0;
      for (let i = 0; i < Math.min(csvRows.length, 30); i++) {
        const v = csvRows[i][h];
        if (v != null && v !== "" && !isNaN(Number(String(v).replace(",", ".")))) numericCount++;
      }
      return numericCount >= Math.min(csvRows.length, 30) * 0.8;
    });
  }, [csvRows, csvHeaders]);

  const numericSummary = useMemo(() => {
    if (numericColumns.length === 0) return [];
    return numericColumns.map((col) => {
      const values = csvRows
        .map((r) => Number(String(r[col] ?? "").replace(",", ".")))
        .filter((v) => !isNaN(v));
      if (values.length === 0) return { col, count: 0 };
      const total = values.reduce((s, v) => s + v, 0);
      const avg = total / values.length;
      const min = Math.min(...values);
      const max = Math.max(...values);
      return { col, count: values.length, total, avg, min, max };
    });
  }, [csvRows, numericColumns]);

  // Cruzamento com Aponta CD
  const crossCheck = useMemo(() => {
    if (!loadedEntries || !orderColumn || csvRows.length === 0) return null;
    const cdOrderNumbers = new Set(
      entries
        .map((e) => String(e.order_number || "").trim())
        .filter(Boolean)
    );
    const csvOrderNumbers = csvRows
      .map((r) => String(r[orderColumn] || "").trim())
      .filter(Boolean);
    const csvSet = new Set(csvOrderNumbers);

    const matches = [...csvSet].filter((o) => cdOrderNumbers.has(o)).length;
    const onlyCsv = [...csvSet].filter((o) => !cdOrderNumbers.has(o)).length;
    const onlyCd = [...cdOrderNumbers].filter((o) => !csvSet.has(o)).length;

    return {
      totalCsv: csvSet.size,
      totalCd: cdOrderNumbers.size,
      matches,
      onlyCsv,
      onlyCd,
    };
  }, [loadedEntries, orderColumn, csvRows, entries]);

  const filteredRows = useMemo(() => {
    if (!searchTerm.trim()) return csvRows;
    const q = searchTerm.toLowerCase();
    return csvRows.filter((r) =>
      csvHeaders.some((h) => String(r[h] ?? "").toLowerCase().includes(q))
    );
  }, [csvRows, csvHeaders, searchTerm]);

  function exportCsv() {
    if (csvRows.length === 0) return;
    const csv = Papa.unparse(filteredRows, { delimiter: ";" });
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tratado_${fileName || "dados.csv"}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="page-header-row" style={{ marginBottom: 22 }}>
        <div>
          <h1 className="page-title">Importar CSV</h1>
          <p className="page-sub" style={{ marginBottom: 0 }}>
            Analise planilhas externas, faça estatísticas básicas e cruze com os dados do Aponta CD
          </p>
        </div>
      </div>

      {parseError && (
        <div className="alert-card alert-danger" style={{ marginBottom: 20 }}>
          <IconAlertTriangle size={16} style={{ marginRight: 8, verticalAlign: "middle" }} />
          {parseError}
          <button className="btn-small" style={{ marginLeft: 12 }} onClick={() => setParseError("")}>Fechar</button>
        </div>
      )}

      {/* Upload */}
      {!fileName && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: "2px dashed var(--border-strong)",
              borderRadius: 14,
              padding: "48px 24px",
              textAlign: "center",
              cursor: "pointer",
              transition: "all 200ms ease",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.background = "var(--accent-soft)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border-strong)"; e.currentTarget.style.background = "transparent"; }}
          >
            <div style={{ color: "var(--accent)", marginBottom: 16, display: "flex", justifyContent: "center" }}>
              <IconUpload size={48} strokeWidth={1} />
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>
              Clique para escolher um arquivo CSV
            </div>
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
              Aceita arquivos .csv com separador <code style={{ fontFamily: "var(--font-mono)" }}>;</code> ou <code style={{ fontFamily: "var(--font-mono)" }}>,</code>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileChange}
            style={{ display: "none" }}
          />
        </div>
      )}

      {/* Arquivo carregado */}
      {fileName && stats && (
        <>
          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                  <IconCheck size={16} /> {fileName}
                </div>
                <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 4 }}>
                  {stats.totalRows} linhas · {stats.totalCols} colunas
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn-small" onClick={clearAll}>
                  <IconX size={13} /> Fechar arquivo
                </button>
                <button className="btn-small btn-excel" onClick={exportCsv}>
                  <IconDownload size={13} /> Exportar tratado
                </button>
              </div>
            </div>
          </div>

          {/* Estatísticas numéricas */}
          {numericSummary.length > 0 && (
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <IconTrendingUp size={16} /> Estatísticas numéricas
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
                {numericSummary.map((s) => (
                  <div key={s.col} style={{ padding: 14, background: "var(--surface-raised)", border: "1px solid var(--border)", borderRadius: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)", marginBottom: 8, fontFamily: "var(--font-mono)" }}>
                      {s.col}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 11.5 }}>
                      <div>
                        <div style={{ color: "var(--text-muted)" }}>Total</div>
                        <div style={{ fontWeight: 700, fontFamily: "var(--font-mono)" }}>{s.total?.toLocaleString("pt-BR")}</div>
                      </div>
                      <div>
                        <div style={{ color: "var(--text-muted)" }}>Média</div>
                        <div style={{ fontWeight: 700, fontFamily: "var(--font-mono)" }}>{s.avg?.toFixed(2)}</div>
                      </div>
                      <div>
                        <div style={{ color: "var(--text-muted)" }}>Mínimo</div>
                        <div style={{ fontFamily: "var(--font-mono)" }}>{s.min}</div>
                      </div>
                      <div>
                        <div style={{ color: "var(--text-muted)" }}>Máximo</div>
                        <div style={{ fontFamily: "var(--font-mono)" }}>{s.max}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cruzamento com Aponta CD */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <IconPackage size={16} /> Cruzar com dados do Aponta CD
            </div>
            {!loadedEntries ? (
              <div>
                <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 0, marginBottom: 12 }}>
                  Pra cruzar os dados do CSV com os pedidos registrados no Aponta CD, escolha qual coluna contém o número do pedido.
                </p>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <select
                    className="field"
                    style={{ width: 240 }}
                    value={orderColumn}
                    onChange={(e) => setOrderColumn(e.target.value)}
                  >
                    <option value="">Coluna do nº do pedido...</option>
                    {csvHeaders.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                  <button
                    className="btn-small btn-excel"
                    onClick={loadEntriesForCrossCheck}
                    disabled={busy || !orderColumn}
                  >
                    {busy ? "Carregando..." : "Carregar dados do CD"}
                  </button>
                </div>
              </div>
            ) : crossCheck ? (
              <div className="stat-strip">
                <div className="stat-cell">
                  <div className="stat-num">{crossCheck.totalCsv}</div>
                  <div className="stat-label">Pedidos no CSV</div>
                </div>
                <div className="stat-cell">
                  <div className="stat-num">{crossCheck.totalCd}</div>
                  <div className="stat-label">Pedidos no Aponta CD</div>
                </div>
                <div className="stat-cell">
                  <div className="stat-num" style={{ color: "var(--ok)" }}>{crossCheck.matches}</div>
                  <div className="stat-label">Encontrados nos dois</div>
                </div>
                <div className="stat-cell">
                  <div className="stat-num" style={{ color: "var(--warning)" }}>{crossCheck.onlyCsv}</div>
                  <div className="stat-label">Só no CSV</div>
                </div>
                <div className="stat-cell">
                  <div className="stat-num" style={{ color: "var(--danger)" }}>{crossCheck.onlyCd}</div>
                  <div className="stat-label">Só no Aponta CD</div>
                </div>
              </div>
            ) : null}
          </div>

          {/* Tabela de dados */}
          <div className="card">
            <div className="card-title">Pré-visualização ({filteredRows.length} linhas)</div>
            <input
              className="field"
              placeholder="Buscar em todas as colunas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ marginBottom: 12 }}
            />
            <div style={{ overflowX: "auto", maxHeight: 500, overflowY: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    {csvHeaders.map((h) => <th key={h}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.slice(0, 200).map((row, i) => (
                    <tr key={i}>
                      {csvHeaders.map((h) => (
                        <td key={h} style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>
                          {String(row[h] ?? "")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredRows.length > 200 && (
                <p style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 12, textAlign: "center" }}>
                  Mostrando 200 de {filteredRows.length}. Use a busca ou exporte o arquivo.
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}