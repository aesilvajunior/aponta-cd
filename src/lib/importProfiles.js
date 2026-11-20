// ============================================================
// Perfis de Importação CSV/Excel + Análise Automática de Divergências
// Permite salvar modelos de mapeamento (ex.: relatório do ERP)
// para importar em 1 clique e revisar divergências antes de gravar.
// ============================================================
import { supabase } from "../supabaseClient";
import { fetchSystemStatus, upsertSystemStatus } from "./api";

const PROFILES_KEY = "aponta_import_profiles_v1";

export const IMPORT_TARGETS = [
  {
    id: "stock_map_items",
    label: "Mapa do Estoque (endereços e saldos)",
    description: "Importa ou atualiza produtos e quantidades nas áreas do mapa",
    fields: [
      { key: "area_code", label: "Código da Área / Rua", required: true, aliases: ["area", "area_code", "rua", "endereco", "endereço", "corredor", "local", "prateleira"] },
      { key: "product_code", label: "Código do Produto (SKU)", required: true, aliases: ["codigo", "código", "product_code", "sku", "cod_prod", "cod produto", "item", "referencia", "ref"] },
      { key: "product_name", label: "Nome / Descrição", required: false, aliases: ["nome", "descricao", "descrição", "product_name", "produto", "desc"] },
      { key: "quantity", label: "Quantidade / Saldo", required: false, aliases: ["qtd", "qtde", "quantidade", "saldo", "estoque", "quantity", "un", "unidades"] },
      { key: "category", label: "Categoria / Grupo", required: false, aliases: ["categoria", "grupo", "familia", "família", "category", "linha"] },
      { key: "side", label: "Lado (PAR/ÍMPAR)", required: false, aliases: ["lado", "side", "face"] },
      { key: "slot", label: "Posição / Vão (Slot)", required: false, aliases: ["slot", "posicao", "posição", "vao", "vão", "coluna", "pos"] },
      { key: "level", label: "Nível / Andar", required: false, aliases: ["nivel", "nível", "level", "altura", "prateleira_nivel"] },
      { key: "barcode", label: "Código de Barras (EAN)", required: false, aliases: ["ean", "barcode", "cod_barras", "codigo_barras", "gtin", "barras"] },
      { key: "note", label: "Observação", required: false, aliases: ["obs", "observacao", "observação", "note", "notas"] },
    ],
  },
  {
    id: "product_barcodes",
    label: "Catálogo de Códigos de Barras (EAN)",
    description: "Alimenta o catálogo usado na tela de coleta para reconhecer produtos na hora",
    fields: [
      { key: "barcode", label: "Código de Barras (EAN)", required: true, aliases: ["ean", "barcode", "cod_barras", "codigo_barras", "gtin", "barras"] },
      { key: "product_code", label: "Código Interno (SKU)", required: false, aliases: ["codigo", "código", "product_code", "sku", "cod_prod", "referencia"] },
      { key: "product_name", label: "Nome do Produto", required: true, aliases: ["nome", "descricao", "descrição", "product_name", "produto"] },
      { key: "category", label: "Categoria", required: false, aliases: ["categoria", "grupo", "familia", "category"] },
    ],
  },
  {
    id: "orders_crosscheck",
    label: "Relatório ERP (Cruzamento de Pedidos)",
    description: "Cruza pedidos/volumes do ERP com os apontamentos do Aponta CD",
    fields: [
      { key: "order_number", label: "Número do Pedido", required: true, aliases: ["pedido", "order", "order_number", "num_pedido", "n_pedido", "numero", "número", "doc"] },
      { key: "customer_name", label: "Cliente", required: false, aliases: ["cliente", "customer", "razao", "razão", "destinatario", "nome_cliente"] },
      { key: "product_code", label: "Código do Produto", required: false, aliases: ["codigo", "código", "sku", "product_code", "item"] },
      { key: "quantity", label: "Quantidade / Volumes", required: false, aliases: ["qtd", "qtde", "quantidade", "volumes", "itens", "quantity"] },
    ],
  },
];

export const DEFAULT_PROFILES = [
  {
    id: "preset-erp-estoque",
    name: "ERP Padrão — Posição de Estoque",
    targetType: "stock_map_items",
    builtIn: true,
    mapping: {
      area_code: "AREA",
      product_code: "CODIGO",
      product_name: "DESCRICAO",
      quantity: "SALDO",
      category: "CATEGORIA",
      side: "LADO",
      slot: "POSICAO",
      level: "NIVEL",
      barcode: "EAN",
    },
  },
  {
    id: "preset-erp-pedidos",
    name: "ERP Padrão — Relatório de Pedidos",
    targetType: "orders_crosscheck",
    builtIn: true,
    mapping: {
      order_number: "PEDIDO",
      customer_name: "CLIENTE",
      quantity: "VOLUMES",
    },
  },
];

export function getTargetSchema(targetType) {
  return IMPORT_TARGETS.find((t) => t.id === targetType) || IMPORT_TARGETS[0];
}

function normHeader(h) {
  return String(h || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function parseNumberBR(val) {
  if (val === null || val === undefined || val === "") return 0;
  if (typeof val === "number") return Number.isFinite(val) ? val : 0;
  const s = String(val).trim();
  // Trata "1.234,56" -> "1234.56" ou "12,5" -> "12.5"
  const normalized = s.includes(",") && s.includes(".")
    ? s.replace(/\./g, "").replace(",", ".")
    : s.replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

function normalizeSide(raw) {
  const s = normHeader(raw);
  if (!s) return null;
  if (s.includes("impar")) return "impar";
  if (s.includes("par")) return "par";
  return null;
}

// Sugere mapeamento automático comparando cabeçalhos da planilha com aliases conhecidos
export function suggestColumnMapping(headers = [], targetType = "stock_map_items") {
  const schema = getTargetSchema(targetType);
  const normalizedHeaders = headers.map((h) => ({ raw: h, norm: normHeader(h) }));
  const mapping = {};
  const used = new Set();

  schema.fields.forEach((field) => {
    const candidates = [field.key, ...(field.aliases || [])].map(normHeader);
    // 1) match exato
    let hit = normalizedHeaders.find((h) => !used.has(h.raw) && candidates.includes(h.norm));
    // 2) match por substring
    if (!hit) {
      hit = normalizedHeaders.find(
        (h) => !used.has(h.raw) && candidates.some((c) => h.norm.includes(c) || c.includes(h.norm))
      );
    }
    if (hit) {
      mapping[field.key] = hit.raw;
      used.add(hit.raw);
    }
  });

  return mapping;
}

// Detecta automaticamente qual perfil salvo casa melhor com as colunas da planilha enviada
export function autoDetectProfile(headers = [], profiles = []) {
  if (!headers.length || !profiles.length) return null;
  const headerSet = new Set(headers.map(normHeader));
  const headerByNorm = new Map(headers.map((h) => [normHeader(h), h]));

  let best = null;
  for (const profile of profiles) {
    const mappedCols = Object.entries(profile.mapping || {}).filter(([, col]) => !!col);
    if (mappedCols.length === 0) continue;

    let matches = 0;
    const resolvedMapping = {};
    for (const [fieldKey, colName] of mappedCols) {
      const n = normHeader(colName);
      if (headerSet.has(n)) {
        matches += 1;
        resolvedMapping[fieldKey] = headerByNorm.get(n);
      }
    }

    const score = matches / mappedCols.length;
    if (score >= 0.6 && (!best || score > best.score || (score === best.score && matches > best.matches))) {
      best = { profile, score, matches, total: mappedCols.length, resolvedMapping };
    }
  }

  return best;
}

// ============================================================
// Resumo Automático de Divergências (antes de gravar no banco)
// ============================================================
export function analyzeImportDivergences({
  rows = [],
  mapping = {},
  targetType = "stock_map_items",
  existingAreas = [],
  existingItems = [],
  existingCatalog = [],
  existingEntries = [],
}) {
  const getVal = (row, fieldKey) => {
    const col = mapping[fieldKey];
    if (!col) return "";
    const v = row[col];
    return v === null || v === undefined ? "" : String(v).trim();
  };

  if (targetType === "stock_map_items") {
    return analyzeStockMapImport({ rows, getVal, existingAreas, existingItems });
  }
  if (targetType === "product_barcodes") {
    return analyzeBarcodeImport({ rows, getVal, existingCatalog });
  }
  return analyzeOrdersCrossCheck({ rows, getVal, existingEntries });
}

function analyzeStockMapImport({ rows, getVal, existingAreas, existingItems }) {
  const areaByCode = new Map(existingAreas.map((a) => [String(a.code || "").trim().toUpperCase(), a]));
  const existingByKey = new Map();
  existingItems.forEach((it) => {
    const k = `${it.area_id}|${String(it.product_code || "").trim().toUpperCase()}|${String(it.side || "").toLowerCase()}|${String(it.slot || "").trim().toUpperCase()}`;
    existingByKey.set(k, it);
  });

  const seenInFile = new Map();
  const validRows = [];
  const toInsert = [];
  const toUpdate = [];
  const unchanged = [];
  const divergences = [];

  rows.forEach((row, idx) => {
    const line = idx + 2;
    const areaCode = getVal(row, "area_code").toUpperCase();
    const productCode = getVal(row, "product_code");
    const productName = getVal(row, "product_name") || null;
    const category = getVal(row, "category") || null;
    const quantity = Math.round(parseNumberBR(getVal(row, "quantity")));
    const side = normalizeSide(getVal(row, "side"));
    const slot = getVal(row, "slot") || null;
    const level = getVal(row, "level") || null;
    const barcode = getVal(row, "barcode") || null;
    const note = getVal(row, "note") || null;

    if (!areaCode || !productCode) {
      divergences.push({
        line,
        type: "missing_required",
        severity: "error",
        code: productCode || areaCode || "—",
        detail: !areaCode ? "Sem código de área/rua" : "Sem código de produto",
      });
      return;
    }

    const area = areaByCode.get(areaCode);
    if (!area) {
      divergences.push({
        line,
        type: "unknown_area",
        severity: "error",
        code: productCode,
        detail: `Área "${areaCode}" não existe no mapa do estoque`,
      });
      return;
    }

    const dedupKey = `${area.id}|${productCode.toUpperCase()}|${side || ""}|${(slot || "").toUpperCase()}`;
    if (seenInFile.has(dedupKey)) {
      divergences.push({
        line,
        type: "duplicate_in_file",
        severity: "warning",
        code: productCode,
        detail: `Duplicado na planilha (mesmo SKU/endereço da linha ${seenInFile.get(dedupKey)})`,
      });
      return;
    }
    seenInFile.set(dedupKey, line);

    const payload = {
      area_id: area.id,
      area_code: area.code,
      side,
      product_code: productCode,
      product_name: productName,
      category,
      quantity,
      slot,
      level,
      barcode,
      note,
    };

    const existing = existingByKey.get(dedupKey);
    validRows.push(payload);

    if (!existing) {
      toInsert.push(payload);
    } else {
      const oldQty = Number(existing.quantity) || 0;
      const qtyDiff = quantity - oldQty;
      const nameChanged = productName && productName !== (existing.product_name || "");
      const catChanged = category && category !== (existing.category || "");

      if (qtyDiff !== 0 || nameChanged || catChanged) {
        toUpdate.push({ id: existing.id, before: existing, after: payload, qtyDiff });
        if (qtyDiff !== 0) {
          divergences.push({
            line,
            type: "quantity_divergence",
            severity: "warning",
            code: productCode,
            areaCode: area.code,
            currentValue: oldQty,
            incomingValue: quantity,
            diff: qtyDiff,
            detail: `Saldo diverge em ${area.code}: CD ${oldQty} un → Planilha ${quantity} un (${qtyDiff > 0 ? "+" : ""}${qtyDiff})`,
          });
        }
      } else {
        unchanged.push(payload);
      }
    }
  });

  const netQtyDelta = toUpdate.reduce((s, u) => s + u.qtyDiff, 0) + toInsert.reduce((s, r) => s + r.quantity, 0);

  return {
    targetType: "stock_map_items",
    totalRows: rows.length,
    validRows,
    toInsert,
    toUpdate,
    unchanged,
    divergences,
    summary: {
      total: rows.length,
      newCount: toInsert.length,
      updateCount: toUpdate.length,
      unchangedCount: unchanged.length,
      errorCount: divergences.filter((d) => d.severity === "error").length,
      warningCount: divergences.filter((d) => d.severity === "warning").length,
      netQtyDelta,
    },
  };
}

function analyzeBarcodeImport({ rows, getVal, existingCatalog }) {
  const existingByBarcode = new Map(existingCatalog.map((c) => [String(c.barcode || "").toUpperCase(), c]));
  const seen = new Set();
  const validRows = [];
  const toInsert = [];
  const toUpdate = [];
  const unchanged = [];
  const divergences = [];

  rows.forEach((row, idx) => {
    const line = idx + 2;
    const barcode = getVal(row, "barcode").toUpperCase();
    const productCode = getVal(row, "product_code") || null;
    const productName = getVal(row, "product_name") || null;
    const category = getVal(row, "category") || null;

    if (!barcode || !productName) {
      divergences.push({
        line,
        type: "missing_required",
        severity: "error",
        code: barcode || productCode || "—",
        detail: !barcode ? "Sem código de barras (EAN)" : "Sem nome do produto",
      });
      return;
    }

    if (seen.has(barcode)) {
      divergences.push({
        line,
        type: "duplicate_in_file",
        severity: "warning",
        code: barcode,
        detail: "EAN repetido na planilha",
      });
      return;
    }
    seen.add(barcode);

    const payload = { barcode, product_code: productCode, product_name: productName, category };
    validRows.push(payload);
    const existing = existingByBarcode.get(barcode);

    if (!existing) {
      toInsert.push(payload);
    } else if (existing.product_name !== productName || (productCode && existing.product_code !== productCode)) {
      toUpdate.push({ barcode, before: existing, after: payload });
      divergences.push({
        line,
        type: "catalog_change",
        severity: "warning",
        code: barcode,
        currentValue: existing.product_name,
        incomingValue: productName,
        detail: `Descrição alterada: "${existing.product_name || "—"}" → "${productName}"`,
      });
    } else {
      unchanged.push(payload);
    }
  });

  return {
    targetType: "product_barcodes",
    totalRows: rows.length,
    validRows,
    toInsert,
    toUpdate,
    unchanged,
    divergences,
    summary: {
      total: rows.length,
      newCount: toInsert.length,
      updateCount: toUpdate.length,
      unchangedCount: unchanged.length,
      errorCount: divergences.filter((d) => d.severity === "error").length,
      warningCount: divergences.filter((d) => d.severity === "warning").length,
      netQtyDelta: 0,
    },
  };
}

function analyzeOrdersCrossCheck({ rows, getVal, existingEntries }) {
  const cdOrders = new Set(existingEntries.map((e) => String(e.order_number || "").trim()).filter(Boolean));
  const fileOrders = new Map();
  const divergences = [];

  rows.forEach((row, idx) => {
    const line = idx + 2;
    const order = getVal(row, "order_number");
    if (!order) {
      divergences.push({ line, type: "missing_required", severity: "error", code: "—", detail: "Sem nº do pedido" });
      return;
    }
    if (!fileOrders.has(order)) {
      fileOrders.set(order, {
        line,
        order_number: order,
        customer_name: getVal(row, "customer_name"),
        quantity: parseNumberBR(getVal(row, "quantity")),
      });
    }
  });

  const matched = [];
  const onlyInFile = [];
  fileOrders.forEach((info, order) => {
    if (cdOrders.has(order)) {
      matched.push(info);
    } else {
      onlyInFile.push(info);
      divergences.push({
        line: info.line,
        type: "unmatched_order",
        severity: "warning",
        code: order,
        detail: `Pedido #${order}${info.customer_name ? ` (${info.customer_name})` : ""} está na planilha ERP, mas não foi apontado no CD`,
      });
    }
  });

  const onlyInCd = [...cdOrders].filter((o) => !fileOrders.has(o));

  return {
    targetType: "orders_crosscheck",
    totalRows: rows.length,
    validRows: [...fileOrders.values()],
    toInsert: onlyInFile,
    toUpdate: [],
    unchanged: matched,
    onlyInCd,
    divergences,
    summary: {
      total: fileOrders.size,
      newCount: onlyInFile.length,
      updateCount: 0,
      unchangedCount: matched.length,
      onlyInCdCount: onlyInCd.length,
      errorCount: divergences.filter((d) => d.severity === "error").length,
      warningCount: divergences.filter((d) => d.severity === "warning").length,
      netQtyDelta: 0,
    },
  };
}

// ============================================================
// Persistência de perfis (system_status + localStorage)
// ============================================================

export function readLocalProfiles() {
  try {
    const raw = localStorage.getItem(PROFILES_KEY);
    const custom = raw ? JSON.parse(raw) : [];
    return [...DEFAULT_PROFILES, ...custom.filter((p) => !p.builtIn)];
  } catch {
    return [...DEFAULT_PROFILES];
  }
}

function writeLocalCustomProfiles(allProfiles) {
  try {
    const custom = allProfiles.filter((p) => !p.builtIn);
    localStorage.setItem(PROFILES_KEY, JSON.stringify(custom));
  } catch {
    /* ignora */
  }
}

export async function loadImportProfiles() {
  const local = readLocalProfiles();
  try {
    const { data } = await fetchSystemStatus();
    const row = (data || []).find((r) => r.key === "import_profiles");
    if (Array.isArray(row?.value)) {
      const merged = [...DEFAULT_PROFILES, ...row.value.filter((p) => !p.builtIn)];
      writeLocalCustomProfiles(merged);
      return merged;
    }
  } catch {
    /* usa local */
  }
  return local;
}

export async function saveImportProfile(profile, currentProfiles = []) {
  const id = profile.id || `prof-${Date.now()}`;
  const clean = {
    id,
    name: String(profile.name || "Perfil sem nome").trim(),
    targetType: profile.targetType || "stock_map_items",
    mapping: profile.mapping || {},
    builtIn: false,
    updatedAt: new Date().toISOString(),
  };

  const base = currentProfiles.length ? currentProfiles : readLocalProfiles();
  const custom = base.filter((p) => !p.builtIn && p.id !== id);
  const nextCustom = [clean, ...custom];
  const all = [...DEFAULT_PROFILES, ...nextCustom];
  writeLocalCustomProfiles(all);

  try {
    await upsertSystemStatus("import_profiles", nextCustom);
  } catch {
    /* mantido localmente */
  }
  return { profile: clean, profiles: all };
}

export async function deleteImportProfile(profileId, currentProfiles = []) {
  const base = currentProfiles.length ? currentProfiles : readLocalProfiles();
  const nextCustom = base.filter((p) => !p.builtIn && p.id !== profileId);
  const all = [...DEFAULT_PROFILES, ...nextCustom];
  writeLocalCustomProfiles(all);
  try {
    await upsertSystemStatus("import_profiles", nextCustom);
  } catch {
    /* mantido localmente */
  }
  return all;
}

// ============================================================
// Execução da gravação após revisão de divergências
// ============================================================
export async function executeAnalyzedImport(analysis, { applyUpdates = true } = {}) {
  if (analysis.targetType === "stock_map_items") {
    let inserted = 0;
    let updated = 0;

    if (analysis.toInsert.length > 0) {
      const rows = analysis.toInsert.map((r) => ({
        area_id: r.area_id,
        side: r.side || null,
        product_code: r.product_code,
        product_name: r.product_name || null,
        category: r.category || null,
        quantity: r.quantity || 0,
        slot: r.slot || null,
        level: r.level || null,
        barcode: r.barcode || null,
        note: r.note || null,
        source: "importacao",
      }));
      const { error } = await supabase.from("stock_map_items").insert(rows);
      if (error) return { error, inserted, updated };
      inserted = rows.length;
    }

    if (applyUpdates && analysis.toUpdate.length > 0) {
      for (const u of analysis.toUpdate) {
        const patch = {
          quantity: u.after.quantity,
          ...(u.after.product_name ? { product_name: u.after.product_name } : {}),
          ...(u.after.category ? { category: u.after.category } : {}),
          ...(u.after.barcode ? { barcode: u.after.barcode } : {}),
          ...(u.after.level ? { level: u.after.level } : {}),
          ...(u.after.note ? { note: u.after.note } : {}),
        };
        const { error } = await supabase.from("stock_map_items").update(patch).eq("id", u.id);
        if (error) return { error, inserted, updated };
        updated += 1;
      }
    }

    return { error: null, inserted, updated };
  }

  if (analysis.targetType === "product_barcodes") {
    const batch = applyUpdates ? [...analysis.toInsert, ...analysis.toUpdate.map((u) => u.after)] : analysis.toInsert;
    if (batch.length === 0) return { error: null, inserted: 0, updated: 0 };
    const now = new Date().toISOString();
    const rows = batch.map((r) => ({ ...r, updated_at: now }));
    const { error } = await supabase.from("product_barcodes").upsert(rows, { onConflict: "barcode" });
    if (error) return { error, inserted: 0, updated: 0 };
    return {
      error: null,
      inserted: analysis.toInsert.length,
      updated: applyUpdates ? analysis.toUpdate.length : 0,
    };
  }

  return { error: null, inserted: 0, updated: 0 };
}
