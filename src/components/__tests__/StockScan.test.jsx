import { describe, it, expect, vi } from "vitest";
import { renderToString } from "react-dom/server";
import React from "react";

vi.mock("../../supabaseClient", () => ({ supabase: {} }));
vi.mock("../../lib/stockMap", () => ({
  fetchMapAreas: async () => ({ data: [] }),
  DEFAULT_CATEGORIES: ["Tubos"],
  SIDES: [{ value: "par", short: "PAR" }, { value: "impar", short: "ÍMPAR" }],
}));
vi.mock("../../lib/mapScan", () => ({
  loadCatalog: async () => ({ count: 0 }),
  lookupCatalog: () => null,
  undoScan: async () => ({}),
}));
vi.mock("../../lib/offlineSync", () => ({
  recordScanSafe: async () => ({}),
  saveCatalogEntrySafe: async () => ({}),
  removeByEntryId: () => 0,
}));

import StockScan from "../StockScan";
import StockMap3D from "../StockMap3D";

describe("StockScan", () => {
  it("sem operador identificado pede o código antes de bipar", () => {
    const html = renderToString(<StockScan operators={[{ code: "101", name: "Ana" }]} currentOperator={null} />);
    expect(html).toContain("Quem está bipando?");
  });

  it("com operador mostra endereço, modos e campo de leitura", () => {
    const html = renderToString(<StockScan operators={[]} currentOperator={{ code: "101", name: "Ana" }} />).replace(/<!-- -->/g, "");
    expect(html).toContain("Coleta de endereços");
    expect(html).toContain("1. Endereço");
    expect(html).toContain("2. Bipar produtos");
    expect(html).toContain("Registrar endereço");
    expect(html).toContain("Contar (+1 por bip)");
    expect(html).toContain("Campo de leitura");
    expect(html).toContain("Operador: <strong>Ana</strong>");
  });
});

describe("StockMap3D", () => {
  it("sem WebGL avisa e não quebra (cai para o mapa 2D)", () => {
    // jsdom não tem WebGL: simula um navegador sem suporte, sem encher o log de avisos
    HTMLCanvasElement.prototype.getContext = () => null;
    const html = renderToString(<StockMap3D isAdmin={false} />);
    expect(html).toContain("Mapa 3D");
    expect(html).toContain("não suporta gráficos 3D");
  });
});
