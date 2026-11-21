import * as XLSX from "xlsx";
import Papa from "papaparse";

// ============================================================
// Helpers de Excel — geram arquivos .xlsx formatados (com
// cabeçalho-resumo, tabelas coloridas e totais no final) e
// leem planilhas .xlsx/.xls/.csv para importação inteligente.
// ============================================================

// Lê uma planilha Excel (ArrayBuffer) detectando automaticamente a linha de cabeçalho
// (útil para relatórios do ERP que vêm com linhas de título antes da tabela).
export function parseSpreadsheetBuffer(buffer, { sheetName = null } = {}) {
  const wb = XLSX.read(buffer, { type: "array" });
  const sheetNames = wb.SheetNames || [];
  if (sheetNames.length === 0) {
    return { headers: [], rows: [], sheetNames: [], activeSheet: "" };
  }
  const activeSheet = sheetName && sheetNames.includes(sheetName) ? sheetName : sheetNames[0];
  const ws = wb.Sheets[activeSheet];
  const matrix = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false });

  // Detecta a primeira linha com >= 2 células preenchidas como cabeçalho
  let headerIdx = matrix.findIndex(
    (r) => Array.isArray(r) && r.filter((c) => String(c ?? "").trim() !== "").length >= 2
  );
  if (headerIdx < 0) headerIdx = 0;

  const rawHeaders = (matrix[headerIdx] || []).map((h, i) => {
    const clean = String(h ?? "").trim();
    return clean || `Coluna_${i + 1}`;
  });

  // Garante nomes de coluna únicos
  const seen = {};
  const headers = rawHeaders.map((h) => {
    if (!seen[h]) {
      seen[h] = 1;
      return h;
    }
    seen[h] += 1;
    return `${h}_${seen[h]}`;
  });

  const rows = [];
  for (let i = headerIdx + 1; i < matrix.length; i++) {
    const line = matrix[i];
    if (!Array.isArray(line)) continue;
    const nonEmpty = line.some((c) => String(c ?? "").trim() !== "");
    if (!nonEmpty) continue;
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = line[idx] !== undefined && line[idx] !== null ? String(line[idx]).trim() : "";
    });
    rows.push(obj);
  }

  return { headers, rows, sheetNames, activeSheet };
}

// Lê arquivo .csv, .xlsx ou .xls enviado pelo <input type="file">
export async function parseSpreadsheetFile(file, { sheetName = null } = {}) {
  const name = String(file?.name || "").toLowerCase();
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const buf = await file.arrayBuffer();
    const parsed = parseSpreadsheetBuffer(buf, { sheetName });
    return { ...parsed, fileType: "excel", buffer: buf };
  }

  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      encoding: "UTF-8",
      complete: (results) => {
        if (results.errors && results.errors.length > 0 && (!results.data || results.data.length === 0)) {
          reject(new Error(`Erro ao interpretar CSV: ${results.errors[0].message}`));
          return;
        }
        const rows = results.data || [];
        const headers = results.meta?.fields || Object.keys(rows[0] || {});
        resolve({ headers, rows, sheetNames: ["CSV"], activeSheet: "CSV", fileType: "csv", buffer: null });
      },
      error: (err) => reject(err),
    });
  });
}

// Exporta o resumo de divergências detectadas antes da importação
export function exportDivergencesExcel(divergences = [], profileName = "importacao") {
  if (!divergences || divergences.length === 0) return;
  const matrix = [
    ["RESUMO DE DIVERGÊNCIAS — PRÉ-IMPORTAÇÃO"],
    ["Perfil:", profileName],
    [],
    ["Linha", "Severidade", "Tipo", "Código / Pedido", "Atual no CD", "Planilha", "Diferença", "Detalhe"],
    ...divergences.map((d) => [
      d.line ?? "—",
      d.severity === "error" ? "Erro" : "Atenção",
      d.type,
      d.code || "—",
      d.currentValue ?? "—",
      d.incomingValue ?? "—",
      d.diff ?? "—",
      d.detail || "",
    ]),
  ];
  const wb = XLSX.utils.book_new();
  const ws = sheetFromMatrix(matrix);
  XLSX.utils.book_append_sheet(wb, ws, "Divergencias");
  downloadWorkbook(wb, `divergencias_${profileName.toLowerCase().replace(/[^a-z0-9]+/g, "_")}.xlsx`);
}

// Formata célula como moeda/duração — usada pra deixar o Excel bonito
function autoWidth(rows) {
  if (!rows || rows.length === 0) return [];
  return rows[0].map((_, i) => {
    let max = 10;
    rows.forEach((row) => {
      const val = row[i];
      if (val == null) return;
      const len = String(val).length;
      if (len > max) max = len;
    });
    return { wch: Math.min(max + 2, 40) };
  });
}

// Cria uma aba a partir de uma matriz de linhas
function sheetFromMatrix(matrix) {
  const ws = XLSX.utils.aoa_to_sheet(matrix);
  ws["!cols"] = autoWidth(matrix);
  return ws;
}

// Baixa o arquivo .xlsx
function downloadWorkbook(wb, filename) {
  XLSX.writeFile(wb, filename);
}

// ============================================================
// EXPORTAÇÃO 1: HISTÓRICO COMPLETO
// ============================================================

export function exportHistoricoExcel({
  entries,
  shortagesByEntry = {},
  metrics,
  periodLabel,
  dateFrom,
  dateTo,
}) {
  if (!entries || entries.length === 0) {
    alert("Nenhum registro no período para exportar.");
    return;
  }

  // ---------- Resumo geral ----------
  const totalRegistros = entries.length;
  const totalSegundos = entries.reduce((s, e) => s + (e.duration_seconds || 0), 0);
  const mediaSegundos = totalRegistros > 0 ? Math.round(totalSegundos / totalRegistros) : 0;
  const totalEncaixes = entries.filter((e) => e.is_encaixe).length;
  const totalComFalta = entries.filter((e) => shortagesByEntry[e.id]?.length).length;
  const totalFaltas = entries.reduce((s, e) => s + (shortagesByEntry[e.id]?.length || 0), 0);

  const fmtDur = (sec) => {
    if (sec == null || isNaN(sec)) return "—";
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
    return `${m}m ${String(s).padStart(2, "0")}s`;
  };

  const fmtDate = (iso) => {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  };

  const fmtTime = (iso) => {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const agora = new Date();
  const fmtDateTime = (d) => {
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} às ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  // ---------- Monta matriz principal ----------
  const rows = [];

  // Cabeçalho-resumo
  rows.push(["RELATÓRIO DE APONTAMENTOS"]);
  rows.push(["Aponta CD — Relatório Operacional"]);
  rows.push([]);
  rows.push(["Período:", periodLabel || "todo o histórico"]);
  rows.push(["Gerado em:", fmtDateTime(agora)]);
  rows.push([]);
  rows.push(["Total de registros:", totalRegistros]);
  rows.push(["Tempo médio por registro:", fmtDur(mediaSegundos)]);
  rows.push(["Tempo total:", fmtDur(totalSegundos)]);
  rows.push(["Encaixes:", totalEncaixes]);
  rows.push(["Registros com falta:", totalComFalta]);
  rows.push(["Total de faltas:", totalFaltas]);
  rows.push([]);
  rows.push([]);

  // Cabeçalho da tabela
  const headers = [
    "Data", "Hora Início", "Hora Fim", "Duração", "Turno",
    "Operador", "Cód. Operador", "Atividade", "Tipo",
    "Pedido", "Cliente", "Transferência", "Urgente", "Nº Transf.",
    "Veículo", "Placa", "Estação", "Manual", "Faltas", "Observação",
  ];
  rows.push(headers);

  // Ordena por data (mais antigo primeiro)
  const sorted = [...entries].sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
  sorted.forEach((e) => {
    const tipo = e.is_encaixe
      ? "Encaixe"
      : e.transfer_type
      ? "Transferência"
      : e.order_number
      ? "Pedido"
      : "—";
    const faltas = (shortagesByEntry[e.id] || [])
      .map((s) => `${s.product_code} (${s.quantity})`)
      .join(" | ") || "—";
    rows.push([
      fmtDate(e.start_time),
      fmtTime(e.start_time),
      fmtTime(e.end_time),
      fmtDur(e.duration_seconds),
      e.shift,
      e.operator_name,
      e.operator_code,
      e.activity,
      tipo,
      e.order_number || "—",
      e.customer_name || "—",
      e.transfer_type || "—",
      e.transfer_urgent === true ? "Sim" : e.transfer_urgent === false ? "Não" : "—",
      e.transfer_number || "—",
      e.vehicle || "—",
      e.plate || "—",
      e.station || "—",
      e.manual_entry ? "Sim" : "Não",
      faltas,
      e.note || "—",
    ]);
  });

  // Totais no final
  rows.push([]);
  rows.push(["TOTAL DE REGISTROS:", totalRegistros]);
  rows.push(["TEMPO TOTAL:", fmtDur(totalSegundos)]);
  rows.push(["TEMPO MÉDIO:", fmtDur(mediaSegundos)]);
  rows.push(["ENCAIXES:", totalEncaixes]);
  rows.push(["REGISTROS COM FALTA:", totalComFalta]);

  const wb = XLSX.utils.book_new();

  // Aba 1 — Detalhado
  const ws = sheetFromMatrix(rows);
  XLSX.utils.book_append_sheet(wb, ws, "Apontamentos");

  // Aba 2 — Resumo por operador
  if (metrics?.opStats?.length) {
    const opRows = [["RESUMO POR OPERADOR"], [], ["Operador", "Registros", "Tempo Médio", "Tempo Total"]];
    metrics.opStats.forEach((o) => {
      opRows.push([o.name, o.registros, fmtDur(o.media), fmtDur(o.total)]);
    });
    const wsOp = sheetFromMatrix(opRows);
    XLSX.utils.book_append_sheet(wb, wsOp, "Por Operador");
  }

  // Aba 3 — Resumo por atividade
  if (metrics?.avgByActivity?.length) {
    const actRows = [["RESUMO POR ATIVIDADE"], [], ["Atividade", "Registros", "Tempo Médio"]];
    metrics.avgByActivity
      .filter((a) => a.registros > 0)
      .forEach((a) => {
        actRows.push([a.name, a.registros, fmtDur(a.media)]);
      });
    const wsAct = sheetFromMatrix(actRows);
    XLSX.utils.book_append_sheet(wb, wsAct, "Por Atividade");
  }

  const fname = `apontamentos_${dateFrom || "inicio"}_a_${dateTo || "hoje"}.xlsx`;
  downloadWorkbook(wb, fname);
}

// ============================================================
// EXPORTAÇÃO 2: FALTAS DE PRODUTO
// ============================================================

export function exportShortagesExcel({
  shortageEntries,
  shortagesByEntry,
  topShortageProducts,
  topShortageCustomers,
  periodLabel,
  dateFrom,
  dateTo,
}) {
  if (!shortageEntries || shortageEntries.length === 0) {
    alert("Nenhuma falta no período para exportar.");
    return;
  }

  const fmtDate = (iso) => {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  };

  const fmtTime = (iso) => {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const agora = new Date();
  const fmtDateTime = (d) => {
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} às ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  // Contagem geral
  const rows = [];
  const allShortages = [];
  shortageEntries.forEach((e) => {
    (shortagesByEntry[e.id] || []).forEach((s) => allShortages.push({ entry: e, shortage: s }));
  });

  const totalFaltas = allShortages.length;
  const totalPedidos = shortageEntries.length;
  const totalProdutos = new Set(allShortages.map((r) => r.shortage.product_code)).size;
  const totalQtd = allShortages.reduce((sum, r) => sum + (r.shortage.quantity || 0), 0);

  // Cabeçalho
  rows.push(["RELATÓRIO DE FALTAS DE PRODUTO"]);
  rows.push(["Aponta CD — Relatório Operacional"]);
  rows.push([]);
  rows.push(["Período:", periodLabel || "todo o histórico"]);
  rows.push(["Gerado em:", fmtDateTime(agora)]);
  rows.push([]);
  rows.push(["Total de faltas:", totalFaltas]);
  rows.push(["Total de pedidos afetados:", totalPedidos]);
  rows.push(["Total de produtos distintos:", totalProdutos]);
  rows.push(["Quantidade total de itens faltantes:", totalQtd]);
  rows.push([]);
  rows.push([]);

  // Tabela detalhada
  const headers = [
    "Data", "Hora", "Turno", "Operador", "Cód. Operador", "Atividade", "Tipo",
    "Pedido", "Cliente", "Transferência", "Urgente", "Nº Transf.",
    "Veículo", "Placa", "Estação", "Cód. Produto", "Quantidade",
    "Duração da Atividade", "Encaixe",
  ];
  rows.push(headers);

  const sorted = [...allShortages].sort(
    (a, b) => new Date(a.entry.start_time) - new Date(b.entry.start_time)
  );
  sorted.forEach(({ entry: e, shortage: s }) => {
    const tipo = e.is_encaixe ? "Encaixe" : e.transfer_type ? "Transferência" : e.order_number ? "Pedido" : "—";
    rows.push([
      fmtDate(e.start_time),
      fmtTime(e.start_time),
      e.shift,
      e.operator_name,
      e.operator_code,
      e.activity,
      tipo,
      e.order_number || "—",
      e.customer_name || "—",
      e.transfer_type || "—",
      e.transfer_urgent === true ? "Sim" : e.transfer_urgent === false ? "Não" : "—",
      e.transfer_number || "—",
      e.vehicle || "—",
      e.plate || "—",
      e.station || "—",
      s.product_code,
      s.quantity,
      `${Math.round((e.duration_seconds || 0) / 60)} min`,
      e.is_encaixe ? "Sim" : "Não",
    ]);
  });

  // Totais finais
  rows.push([]);
  rows.push(["TOTAL DE FALTAS:", totalFaltas]);
  rows.push(["TOTAL DE PEDIDOS AFETADOS:", totalPedidos]);
  rows.push(["TOTAL DE PRODUTOS DISTINTOS:", totalProdutos]);
  rows.push(["QUANTIDADE TOTAL DE ITENS FALTANTES:", totalQtd]);

  const wb = XLSX.utils.book_new();
  const ws = sheetFromMatrix(rows);
  XLSX.utils.book_append_sheet(wb, ws, "Faltas");

  // Aba resumo por produto
  if (topShortageProducts?.length) {
    const pRows = [["PRODUTOS QUE MAIS FALTAM"], [], ["Código do Produto", "Ocorrências", "Quantidade Total"]];
    topShortageProducts.forEach((p) => pRows.push([p.code, p.count, p.totalQty]));
    const wsP = sheetFromMatrix(pRows);
    XLSX.utils.book_append_sheet(wb, wsP, "Por Produto");
  }

  // Aba resumo por cliente
  if (topShortageCustomers?.length) {
    const cRows = [["CLIENTES MAIS AFETADOS"], [], ["Cliente", "Pedidos Afetados", "Faltas", "Quantidade Total"]];
    topShortageCustomers.forEach((c) => cRows.push([c.name, c.entriesCount, c.totalFaltas, c.totalQty]));
    const wsC = sheetFromMatrix(cRows);
    XLSX.utils.book_append_sheet(wb, wsC, "Por Cliente");
  }

  const fname = `faltas_${dateFrom || "inicio"}_a_${dateTo || "hoje"}.xlsx`;
  downloadWorkbook(wb, fname);
}

// ============================================================
// EXPORTAÇÃO 3: ERROS DE SEPARAÇÃO
// ============================================================

export function exportErrorsExcel({
  errors,
  errorsByType,
  errorRanking,
  errorsByReporter,
  periodLabel,
  dateFrom,
  dateTo,
}) {
  if (!errors || errors.length === 0) {
    alert("Nenhum erro no período para exportar.");
    return;
  }

  const fmtDate = (iso) => {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  };

  const fmtTime = (iso) => {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const agora = new Date();
  const fmtDateTime = (d) => {
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} às ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const totalErros = errors.length;
  const tiposDistintos = new Set(errors.map((e) => e.error_type)).size;
  const operadoresQueApontaram = new Set(errors.map((e) => e.operator_code)).size;
  const operadoresQueErraram = new Set(
    errors.filter((e) => e.error_operator_code).map((e) => e.error_operator_code)
  ).size;

  const rows = [];
  rows.push(["RELATÓRIO DE ERROS DE SEPARAÇÃO"]);
  rows.push(["Aponta CD — Relatório Operacional"]);
  rows.push([]);
  rows.push(["Período:", periodLabel || "todo o histórico"]);
  rows.push(["Gerado em:", fmtDateTime(agora)]);
  rows.push([]);
  rows.push(["Total de erros:", totalErros]);
  rows.push(["Tipos distintos:", tiposDistintos]);
  rows.push(["Operadores que apontaram:", operadoresQueApontaram]);
  rows.push(["Operadores que erraram:", operadoresQueErraram]);
  rows.push([]);
  rows.push([]);

  const headers = [
    "Data", "Hora", "Tipo do Pedido", "Número",
    "Tipo de Erro", "Observação",
    "Operador que Errou", "Cód. de Quem Errou",
    "Quem Apontou", "Cód. de Quem Apontou",
    "Estação",
  ];
  rows.push(headers);

  const sorted = [...errors].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  sorted.forEach((e) => {
    rows.push([
      fmtDate(e.created_at),
      fmtTime(e.created_at),
      e.order_type === "pedido" ? "Pedido" : e.order_type === "transferencia" ? "Transferência" : "—",
      e.order_number || "—",
      e.error_type,
      e.note || "—",
      e.error_operator_name || "—",
      e.error_operator_code || "—",
      e.operator_name,
      e.operator_code,
      e.station || "—",
    ]);
  });

  rows.push([]);
  rows.push(["TOTAL DE ERROS:", totalErros]);

  const wb = XLSX.utils.book_new();
  const ws = sheetFromMatrix(rows);
  XLSX.utils.book_append_sheet(wb, ws, "Erros");

  // Aba ranking
  if (errorRanking?.length) {
    const rRows = [["RANKING — OPERADORES QUE MAIS ERRARAM"], [], ["Posição", "Operador", "Código", "Total de Erros"]];
    errorRanking.forEach((r, i) => rRows.push([i + 1, r.name, r.code, r.count]));
    const wsR = sheetFromMatrix(rRows);
    XLSX.utils.book_append_sheet(wb, wsR, "Ranking");
  }

  // Aba por tipo
  if (errorsByType?.length) {
    const tRows = [["RESUMO POR TIPO DE ERRO"], [], ["Tipo", "Ocorrências"]];
    errorsByType.forEach((t) => tRows.push([t.name, t.total]));
    const wsT = sheetFromMatrix(tRows);
    XLSX.utils.book_append_sheet(wb, wsT, "Por Tipo");
  }

  // Aba quem apontou
  if (errorsByReporter?.length) {
    const aRows = [["RESUMO POR QUEM APONTOU"], [], ["Operador", "Total de Apontamentos"]];
    errorsByReporter.forEach((r) => aRows.push([r.name, r.count]));
    const wsA = sheetFromMatrix(aRows);
    XLSX.utils.book_append_sheet(wb, wsA, "Quem Apontou");
  }

  const fname = `erros_separacao_${dateFrom || "inicio"}_a_${dateTo || "hoje"}.xlsx`;
  downloadWorkbook(wb, fname);
}