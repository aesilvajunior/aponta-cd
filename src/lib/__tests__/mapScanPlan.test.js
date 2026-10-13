import { describe, it, expect } from "vitest";
import { planScan, findExistingItem, itemsWithoutName } from "../mapScanPlan";

const area = { id: "A1", code: "R1D", has_sides: true };
const operator = { code: "101", name: "Ana" };
const now = new Date("2026-10-12T15:00:00Z");
const base = { area, side: "par", slot: "03", level: "2", barcode: "7891000100103", operator, now };

describe("planScan", () => {
  it("produto novo no endereço: adiciona sem quantidade (modo registrar)", () => {
    const p = planScan({ ...base, items: [], catalog: { product_code: "T25", product_name: "Joelho 25", category: "Conexões" } });
    expect(p.action).toBe("adicionou");
    expect(p.quantityDelta).toBe(0);
    expect(p.insert).toMatchObject({
      area_id: "A1", side: "par", slot: "03", level: "2", barcode: "7891000100103",
      product_code: "T25", product_name: "Joelho 25", quantity: 0, source: "coleta", counted_by: "101",
    });
  });

  it("sem catálogo, usa o próprio código de barras como código do produto", () => {
    const p = planScan({ ...base, items: [], catalog: null });
    expect(p.insert.product_code).toBe("7891000100103");
    expect(p.insert.product_name).toBeNull();
  });

  it("mesmo produto no mesmo endereço: não duplica (registrar) e só atualiza a data", () => {
    const items = [{ id: 9, area_id: "A1", side: "par", slot: "03", level: "2", product_code: "T25", barcode: "7891000100103", quantity: 5 }];
    const p = planScan({ ...base, items, catalog: { product_code: "T25" } });
    expect(p.action).toBe("ja_existia");
    expect(p.insert).toBeUndefined();
    expect(p.update.counted_at).toBe(now.toISOString());
    expect(p.update.quantity).toBeUndefined(); // não mexe na quantidade
  });

  it("modo contar soma 1 a cada bip", () => {
    const items = [{ id: 9, area_id: "A1", side: "par", slot: "03", level: "2", product_code: "T25", barcode: "7891000100103", quantity: 5 }];
    const p = planScan({ ...base, items, catalog: { product_code: "T25" }, mode: "contar" });
    expect(p).toMatchObject({ action: "contou", quantityDelta: 1, itemId: 9 });
    expect(p.update.quantity).toBe(6);
  });

  it("modo contar com produto novo já nasce com 1 unidade", () => {
    const p = planScan({ ...base, items: [], catalog: null, mode: "contar" });
    expect(p.insert.quantity).toBe(1);
    expect(p.quantityDelta).toBe(1);
  });

  it("endereço diferente (outro nível, lado ou posição) é outro item", () => {
    const items = [{ id: 9, area_id: "A1", side: "par", slot: "03", level: "2", product_code: "T25", barcode: "7891000100103" }];
    expect(planScan({ ...base, level: "3", items, catalog: { product_code: "T25" } }).action).toBe("adicionou");
    expect(planScan({ ...base, side: "impar", items, catalog: { product_code: "T25" } }).action).toBe("adicionou");
    expect(planScan({ ...base, slot: "04", items, catalog: { product_code: "T25" } }).action).toBe("adicionou");
  });

  it("área sem lados ignora o lado informado", () => {
    const p = planScan({ ...base, area: { id: "B", code: "RC", has_sides: false }, items: [], catalog: null });
    expect(p.insert.side).toBeNull();
  });
});

describe("findExistingItem / itemsWithoutName", () => {
  it("compara sem diferenciar maiúsculas e espaços", () => {
    const items = [{ id: 1, area_id: 1, side: "par", slot: " 03 ", level: "2", product_code: "abc" }];
    expect(findExistingItem(items, { areaId: "1", side: "PAR", slot: "03", level: "2", productCode: "ABC" })?.id).toBe(1);
  });
  it("lista os itens que entraram só com código de barras", () => {
    const items = [
      { id: 1, source: "coleta", product_name: null },
      { id: 2, source: "coleta", product_name: "Joelho" },
      { id: 3, source: "manual", product_name: null },
    ];
    expect(itemsWithoutName(items).map((i) => i.id)).toEqual([1]);
  });
});
