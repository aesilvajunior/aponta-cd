import React, { useEffect, useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { fetchEntries } from "../lib/api";
import { fetchMapAreas, fetchMapItems } from "../lib/stockMap";
import { supabase } from "../supabaseClient";
import {
  parseSpreadsheetFile,
  parseSpreadsheetBuffer,
  exportDivergencesExcel,
} from "../utils/excel";
import {
  IMPORT_TARGETS,
  getTargetSchema,
  suggestColumnMapping,
  autoDetectProfile,
  analyzeImportDivergences,
  loadImportProfiles,
  readLocalProfiles,
  saveImportProfile,
  deleteImportProfile,
  executeAnalyzedImport,
} from "../lib/importProfiles";
import {
  IconUpload,
  IconDownload,
  IconX,
  IconCheck,
  IconAlertTriangle,
  IconTrendingUp,
  IconPackage,
  IconTrash,
} from "./Icons";

export default function CsvImport() {
  const [fileName, setFileName] = useState("");
  const [fileType, setFileType] = useState("csv");
  const [rawBuffer, setRawBuffer] = useState(null);
  const [sheetNames, setSheetNames] = useState([]);
  const [activeSheet, setActiveSheet] = useState("");
  const [csvRows, setCsvRows] = useState([]);
  const [csvHeaders, setCsvHeaders] = useState([]);
  const [parseError, setParseError] = useState("");
  const [busy, setBusy] = useState(false);

  // Perfis de importação salvos (1 clique)
  const [profiles, setProfiles] = useState(() => readLocalProfiles());
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [detectedMatch, setDetectedMatch] = useState(null);
  const [targetType, setTargetType] = useState("stock_map_items");
  const [mapping, setMapping] = useState({});
  const [profileNameDraft, setProfileNameDraft] = useState("");
  const [profileMsg, setProfileMsg] = useState("");

  // Base atual do CD para análise pré-gravação de divergências
  const [cdSnapshot, setCdSnapshot] = useState({
    loaded: false,
    areas: [],
    items: [],
    catalog: [],
    entries: [],
  });
  const [applyUpdates, setApplyUpdates] = useState(true);
  const [importBusy, setImportBusy] = useState(false);
  const [importResult, setImportResult] = useState(null);

  const [searchTerm, setSearchTerm] = useState("");
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadImportProfiles().then(setProfiles).catch(() => { });
  }, []);

  async function ensureCdSnapshot() {
    if (cdSnapshot.loaded) return cdSnapshot;
    const [areasRes, itemsRes, entriesRes, catRes] = await Promise.all([
      fetchMapAreas().catch(() => ({ data: [] })),
      fetchMapItems().catch(() => ({ data: [] })),
      fetchEntries({ limit: 5000 }).catch(() => ({ data: [] })),
      supabase.from("product_barcodes").select("barcode, product_code, product_name, category").limit(10000).then((r) => r, () => ({ data: [] })),
    ]);
    const next = {
      loaded: true,
      areas: areasRes?.data || [],
      items: itemsRes?.data || [],
      entries: entriesRes?.data || [],
      catalog: catRes?.data || [],
    };
    setCdSnapshot(next);
    return next;
  }

  function applyHeadersAndAutoDetect(headers, currentProfiles = profiles) {
    const match = autoDetectProfile(headers, currentProfiles);
    setDetectedMatch(match);
    if (match) {
      setSelectedProfileId(match.profile.id);
      setTargetType(match.profile.targetType);
      setMapping(match.resolvedMapping);
      setProfileNameDraft(match.profile.builtIn ? "" : match.profile.name);
    } else {
      setSelectedProfileId("");
      setMapping(suggestColumnMapping(headers, targetType));
    }
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setBusy(true);
    setParseError("");
    setImportResult(null);
    setFileName(file.name);

    try {
      const parsed = await parseSpreadsheetFile(file);
      setFileType(parsed.fileType);
      setRawBuffer(parsed.buffer);
      setSheetNames(parsed.sheetNames);
      setActiveSheet(parsed.activeSheet);
      setCsvRows(parsed.rows);
      setCsvHeaders(parsed.headers);
      applyHeadersAndAutoDetect(parsed.headers, profiles);
      // Carrega snapshot do CD automaticamente para exibir resumo de divergências na hora
      ensureCdSnapshot().catch(() => { });
    } catch (err) {
      setParseError(err?.message || "Erro ao ler arquivo.");
    } finally {
      setBusy(false);
    }
  }

  function handleChangeSheet(sheet) {
    if (!rawBuffer) return;
    const parsed = parseSpreadsheetBuffer(rawBuffer, { sheetName: sheet });
    setActiveSheet(parsed.activeSheet);
    setCsvRows(parsed.rows);
    setCsvHeaders(parsed.headers);
    setImportResult(null);
    applyHeadersAndAutoDetect(parsed.headers, profiles);
  }

  function handleSelectProfile(profile) {
    if (!profile) return;
    setSelectedProfileId(profile.id);
    setTargetType(profile.targetType);
    setProfileNameDraft(profile.builtIn ? "" : profile.name);
    setImportResult(null);

    // Mapeia colunas do perfil que existem no arquivo atual (case-insensitive)
    const headerByLower = new Map(csvHeaders.map((h) => [h.trim().toLowerCase(), h]));
    const resolved = {};
    Object.entries(profile.mapping || {}).forEach(([fieldKey, colName]) => {
      if (!colName) return;
      if (csvHeaders.includes(colName)) {
        resolved[fieldKey] = colName;
      } else {
        const hit = headerByLower.get(String(colName).trim().toLowerCase());
        if (hit) resolved[fieldKey] = hit;
      }
    });
    // Preenche campos faltantes com sugestão automática se houver
    const suggested = suggestColumnMapping(csvHeaders, profile.targetType);
    setMapping({ ...suggested, ...resolved });
    setProfileMsg(`Perfil "${profile.name}" aplicado em 1 clique.`);
    setTimeout(() => setProfileMsg(""), 3000);
  }

  function handleChangeTarget(nextTarget) {
    setTargetType(nextTarget);
    setSelectedProfileId("");
    setImportResult(null);
    setMapping(suggestColumnMapping(csvHeaders, nextTarget));
  }

  async function handleSaveProfile() {
    const name = profileNameDraft.trim();
    if (!name) {
      setParseError("Digite um nome para o perfil antes de salvar (ex.: Relatório Estoque ERP).");
      return;
    }
    const existingCustom = profiles.find((p) => !p.builtIn && p.id === selectedProfileId);
    const { profile, profiles: updated } = await saveImportProfile(
      {
        id: existingCustom?.id,
        name,
        targetType,
        mapping,
      },
      profiles
    );
    setProfiles(updated);
    setSelectedProfileId(profile.id);
    setProfileMsg(`Perfil "${profile.name}" salvo! Nas próximas vezes ele será detectado automaticamente.`);
    setTimeout(() => setProfileMsg(""), 4000);
  }

  async function handleDeleteProfile(profileId) {
    if (!window.confirm("Excluir este perfil de importação?")) return;
    const updated = await deleteImportProfile(profileId, profiles);
    setProfiles(updated);
    if (selectedProfileId === profileId) setSelectedProfileId("");
  }

  function clearAll() {
    setFileName("");
    setFileType("csv");
    setRawBuffer(null);
    setSheetNames([]);
    setActiveSheet("");
    setCsvRows([]);
    setCsvHeaders([]);
    setParseError("");
    setSearchTerm("");
    setMapping({});
    setSelectedProfileId("");
    setDetectedMatch(null);
    setImportResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const schema = useMemo(() => getTargetSchema(targetType), [targetType]);

  const missingRequiredFields = useMemo(
    () => schema.fields.filter((f) => f.required && !mapping[f.key]),
    [schema, mapping]
  );

  // Resumo automático de divergências pré-gravação
  const divergenceAnalysis = useMemo(() => {
    if (csvRows.length === 0 || !cdSnapshot.loaded || missingRequiredFields.length > 0) return null;
    return analyzeImportDivergences({
      rows: csvRows,
      mapping,
      targetType,
      existingAreas: cdSnapshot.areas,
      existingItems: cdSnapshot.items,
      existingCatalog: cdSnapshot.catalog,
      existingEntries: cdSnapshot.entries,
    });
  }, [csvRows, mapping, targetType, cdSnapshot, missingRequiredFields.length]);

  async function handleConfirmImport() {
    if (!divergenceAnalysis || importBusy) return;
    if (targetType === "orders_crosscheck") return;
    const countToWrite = divergenceAnalysis.toInsert.length + (applyUpdates ? divergenceAnalysis.toUpdate.length : 0);
    if (countToWrite === 0) {
      setImportResult({ ok: true, message: "Nenhuma alteração pendente para gravar (todos os registros já estão iguais no CD)." });
      return;
    }
    if (!window.confirm(`Confirmar gravação de ${divergenceAnalysis.toInsert.length} novo(s)${applyUpdates ? ` e ${divergenceAnalysis.toUpdate.length} atualização(ões)` : ""}?`)) {
      return;
    }
    setImportBusy(true);
    setParseError("");
    const res = await executeAnalyzedImport(divergenceAnalysis, { applyUpdates });
    setImportBusy(false);
    if (res.error) {
      setParseError(`Erro ao gravar importação: ${res.error.message}`);
      return;
    }
    setImportResult({
      ok: true,
      message: `Importação concluída: ${res.inserted} inserido(s) e ${res.updated} atualizado(s) no sistema.`,
    });
    // Atualiza snapshot do CD após gravar
    setCdSnapshot((s) => ({ ...s, loaded: false }));
    setTimeout(() => { ensureCdSnapshot().catch(() => { }); }, 200);
  }

  const stats = useMemo(() => {
    if (csvRows.length === 0) return null;
    return { totalRows: csvRows.length, totalCols: csvHeaders.length };
  }, [csvRows, csvHeaders]);

  const numericColumns = useMemo(() => {
    if (csvRows.length === 0 || csvHeaders.length === 0) return [];
    return csvHeaders.filter((h) => {
      let numericCount = 0;
      const sample = Math.min(csvRows.length, 30);
      for (let i = 0; i < sample; i++) {
        const v = csvRows[i][h];
        if (v != null && v !== "" && !isNaN(Number(String(v).replace(",", ".")))) numericCount++;
      }
      return numericCount >= sample * 0.8;
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
      return { col, count: values.length, total, avg, min: Math.min(...values), max: Math.max(...values) };
    });
  }, [csvRows, numericColumns]);

  const filteredRows = useMemo(() => {
    if (!searchTerm.trim()) return csvRows;
    const q = searchTerm.toLowerCase();
    return csvRows.filter((r) =>
      csvHeaders.some((h) => String(r[h] ?? "").toLowerCase().includes(q))
    );
  }, [csvRows, csvHeaders, searchTerm]);

  function exportCsv() {
    if (csvRows.length === 0) return;
    // Neutraliza células que começam com caracteres de fórmula (=, +, -, @) contra CSV Injection
    const safeRows = filteredRows.map((row) => {
      const out = {};
      csvHeaders.forEach((h) => {
        const s = row[h] == null ? "" : String(row[h]);
        out[h] = /^[=+\-@\t\r]/.test(s) && !/^-\d+([.,]\d+)?$/.test(s) ? `'${s}` : s;
      });
      return out;
    });
    const csv = Papa.unparse(safeRows, { delimiter: ";" });
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tratado_${fileName.replace(/\.(xlsx|xls)$/i, ".csv") || "dados.csv"}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="page-header-row" style={{ marginBottom: 22 }}>
        <div>
          <h1 className="page-title">Importar CSV / Excel</h1>
          <p className="page-sub" style={{ marginBottom: 0 }}>
            Salve modelos de colunas do ERP para importar em 1 clique, com resumo automático de divergências antes de gravar
          </p>
        </div>
      </div>

      {busy && (
        <div className="alert-card" style={{ marginBottom: 16 }}>
          Lendo planilha...
        </div>
      )}

      {parseError && (
        <div className="alert-card alert-danger" style={{ marginBottom: 20 }}>
          <IconAlertTriangle size={16} style={{ marginRight: 8, verticalAlign: "middle" }} />
          {parseError}
          <button className="btn-small" style={{ marginLeft: 12 }} onClick={() => setParseError("")}>Fechar</button>
        </div>
      )}

      {profileMsg && (
        <div className="alert-card" style={{ marginBottom: 16, background: "var(--ok-soft)", borderColor: "var(--ok)", color: "var(--ok)" }}>
          <IconCheck size={15} /> {profileMsg}
        </div>
      )}

      {importResult && (
        <div className="alert-card" style={{ marginBottom: 16, background: "var(--ok-soft)", borderColor: "var(--ok)", color: "var(--ok)" }}>
          <IconCheck size={16} /> <strong>{importResult.message}</strong>
        </div>
      )}

      {/* Perfis salvos disponíveis */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">Perfis de importação salvos ({profiles.length})</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {profiles.map((p) => {
            const active = selectedProfileId === p.id;
            return (
              <div
                key={p.id}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 10px",
                  borderRadius: 10,
                  border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
                  background: active ? "var(--accent-soft)" : "var(--surface-raised)",
                }}
              >
                <button
                  type="button"
                  onClick={() => handleSelectProfile(p)}
                  disabled={!fileName}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: active ? "var(--accent)" : "var(--text)",
                    fontWeight: 600,
                    fontSize: 12.5,
                    cursor: fileName ? "pointer" : "default",
                    padding: 0,
                  }}
                  title={fileName ? "Aplicar este perfil em 1 clique" : "Envie uma planilha para aplicar"}
                >
                  {p.name}
                </button>
                <span style={{ fontSize: 10.5, color: "var(--text-faint)" }}>
                  ({p.targetType === "stock_map_items" ? "Estoque" : p.targetType === "product_barcodes" ? "EAN" : "Pedidos"})
                </span>
                {!p.builtIn && (
                  <button
                    type="button"
                    onClick={() => handleDeleteProfile(p.id)}
                    style={{ background: "transparent", border: "none", color: "var(--danger)", cursor: "pointer", display: "flex", padding: 2 }}
                    title="Excluir perfil"
                  >
                    <IconTrash size={12} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

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
              Clique para escolher um arquivo CSV ou Excel (.xlsx / .xls)
            </div>
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
              Detecta automaticamente cabeçalhos de relatórios do ERP e perfis salvos
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
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
                  <span className="badge">{fileType.toUpperCase()}</span>
                </div>
                <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 4 }}>
                  {stats.totalRows} linhas · {stats.totalCols} colunas
                  {detectedMatch && (
                    <> · <strong style={{ color: "var(--ok)" }}>Perfil detectado: {detectedMatch.profile.name} ({Math.round(detectedMatch.score * 100)}%)</strong></>
                  )}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                {sheetNames.length > 1 && (
                  <select className="field" style={{ width: "auto" }} value={activeSheet} onChange={(e) => handleChangeSheet(e.target.value)}>
                    {sheetNames.map((s) => <option key={s} value={s}>Aba: {s}</option>)}
                  </select>
                )}
                <button className="btn-small" onClick={clearAll}>
                  <IconX size={13} /> Fechar arquivo
                </button>
                <button className="btn-small btn-excel" onClick={exportCsv}>
                  <IconDownload size={13} /> Exportar tratado
                </button>
              </div>
            </div>
          </div>

          {/* Mapeamento de colunas + salvar perfil */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <IconPackage size={16} /> Mapeamento de colunas e Perfil ERP
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
              <label style={{ fontSize: 12.5, fontWeight: 600 }}>Destino:</label>
              <select
                className="field"
                style={{ width: "auto", minWidth: 260 }}
                value={targetType}
                onChange={(e) => handleChangeTarget(e.target.value)}
              >
                {IMPORT_TARGETS.map((t) => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
              <button
                type="button"
                className="btn-small"
                onClick={() => setMapping(suggestColumnMapping(csvHeaders, targetType))}
              >
                Auto-mapear colunas
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10, marginBottom: 14 }}>
              {schema.fields.map((f) => (
                <div key={f.key}>
                  <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: f.required && !mapping[f.key] ? "var(--danger)" : "var(--text-muted)", marginBottom: 4 }}>
                    {f.label} {f.required ? "*" : ""}
                  </label>
                  <select
                    className="field"
                    value={mapping[f.key] || ""}
                    onChange={(e) => setMapping((m) => ({ ...m, [f.key]: e.target.value }))}
                  >
                    <option value="">(ignorar)</option>
                    {csvHeaders.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", paddingTop: 12, borderTop: "1px solid var(--border)" }}>
              <input
                className="field"
                style={{ maxWidth: 280 }}
                placeholder="Nome do perfil (ex.: Relatório Estoque ERP)"
                value={profileNameDraft}
                onChange={(e) => setProfileNameDraft(e.target.value)}
              />
              <button type="button" className="btn-small" onClick={handleSaveProfile}>
                Salvar como perfil (1 clique)
              </button>
            </div>
          </div>

          {/* Resumo Automático de Divergências (Pré-gravação) */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
              <div className="card-title" style={{ marginBottom: 0 }}>
                Resumo automático de divergências (antes de gravar)
              </div>
              {divergenceAnalysis && divergenceAnalysis.divergences.length > 0 && (
                <button
                  type="button"
                  className="btn-small"
                  onClick={() => exportDivergencesExcel(divergenceAnalysis.divergences, profileNameDraft || targetType)}
                >
                  <IconDownload size={13} /> Exportar divergências (.xlsx)
                </button>
              )}
            </div>

            {missingRequiredFields.length > 0 ? (
              <div style={{ fontSize: 13, color: "var(--warning)" }}>
                Mapeie as colunas obrigatórias para analisar divergências:{" "}
                <strong>{missingRequiredFields.map((f) => f.label).join(", ")}</strong>.
              </div>
            ) : !cdSnapshot.loaded ? (
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Carregando base do Aponta CD para comparar...</div>
            ) : divergenceAnalysis ? (
              <>
                <div className="stat-strip" style={{ marginBottom: 16 }}>
                  <div className="stat-cell">
                    <div className="stat-num" style={{ color: "var(--ok)" }}>{divergenceAnalysis.summary.newCount}</div>
                    <div className="stat-label">{targetType === "orders_crosscheck" ? "Só na planilha ERP" : "Novos registros"}</div>
                  </div>
                  {targetType !== "orders_crosscheck" ? (
                    <div className="stat-cell">
                      <div className="stat-num accent">{divergenceAnalysis.summary.updateCount}</div>
                      <div className="stat-label">Atualizações</div>
                    </div>
                  ) : (
                    <div className="stat-cell">
                      <div className="stat-num danger">{divergenceAnalysis.summary.onlyInCdCount || 0}</div>
                      <div className="stat-label">Só no Aponta CD</div>
                    </div>
                  )}
                  <div className="stat-cell">
                    <div className="stat-num">{divergenceAnalysis.summary.unchangedCount}</div>
                    <div className="stat-label">{targetType === "orders_crosscheck" ? "Conferidos nos dois" : "Sem alteração"}</div>
                  </div>
                  <div className="stat-cell">
                    <div className="stat-num" style={{ color: "var(--warning)" }}>{divergenceAnalysis.summary.warningCount}</div>
                    <div className="stat-label">Divergências</div>
                  </div>
                  <div className="stat-cell">
                    <div className="stat-num danger">{divergenceAnalysis.summary.errorCount}</div>
                    <div className="stat-label">Erros (ignorados)</div>
                  </div>
                </div>

                {divergenceAnalysis.divergences.length > 0 && (
                  <div style={{ overflowX: "auto", maxHeight: 260, overflowY: "auto", marginBottom: 16 }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Linha</th>
                          <th>Tipo</th>
                          <th>Código / Pedido</th>
                          <th>Detalhe da divergência</th>
                        </tr>
                      </thead>
                      <tbody>
                        {divergenceAnalysis.divergences.slice(0, 100).map((d, idx) => (
                          <tr key={idx}>
                            <td>{d.line}</td>
                            <td>
                              <span
                                style={{
                                  padding: "2px 7px",
                                  borderRadius: 4,
                                  fontSize: 10.5,
                                  fontWeight: 700,
                                  background: d.severity === "error" ? "var(--danger-soft)" : "var(--warning-soft)",
                                  color: d.severity === "error" ? "var(--danger)" : "var(--warning)",
                                }}
                              >
                                {d.severity === "error" ? "ERRO" : "ATENÇÃO"}
                              </span>
                            </td>
                            <td style={{ fontWeight: 700 }}>{d.code}</td>
                            <td style={{ fontFamily: "var(--font-display)" }}>{d.detail}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {targetType !== "orders_crosscheck" && (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", paddingTop: 12, borderTop: "1px solid var(--border)" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                      <input type="checkbox" checked={applyUpdates} onChange={(e) => setApplyUpdates(e.target.checked)} />
                      Atualizar registros já existentes ({divergenceAnalysis.summary.updateCount})
                    </label>
                    <button
                      type="button"
                      className="btn-small btn-excel"
                      disabled={importBusy || (divergenceAnalysis.toInsert.length === 0 && (!applyUpdates || divergenceAnalysis.toUpdate.length === 0))}
                      onClick={handleConfirmImport}
                    >
                      <IconCheck size={14} />{" "}
                      {importBusy
                        ? "Gravando..."
                        : `Confirmar e gravar (${divergenceAnalysis.toInsert.length + (applyUpdates ? divergenceAnalysis.toUpdate.length : 0)} registros)`}
                    </button>
                  </div>
                )}
              </>
            ) : null}
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
