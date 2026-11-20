import { describe, it, expect, vi } from "vitest";

vi.mock("../../supabaseClient", () => ({ supabase: {} }));

import {
  resolveAddressForProduct,
  resolveAddressFromText,
  buildCyclicTaskFromShortage,
  buildCyclicTaskFromConference,
  buildCyclicTaskFromInconsistency,
  evaluateBlindCount,
} from "../cyclicInventory";

const areas = [
  { id: "A1", code: "1V", label: "Prateleira 1V", area_type: "prateleira" },
  { id: "A2", code: "2V", label: "Prateleira 2V", area_type: "prateleira" },
];

const items = [
  { id: 10, area_id: "A1", side: "par", slot: "04", level: "2", product_code: "JOE25", product_name: "Joelho 25mm", quantity: 12 },
  { id: 11, area_id: "A2", side: "impar", slot: "01", level: "1", product_code: "TUB50", product_name: "Tubo 50mm", quantity: 5 },
];

describe("cyclicInventory — gatilhos de contagem cega", () => {
  it("resolve endereço exato a partir do código do produto", () => {
    const addr = resolveAddressForProduct("joe25", areas, items);
    expect(addr).toMatchObject({
      area_id: "A1",
      area_code: "1V",
      side: "par",
      slot: "04",
      level: "2",
      expected_quantity: 12,
    });
  });

  it("extrai área ou produto a partir de texto livre (inconsistência/conferência)", () => {
    const byProd = resolveAddressFromText("Faltou item TUB50 na caixa", areas, items);
    expect(byProd.area_code).toBe("2V");
    expect(byProd.product_code).toBe("TUB50");

    const byArea = resolveAddressFromText("Rua 1V com palete fora do lugar", areas, items);
    expect(byArea.area_code).toBe("1V");
    expect(byArea.expected_quantity).toBe(12);
  });

  it("gera tarefa de contagem cega a partir de falta", () => {
    const task = buildCyclicTaskFromShortage({
      shortage: { id: 99, product_code: "JOE25", quantity: 3 },
      entry: { id: "e1", order_number: "4500" },
      areas,
      items,
    });
    expect(task.trigger_source).toBe("falta");
    expect(task.trigger_ref_id).toBe("shortage:99");
    expect(task.area_code).toBe("1V");
    expect(task.blind_mode).toBe(true);
    expect(task.expected_quantity).toBe(12);
    expect(task.reason).toContain("#4500");
  });

  it("gera tarefa de contagem cega a partir de divergência na conferência", () => {
    const task = buildCyclicTaskFromConference({
      conferenceItem: { id: 77, order_number: "8810" },
      reason: "Falta produto",
      note: "Faltou JOE25",
      areas,
      items,
    });
    expect(task.trigger_source).toBe("conferencia");
    expect(task.area_code).toBe("1V");
    expect(task.product_code).toBe("JOE25");
  });

  it("gera tarefa de contagem cega a partir de inconsistência", () => {
    const task = buildCyclicTaskFromInconsistency({
      inconsistency: { id: 15, location: "Rua 2V", description: "Divergência de saldo" },
      areas,
      items,
    });
    expect(task.trigger_source).toBe("inconsistencia");
    expect(task.area_code).toBe("2V");
  });

  it("avalia resultado da contagem cega corretamente (ok, falta, sobra)", () => {
    expect(evaluateBlindCount({ expectedQty: 10, countedQty: 10 })).toMatchObject({ status: "ok", divergence: 0 });
    expect(evaluateBlindCount({ expectedQty: 10, countedQty: 7 })).toMatchObject({ status: "falta", divergence: -3 });
    expect(evaluateBlindCount({ expectedQty: 10, countedQty: 13 })).toMatchObject({ status: "sobra", divergence: 3 });
    expect(evaluateBlindCount({ expectedQty: null, countedQty: 5 })).toMatchObject({ status: "sem_referencia", divergence: null });
  });
});
