import { supabase } from "../supabaseClient";

// ============================================================
// Mapa do estoque — helpers
// ============================================================

export const AREA_TYPES = [
  { value: "rua", label: "Rua", color: "#4a7ba7" },
  { value: "corredor", label: "Corredor", color: "#8b5cf6" },
  { value: "doca", label: "Doca", color: "#10b981" },
  { value: "recebimento", label: "Recebimento", color: "#f59e0b" },
  { value: "expedicao", label: "Expedição", color: "#ef4444" },
  { value: "pulmao", label: "Pulmão", color: "#06b6d4" },
  { value: "escritorio", label: "Escritório", color: "#6b7280" },
  { value: "outro", label: "Outro", color: "#1e3a5f" },
];

export function colorForType(type) {
  return AREA_TYPES.find((t) => t.value === type)?.color || "#1e3a5f";
}

// ---------- Áreas ----------

export async function fetchMapAreas() {
  const { data, error } = await supabase
    .from("stock_map_areas")
    .select("*")
    .order("code");
  return { data: data || [], error };
}

export async function addMapArea({ code, label, areaType, x, y, width, height, color, meta }) {
  return supabase
    .from("stock_map_areas")
    .insert({
      code: code.trim().toUpperCase(),
      label: label.trim(),
      area_type: areaType,
      x, y, width, height,
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
  let query = supabase.from("stock_map_items").select("*").order("product_code");
  if (areaId) query = query.eq("area_id", areaId);
  const { data, error } = await query;
  return { data: data || [], error };
}

export async function addMapItem({ areaId, productCode, productName, quantity, slot, note }) {
  return supabase
    .from("stock_map_items")
    .insert({
      area_id: areaId,
      product_code: productCode.trim(),
      product_name: productName?.trim() || null,
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

// ---------- Helpers de UI ----------

export function labelForType(type) {
  return AREA_TYPES.find((t) => t.value === type)?.label || type;
}

export function summarizeArea(area, items) {
  const list = items.filter((i) => i.area_id === area.id);
  const totalQty = list.reduce((sum, i) => sum + (i.quantity || 0), 0);
  return {
    skus: list.length,
    totalQty,
  };
}