// ============================================================
// Decisão pura: o que fazer com um bip, dado o que já existe no mapa.
// (sem banco; testada em __tests__/mapScanPlan.test.js)
// ============================================================

const norm = (v) => (v === null || v === undefined ? "" : String(v).trim().toUpperCase());

// Procura, no mesmo endereço (área + lado + posição + nível), o mesmo produto.
export function findExistingItem(items, { areaId, side, slot, level, barcode, productCode }) {
  return (
    items.find(
      (it) =>
        String(it.area_id) === String(areaId) &&
        norm(it.side) === norm(side) &&
        norm(it.slot) === norm(slot) &&
        norm(it.level) === norm(level) &&
        ((barcode && norm(it.barcode) === norm(barcode)) ||
          (productCode && norm(it.product_code) === norm(productCode)) ||
          (barcode && norm(it.product_code) === norm(barcode)))
    ) || null
  );
}

// mode: "registrar" (o bip só diz "este produto mora aqui")
//       "contar"    (cada bip soma 1 unidade)
export function planScan({ items, area, side, slot, level, barcode, catalog, mode = "registrar", operator, now = new Date() }) {
  const productCode = catalog?.product_code || barcode;
  const existing = findExistingItem(items, { areaId: area.id, side, slot, level, barcode, productCode });
  const stamp = { counted_at: now.toISOString(), counted_by: operator?.code || null };

  if (existing) {
    if (mode === "contar") {
      return {
        action: "contou",
        quantityDelta: 1,
        itemId: existing.id,
        update: { quantity: (Number(existing.quantity) || 0) + 1, barcode: existing.barcode || barcode, ...stamp },
      };
    }
    return { action: "ja_existia", quantityDelta: 0, itemId: existing.id, update: { barcode: existing.barcode || barcode, ...stamp } };
  }

  return {
    action: "adicionou",
    quantityDelta: mode === "contar" ? 1 : 0,
    insert: {
      area_id: area.id,
      side: area.has_sides ? side || null : null,
      slot: slot || null,
      level: level || null,
      barcode,
      product_code: productCode,
      product_name: catalog?.product_name || null,
      category: catalog?.category || null,
      quantity: mode === "contar" ? 1 : 0,
      source: "coleta",
      ...stamp,
    },
  };
}

// Produtos que entraram só com o código de barras (sem nome): lista para o admin completar.
export function itemsWithoutName(items) {
  return items.filter((it) => it.source === "coleta" && !it.product_name);
}
