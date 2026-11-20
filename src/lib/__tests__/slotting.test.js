import { describe, it, expect } from "vitest";
import {
  findDispatchOrigin,
  distanceToOrigin,
  classifyABC,
  heatmapColor,
  computeSlottingAnalysis,
} from "../slotting";

const areas = [
  { id: "CONF", code: "M1", label: "Mesa de Conferência", area_type: "conferencia", x: 45, y: 85, width: 10, height: 10 },
  { id: "NEAR", code: "1V", label: "Prateleira 1V", area_type: "prateleira", x: 45, y: 70, width: 10, height: 10 },
  { id: "MID", code: "3V", label: "Prateleira 3V", area_type: "prateleira", x: 45, y: 40, width: 10, height: 10 },
  { id: "FAR", code: "6V", label: "Prateleira 6V", area_type: "prateleira", x: 5, y: 5, width: 10, height: 10 },
];

describe("slotting / mapa de calor e Curva ABC", () => {
  it("localiza a mesa de conferência como origem da expedição", () => {
    const origin = findDispatchOrigin(areas);
    expect(origin.inferred).toBe(false);
    expect(origin.x).toBe(50);
    expect(origin.y).toBe(90);
  });

  it("usa fallback central inferior quando não há área de conferência/expedição", () => {
    const origin = findDispatchOrigin(areas.filter((a) => a.area_type === "prateleira"));
    expect(origin.inferred).toBe(true);
    expect(origin.y).toBe(95);
  });

  it("calcula distância crescente entre prateleiras perto e longe da expedição", () => {
    const origin = findDispatchOrigin(areas);
    const dNear = distanceToOrigin(areas[1], origin);
    const dFar = distanceToOrigin(areas[3], origin);
    expect(dFar.distanceM).toBeGreaterThan(dNear.distanceM);
  });

  it("classifica Curva ABC por Pareto acumulado", () => {
    const map = classifyABC([
      { key: "p1", score: 80 },
      { key: "p2", score: 15 },
      { key: "p3", score: 4 },
      { key: "p4", score: 1 },
    ]);
    expect(map.get("p1")).toBe("A");
    expect(map.get("p2")).toBe("B");
    expect(map.get("p4")).toBe("C");
  });

  it("sugere mover item Curva A longe da expedição para área mais próxima", () => {
    const items = [
      { id: 1, area_id: "FAR", product_code: "HOT-01", product_name: "Joelho 25mm", quantity: 50 },
      { id: 2, area_id: "NEAR", product_code: "COLD-01", product_name: "Tampa 100mm", quantity: 2 },
      { id: 3, area_id: "MID", product_code: "MED-01", product_name: "Tê 50mm", quantity: 10 },
    ];
    const shortages = [
      { product_code: "HOT-01", quantity: 10 },
      { product_code: "HOT-01", quantity: 8 },
      { product_code: "HOT-01", quantity: 5 },
    ];
    const scans = [
      { area_id: "FAR", product_code: "HOT-01", quantity_delta: 4 },
      { area_id: "FAR", product_code: "HOT-01", quantity_delta: 3 },
      { area_id: "MID", product_code: "MED-01", quantity_delta: 1 },
    ];

    const res = computeSlottingAnalysis({ areas, items, shortages, scans });
    expect(res.itemMetrics["1"].abc).toBe("A");
    expect(res.areaMetrics["FAR"].needsSlottingAttention).toBe(true);
    expect(res.suggestions.length).toBeGreaterThan(0);
    expect(res.suggestions[0].productCode).toBe("HOT-01");
    expect(res.suggestions[0].fromArea.code).toBe("6V");
    expect(res.suggestions[0].toArea.code).toBe("1V");
    expect(res.suggestions[0].savedPct).toBeGreaterThan(50);
  });

  it("retorna cores térmicas válidas para 0..1", () => {
    expect(heatmapColor(0)).toBe("#334155");
    expect(heatmapColor(0.2)).toBe("#2563eb");
    expect(heatmapColor(0.95)).toBe("#ef4444");
  });
});
