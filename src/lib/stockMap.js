import { supabase } from "../supabaseClient";

// ============================================================
// Mapa do estoque — helpers v3
// ============================================================

export const AREA_TYPES = [
  { value: "prateleira", label: "Prateleira", color: "#4a7ba7" },
  { value: "conferencia_pedidos", label: "Mesa de conferência — Pedidos", color: "#10b981" },
  { value: "conferencia_transferencia", label: "Mesa de conferência — Transferência", color: "#0284c7" },
  { value: "carro_apoio", label: "Carro de apoio", color: "#f59e0b" },
  { value: "conferencia", label: "Mesa de conferência (geral)", color: "#10b981" },
  { value: "escada", label: "Escada", color: "#7c3aed" },
  { value: "elevador", label: "Elevador / Monta-carga", color: "#4f46e5" },
  { value: "recebimento", label: "Recebimento", color: "#f97316" },
  { value: "escritorio", label: "Escritório", color: "#6b7280" },
  { value: "infra", label: "Infraestrutura", color: "#8b5cf6" },
  { value: "corredor", label: "Corredor", color: "#00d4ff" },
  { value: "outro", label: "Outro", color: "#1e3a5f" },
];

export function resolveSpecialAreaKind(area) {
  if (!area) return null;
  const type = String(area.area_type || "").toLowerCase();
  const text = `${area.code || ""} ${area.label || ""}`.toLowerCase();

  if (type === "escada" || /\bescad/.test(text)) return "escada";
  if (type === "elevador" || /elevad|monta[\s-]?carga/.test(text)) return "elevador";
  if (type === "carro_apoio" || /carro[\s_-]?(de[\s_-]?)?apoio|\bapoio\b|\bcarrinho\b/.test(text)) {
    return "carro_apoio";
  }
  if (
    type === "conferencia_transferencia" ||
    (type === "conferencia" && /transf/.test(text)) ||
    (/mesa|conf/.test(text) && /transf/.test(text))
  ) {
    return "conferencia_transferencia";
  }
  if (type === "conferencia_pedidos" || type === "conferencia") {
    return "conferencia_pedidos";
  }
  return null;
}

export const SIDES = [
  { value: "par", label: "Par (direita)", short: "PAR" },
  { value: "impar", label: "Ímpar (esquerda)", short: "ÍMPAR" },
];

export const DEFAULT_CATEGORIES = [
  "Conexões",
  "Vedações",
  "Tubos",
  "Registros",
  "Válvulas",
  "Caixas d'água",
  "Ferramentas",
  "Elétrica",
  "Tintas",
  "Diversos",
];

export function colorForType(type) {
  return AREA_TYPES.find((t) => t.value === type)?.color || "#1e3a5f";
}

export function labelForType(type) {
  return AREA_TYPES.find((t) => t.value === type)?.label || type;
}

export function labelForSide(side) {
  if (side === "par") return "Par (direita)";
  if (side === "impar") return "Ímpar (esquerda)";
  return "—";
}

// ---------- Áreas ----------

export async function fetchMapAreas() {
  const { data, error } = await supabase
    .from("stock_map_areas")
    .select("*")
    .order("floor")
    .order("y")
    .order("x");
  return { data: data || [], error };
}

export async function addMapArea({
  code, label, areaType = "prateleira", floor = "terreo",
  hasSides = false, x, y, width, height, color, meta,
}) {
  return supabase
    .from("stock_map_areas")
    .insert({
      code: code.trim().toUpperCase(),
      label: label.trim(),
      area_type: areaType,
      floor,
      has_sides: hasSides,
      x: Number(x) || 0,
      y: Number(y) || 0,
      width: Number(width) || 5,
      height: Number(height) || 5,
      color: color || colorForType(areaType),
      meta: meta || null,
    })
    .select()
    .maybeSingle();
}

export async function updateMapArea(id, fields) {
  return supabase.from("stock_map_areas").update(fields).eq("id", id);
}

export async function deleteMapArea(id) {
  return supabase.from("stock_map_areas").delete().eq("id", id);
}

// ---------- Itens ----------

export async function fetchMapItems({ areaId } = {}) {
  let query = supabase
    .from("stock_map_items")
    .select("*")
    .order("side")
    .order("category")
    .order("product_code");
  if (areaId) query = query.eq("area_id", areaId);
  const { data, error } = await query;
  return { data: data || [], error };
}

export async function addMapItem({
  areaId, side = null, productCode, productName, category, quantity, slot, note,
}) {
  return supabase
    .from("stock_map_items")
    .insert({
      area_id: areaId,
      side: side || null,
      product_code: productCode.trim(),
      product_name: productName?.trim() || null,
      category: category?.trim() || null,
      quantity: Number(quantity) || 0,
      slot: slot?.trim() || null,
      note: note?.trim() || null,
    })
    .select()
    .maybeSingle();
}

export async function updateMapItem(id, fields) {
  return supabase.from("stock_map_items").update(fields).eq("id", id);
}

export async function deleteMapItem(id) {
  return supabase.from("stock_map_items").delete().eq("id", id);
}

// ---------- Agrupamento ----------

export function groupItemsBySide(items) {
  const par = items.filter((i) => i.side === "par" || !i.side);
  const impar = items.filter((i) => i.side === "impar");
  return { par, impar };
}

export function groupItemsByCategory(items) {
  const map = {};
  items.forEach((it) => {
    const cat = it.category || "Sem categoria";
    if (!map[cat]) map[cat] = [];
    map[cat].push(it);
  });
  return Object.entries(map)
    .map(([category, list]) => ({
      category,
      items: list,
      skus: list.length,
      totalQty: list.reduce((s, i) => s + (i.quantity || 0), 0),
    }))
    .sort((a, b) => b.totalQty - a.totalQty);
}

export function summarizeArea(area, items) {
  const list = items.filter((i) => i.area_id === area.id);
  const { par, impar } = groupItemsBySide(list);
  return {
    skus: list.length,
    totalQty: list.reduce((s, i) => s + (i.quantity || 0), 0),
    par: {
      skus: par.filter((i) => i.side === "par").length,
      totalQty: par.filter((i) => i.side === "par").reduce((s, i) => s + (i.quantity || 0), 0),
    },
    impar: {
      skus: impar.length,
      totalQty: impar.reduce((s, i) => s + (i.quantity || 0), 0),
    },
  };
}

// ---------- Import CSV (stub) ----------

export async function bulkImportItems(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { error: { message: "Nenhuma linha pra importar." } };
  }

  const { data: areas, error: areasErr } = await fetchMapAreas();
  if (areasErr) return { error: areasErr };

  const areaByCode = {};
  areas.forEach((a) => { areaByCode[a.code.toUpperCase()] = a.id; });

  const payload = [];
  const errors = [];

  rows.forEach((row, idx) => {
    const code = String(row.area_code || row.Area || row.AREA || "").trim().toUpperCase();
    if (!code) { errors.push(`Linha ${idx + 2}: sem área`); return; }
    const areaId = areaByCode[code];
    if (!areaId) { errors.push(`Linha ${idx + 2}: área "${code}" não encontrada`); return; }

    const sideRaw = String(row.side || row.Lado || row.LADO || "").trim().toLowerCase();
    let side = null;
    if (sideRaw.includes("par") && !sideRaw.includes("impar")) side = "par";
    else if (sideRaw.includes("impar") || sideRaw.includes("ímpar")) side = "impar";

    const productCode = String(row.product_code || row.Codigo || row.CODIGO || "").trim();
    if (!productCode) { errors.push(`Linha ${idx + 2}: sem código de produto`); return; }

    payload.push({
      area_id: areaId,
      side,
      product_code: productCode,
      product_name: String(row.product_name || row.Nome || row.NOME || "").trim() || null,
      category: String(row.category || row.Categoria || row.CATEGORIA || "").trim() || null,
      quantity: parseInt(row.quantity || row.Qtd || row.QTD || 0, 10) || 0,
      slot: String(row.slot || row.Slot || row.SLOT || "").trim() || null,
      note: String(row.note || row.Obs || row.OBS || "").trim() || null,
    });
  });

  if (payload.length === 0) {
    return { error: { message: `Nenhuma linha válida. ${errors.slice(0, 5).join(" · ")}` } };
  }

  const { data, error } = await supabase.from("stock_map_items").insert(payload).select();
  return { data, error, skipped: errors };
}