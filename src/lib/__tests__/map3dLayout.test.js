import { describe, it, expect } from "vitest";
import {
  DEFAULT_3D_CONFIG as cfg, floorIndex, areaToMeters, rackGeometry, layoutItems, matchItems,
  exportForBlender, categoryColor, mergeConfig,
} from "../map3dLayout";

describe("floorIndex", () => {
  it("entende térreo, números e nomes comuns", () => {
    expect(floorIndex("terreo")).toBe(0);
    expect(floorIndex("Térreo")).toBe(0);
    expect(floorIndex("1")).toBe(1);
    expect(floorIndex("2º andar")).toBe(2);
    expect(floorIndex("super estoque")).toBe(1);
    expect(floorIndex(null)).toBe(0);
    expect(floorIndex("qualquer coisa")).toBe(0);
  });
});

describe("areaToMeters", () => {
  it("converte % do mapa 2D para metros com origem no centro do galpão", () => {
    const m = areaToMeters({ x: 0, y: 0, width: 10, height: 10, floor: "terreo" });
    expect(m.w).toBeCloseTo(6); // 10% de 60 m
    expect(m.d).toBeCloseTo(4.5); // 10% de 45 m
    expect(m.x).toBeCloseTo(-30 + 3); // canto esquerdo + metade da largura
    expect(m.z).toBeCloseTo(-22.5 + 2.25);
    expect(m.y).toBe(0);
  });
  it("andar de cima sobe a altura do andar", () => {
    expect(areaToMeters({ x: 0, y: 0, width: 5, height: 5, floor: "1" }).y).toBe(cfg.floorHeightM);
  });
  it("área centralizada fica no meio (0,0)", () => {
    const m = areaToMeters({ x: 45, y: 45, width: 10, height: 10, floor: "terreo" });
    expect(m.x).toBeCloseTo(0);
    expect(m.z).toBeCloseTo(0);
  });
});

describe("rackGeometry", () => {
  it("o comprimento é o lado maior e os vãos seguem o tamanho do vão", () => {
    const g = rackGeometry({ x: 0, y: 0, width: 20, height: 4, floor: "terreo" });
    expect(g.alongX).toBe(true);
    expect(g.length).toBeCloseTo(12);
    expect(g.bays).toBe(10);
    const v = rackGeometry({ x: 0, y: 0, width: 4, height: 20, floor: "terreo" });
    expect(v.alongX).toBe(false);
  });
});

describe("layoutItems", () => {
  const area = { id: 1, x: 10, y: 10, width: 20, height: 6, floor: "terreo", has_sides: true };
  const g = rackGeometry(area);
  const items = [
    { id: 1, side: "par", slot: "1", level: "1", quantity: 10, product_code: "A" },
    { id: 2, side: "impar", slot: "1", level: "1", quantity: 10, product_code: "B" },
    { id: 3, side: "par", slot: "5", level: "3", quantity: 4, product_code: "C" },
    { id: 4, side: "par", slot: null, level: null, quantity: 1, product_code: "D" },
  ];
  const placed = layoutItems(area, items);

  it("posiciona todos os itens dentro da estante", () => {
    expect(placed).toHaveLength(4);
    placed.forEach(({ position }) => {
      expect(position[0]).toBeGreaterThanOrEqual(g.x - g.w / 2 - 0.01);
      expect(position[0]).toBeLessThanOrEqual(g.x + g.w / 2 + 0.01);
      expect(position[2]).toBeGreaterThanOrEqual(g.z - g.d / 2 - 0.01);
      expect(position[2]).toBeLessThanOrEqual(g.z + g.d / 2 + 0.01);
    });
  });
  it("par e ímpar ficam em lados opostos da estante", () => {
    const par = placed.find((p) => p.item.id === 1);
    const impar = placed.find((p) => p.item.id === 2);
    expect(par.position[2]).toBeGreaterThan(g.z);
    expect(impar.position[2]).toBeLessThan(g.z);
  });
  it("nível mais alto fica mais alto; sem nível vai para o primeiro", () => {
    const n3 = placed.find((p) => p.item.id === 3);
    const n1 = placed.find((p) => p.item.id === 1);
    const semNivel = placed.find((p) => p.item.id === 4);
    expect(n3.position[1]).toBeGreaterThan(n1.position[1]);
    expect(semNivel.level).toBe(1);
  });
  it("a posição (slot) mais alta fica mais adiante ao longo da estante", () => {
    const s1 = placed.find((p) => p.item.id === 1);
    const s5 = placed.find((p) => p.item.id === 3);
    expect(s5.position[0]).toBeGreaterThan(s1.position[0]);
  });
  it("andar de cima eleva os produtos", () => {
    const up = layoutItems({ ...area, floor: "1" }, items)[0];
    expect(up.position[1]).toBeGreaterThan(cfg.floorHeightM);
  });
  it("estante sem itens devolve lista vazia", () => {
    expect(layoutItems(area, [])).toEqual([]);
  });
});

describe("busca, cor e exportação", () => {
  const items = [
    { product_code: "T25", product_name: "Joelho 25mm", barcode: "7891000100103" },
    { product_code: "T32", product_name: "Luva 32mm", barcode: null },
  ];
  it("busca por código, nome ou código de barras", () => {
    expect(matchItems(items, "joelho")).toHaveLength(1);
    expect(matchItems(items, "t3")).toHaveLength(1);
    expect(matchItems(items, "7891000")).toHaveLength(1);
    expect(matchItems(items, "")).toEqual([]);
  });
  it("cor estável por categoria", () => {
    expect(categoryColor("Tubos")).toEqual(categoryColor("Tubos"));
    expect(categoryColor("Tubos").h).not.toBe(categoryColor("Conexões").h);
  });
  it("exporta áreas em metros para o Blender", () => {
    const out = exportForBlender([{ code: "R1D", label: "Rua 1D", area_type: "prateleira", x: 0, y: 0, width: 10, height: 10, floor: "terreo", has_sides: true }]);
    expect(out.unidade).toBe("metros");
    expect(out.areas[0]).toMatchObject({ codigo: "R1D", larguraX: 6, profundidadeZ: 4.5, andar: 0, temLados: true });
  });
  it("mergeConfig completa o que faltar", () => {
    expect(mergeConfig({ widthM: 80 }).depthM).toBe(cfg.depthM);
    expect(mergeConfig({ shell: { scale: 2 } }).shell.url).toBe(cfg.shell.url);
  });
});
