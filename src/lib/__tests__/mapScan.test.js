import { describe, it, expect, beforeEach, vi } from "vitest";

// Banco de mentira em memória (só o que o mapScan usa)
const state = { db: {}, seq: 0, missingScans: false };
function resetDb() {
  state.db = { stock_map_scans: [], stock_map_items: [], product_barcodes: [], stock_map_history: [] };
  state.seq = 0;
  state.missingScans = false;
}

function from(table) {
  let op = "select";
  let payload = null;
  const filters = [];
  const api = {
    insert(p) { op = "insert"; payload = p; return api; },
    update(p) { op = "update"; payload = p; return api; },
    upsert(p) { op = "upsert"; payload = p; return api; },
    delete() { op = "delete"; return api; },
    select() { return api; },
    eq(col, val) { filters.push((r) => String(r[col]) === String(val)); return api; },
    order() { return api; },
    limit() { return api; },
    maybeSingle() { return run(true); },
    then(res, rej) { return run(false).then(res, rej); },
  };
  async function run(single) {
    if (table === "stock_map_scans" && state.missingScans) return { data: null, error: { code: "42P01", message: "relation does not exist" } };
    const rows = state.db[table];
    if (op === "insert" || op === "upsert") {
      if (table === "stock_map_scans" && rows.some((r) => r.id === payload.id)) return { data: null, error: { code: "23505", message: "duplicate" } };
      const row = { id: payload.id || `i${++state.seq}`, ...payload };
      if (op === "upsert") {
        const i = rows.findIndex((r) => r.barcode === payload.barcode);
        if (i >= 0) rows[i] = { ...rows[i], ...payload }; else rows.push(row);
      } else rows.push(row);
      return { data: single ? row : [row], error: null };
    }
    const matched = rows.filter((r) => filters.every((f) => f(r)));
    if (op === "update") { matched.forEach((r) => Object.assign(r, payload)); return { data: single ? matched[0] || null : matched, error: null }; }
    if (op === "delete") { matched.forEach((r) => rows.splice(rows.indexOf(r), 1)); return { data: null, error: null }; }
    return { data: single ? matched[0] || null : matched, error: null };
  }
  return api;
}
vi.mock("../../supabaseClient", () => ({ supabase: { from: (t) => from(t) } }));

import { recordScan, undoScan, saveCatalogEntry, lookupCatalog, loadCatalog } from "../mapScan";

const area = { id: "A1", code: "R1D", has_sides: true };
const operator = { code: "101", name: "Ana" };
const args = (over = {}) => ({
  scanId: "scan-1", area, side: "par", slot: "03", level: "2",
  barcode: "7891000100103", catalog: { product_code: "T25", product_name: "Joelho 25" },
  mode: "registrar", operator, station: "Tablet 1", ...over,
});

beforeEach(() => { resetDb(); localStorage.clear(); });

describe("recordScan", () => {
  it("adiciona o produto no endereço e registra o bip", async () => {
    const r = await recordScan(args());
    expect(r.error).toBeNull();
    expect(r.action).toBe("adicionou");
    expect(state.db.stock_map_items).toHaveLength(1);
    expect(state.db.stock_map_items[0]).toMatchObject({ product_code: "T25", side: "par", slot: "03", level: "2", source: "coleta" });
    expect(state.db.stock_map_scans[0]).toMatchObject({ id: "scan-1", action: "adicionou", operator_code: "101" });
  });

  it("REENVIAR o mesmo bip (fila offline) não soma nem duplica", async () => {
    await recordScan(args({ mode: "contar" }));
    const again = await recordScan(args({ mode: "contar" })); // mesmo scanId
    expect(again.duplicate).toBe(true);
    expect(state.db.stock_map_items).toHaveLength(1);
    expect(state.db.stock_map_items[0].quantity).toBe(1);
  });

  it("bips diferentes do mesmo produto, no modo contar, somam", async () => {
    await recordScan(args({ scanId: "s1", mode: "contar" }));
    await recordScan(args({ scanId: "s2", mode: "contar" }));
    await recordScan(args({ scanId: "s3", mode: "contar" }));
    expect(state.db.stock_map_items).toHaveLength(1);
    expect(state.db.stock_map_items[0].quantity).toBe(3);
  });

  it("modo registrar: bipar de novo não duplica nem muda a quantidade", async () => {
    await recordScan(args({ scanId: "s1" }));
    const r = await recordScan(args({ scanId: "s2" }));
    expect(r.action).toBe("ja_existia");
    expect(state.db.stock_map_items).toHaveLength(1);
    expect(state.db.stock_map_items[0].quantity).toBe(0);
  });

  it("segue funcionando se a tabela de bips ainda não existe (migração pendente)", async () => {
    state.missingScans = true;
    const r = await recordScan(args());
    expect(r.error).toBeNull();
    expect(state.db.stock_map_items).toHaveLength(1);
  });
});

describe("undoScan", () => {
  it("desfaz um item adicionado", async () => {
    const r = await recordScan(args());
    expect((await undoScan(r)).error).toBeNull();
    expect(state.db.stock_map_items).toHaveLength(0);
    expect(state.db.stock_map_scans[0].undone).toBe(true);
  });
  it("desfaz uma unidade contada", async () => {
    await recordScan(args({ scanId: "s1", mode: "contar" }));
    const r2 = await recordScan(args({ scanId: "s2", mode: "contar" }));
    await undoScan(r2);
    expect(state.db.stock_map_items[0].quantity).toBe(1);
  });
});

describe("catálogo", () => {
  it("salvar já vale localmente (funciona offline) e depois encontra pelo código de barras", async () => {
    const { entry, error } = await saveCatalogEntry({ barcode: "abc123", productCode: "X1", productName: "Teste", category: "Tubos", createdBy: "101" });
    expect(error).toBeNull();
    expect(entry.barcode).toBe("ABC123");
    expect(lookupCatalog("abc123")).toMatchObject({ product_code: "X1", product_name: "Teste" });
  });
  it("carrega do servidor e guarda uma cópia no aparelho", async () => {
    state.db.product_barcodes.push({ barcode: "999", product_code: "P9", product_name: "Nove" });
    const { count } = await loadCatalog();
    expect(count).toBe(1);
    expect(JSON.parse(localStorage.getItem("aponta_barcode_catalog_v1"))[0].product_code).toBe("P9");
  });
});
