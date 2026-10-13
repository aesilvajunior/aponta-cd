// ============================================================
// Coleta por código de barras: grava no mapa do estoque.
// Cada bip tem um id próprio (scanId), então reenviar da fila offline nunca
// soma duas vezes: o registro do bip entra PRIMEIRO e, se o id já existir,
// o bip é tratado como já processado.
// ============================================================
import { supabase } from "../supabaseClient";
import { planScan } from "./mapScanPlan";
import { logStockMapAction } from "./api";

const CATALOG_CACHE_KEY = "aponta_barcode_catalog_v1";
const CATALOG_MAX = 20000;

// ---------- Catálogo (código de barras -> produto) ----------

let catalogMap = null; // Map(barcode -> entry)

function readCache() {
  try {
    const raw = localStorage.getItem(CATALOG_CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeCache(entries) {
  try {
    localStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify(entries.slice(0, CATALOG_MAX)));
  } catch {
    /* sem espaço: segue só em memória */
  }
}

// Carrega o catálogo (do servidor; se falhar, usa a cópia guardada no aparelho).
export async function loadCatalog() {
  const { data, error } = await supabase
    .from("product_barcodes")
    .select("barcode, product_code, product_name, category")
    .limit(CATALOG_MAX);
  const entries = error || !data ? readCache() : data;
  if (!error && data) writeCache(data);
  catalogMap = new Map(entries.map((e) => [String(e.barcode).toUpperCase(), e]));
  return { count: catalogMap.size, error, tableMissing: !!error && isMissingTable(error) };
}

export function lookupCatalog(barcode) {
  if (!catalogMap) catalogMap = new Map(readCache().map((e) => [String(e.barcode).toUpperCase(), e]));
  return catalogMap.get(String(barcode).toUpperCase()) || null;
}

// Procura também no que já está no mapa (produto já cadastrado por código, mesmo sem catálogo).
export function lookupInItems(items, barcode) {
  const b = String(barcode).toUpperCase();
  const hit = items.find((it) => String(it.barcode || "").toUpperCase() === b || String(it.product_code || "").toUpperCase() === b);
  return hit ? { barcode: b, product_code: hit.product_code, product_name: hit.product_name, category: hit.category } : null;
}

export async function saveCatalogEntry({ barcode, productCode, productName, category, createdBy }) {
  const entry = {
    barcode: String(barcode).toUpperCase(),
    product_code: (productCode || "").trim() || null,
    product_name: (productName || "").trim() || null,
    category: (category || "").trim() || null,
    created_by: createdBy || null,
    updated_at: new Date().toISOString(),
  };
  // atualiza o catálogo local na hora (funciona mesmo sem internet)
  if (!catalogMap) catalogMap = new Map(readCache().map((e) => [String(e.barcode).toUpperCase(), e]));
  catalogMap.set(entry.barcode, entry);
  writeCache([...catalogMap.values()]);

  const { error } = await supabase.from("product_barcodes").upsert(entry, { onConflict: "barcode" });
  return { entry, error };
}

export function isMissingTable(error) {
  const code = error?.code || "";
  return code === "42P01" || code === "PGRST205" || /could not find the table|does not exist/i.test(error?.message || "");
}

// ---------- Gravação do bip ----------

export async function fetchAreaItems(areaId) {
  const { data, error } = await supabase.from("stock_map_items").select("*").eq("area_id", areaId);
  return { data: data || [], error };
}

// args: { scanId, area, side, slot, level, barcode, catalog, mode, operator, station }
export async function recordScan(args) {
  const { scanId, area, side, slot, level, barcode, catalog, mode, operator, station } = args;

  // 1) registro do bip primeiro: chave duplicada = este bip já foi processado
  const scanRow = {
    id: scanId,
    operator_code: operator?.code || null,
    operator_name: operator?.name || null,
    station: station || null,
    area_id: String(area.id),
    area_code: area.code,
    side: side || null,
    slot: slot || null,
    level: level || null,
    barcode,
    product_code: catalog?.product_code || barcode,
    action: "pendente",
    quantity_delta: 0,
  };
  const ins = await supabase.from("stock_map_scans").insert(scanRow);
  if (ins.error?.code === "23505") return { duplicate: true, action: "ja_processado", error: null };
  // Se a tabela de bips não existe ainda, segue sem registro (o mapa continua funcionando).
  const logAvailable = !ins.error;
  if (ins.error && !isMissingTable(ins.error)) return { error: ins.error };

  // 2) aplica no mapa
  const { data: items, error: itemsError } = await fetchAreaItems(area.id);
  if (itemsError) {
    if (logAvailable) await supabase.from("stock_map_scans").delete().eq("id", scanId);
    return { error: itemsError };
  }
  const plan = planScan({ items, area, side, slot, level, barcode, catalog, mode, operator });

  let item = null;
  let error = null;
  if (plan.insert) {
    const res = await supabase.from("stock_map_items").insert(plan.insert).select().maybeSingle();
    item = res.data;
    error = res.error;
  } else {
    const res = await supabase.from("stock_map_items").update(plan.update).eq("id", plan.itemId).select().maybeSingle();
    item = res.data;
    error = res.error;
  }
  if (error) {
    if (logAvailable) await supabase.from("stock_map_scans").delete().eq("id", scanId);
    return { error };
  }

  // 3) fecha o registro do bip com o resultado + histórico do mapa (melhor esforço)
  if (logAvailable) {
    await supabase
      .from("stock_map_scans")
      .update({ action: plan.action, quantity_delta: plan.quantityDelta, item_id: String(item?.id ?? plan.itemId ?? "") })
      .eq("id", scanId);
  }
  if (plan.action === "adicionou") {
    logStockMapAction({
      areaId: area.id, areaCode: area.code, action: "item_add",
      afterData: { productCode: plan.insert.product_code, productName: plan.insert.product_name, side: plan.insert.side, slot: plan.insert.slot, via: "coleta" },
      actorCode: operator?.code, actorName: operator?.name,
    }).catch(() => {});
  }

  return { error: null, action: plan.action, item, scanId, itemId: item?.id ?? plan.itemId, quantityDelta: plan.quantityDelta };
}

// Desfaz o último bip (apaga o item criado ou tira a unidade somada).
export async function undoScan(result) {
  if (!result?.scanId) return { error: { message: "Nada para desfazer." } };
  let error = null;
  if (result.action === "adicionou" && result.itemId) {
    ({ error } = await supabase.from("stock_map_items").delete().eq("id", result.itemId));
  } else if (result.action === "contou" && result.itemId) {
    const { data: cur } = await supabase.from("stock_map_items").select("quantity").eq("id", result.itemId).maybeSingle();
    if (cur) ({ error } = await supabase.from("stock_map_items").update({ quantity: Math.max(0, (cur.quantity || 0) - 1) }).eq("id", result.itemId));
  }
  if (!error) await supabase.from("stock_map_scans").update({ undone: true }).eq("id", result.scanId);
  return { error };
}

export async function fetchRecentScans({ limit = 100 } = {}) {
  const { data, error } = await supabase.from("stock_map_scans").select("*").eq("undone", false).order("scanned_at", { ascending: false }).limit(limit);
  return { data: data || [], error };
}
