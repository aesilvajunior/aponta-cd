import { describe, it, expect, vi } from "vitest";
import * as XLSX from "xlsx";

vi.mock("../../supabaseClient", () => ({ supabase: {} }));

import {
  DEFAULT_PROFILES,
  suggestColumnMapping,
  autoDetectProfile,
  analyzeImportDivergences,
} from "../importProfiles";
import { parseSpreadsheetBuffer } from "../../utils/excel";

describe("importProfiles + excel parsing", () => {
  it("lê planilha Excel com linhas de título do ERP acima do cabeçalho", () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ["RELATÓRIO ERP — POSIÇÃO DE ESTOQUE"],
      [],
      ["AREA", "CODIGO", "DESCRICAO", "SALDO"],
      ["1V", "JOE25", "Joelho 25mm", "40"],
      ["2V", "TUB50", "Tubo 50mm", "15"],
    ]);
    XLSX.utils.book_append_sheet(wb, ws, "Estoque");
    const arr = XLSX.write(wb, { type: "array", bookType: "xlsx" });

    const parsed = parseSpreadsheetBuffer(arr);
    expect(parsed.sheetNames).toEqual(["Estoque"]);
    expect(parsed.headers).toEqual(["AREA", "CODIGO", "DESCRICAO", "SALDO"]);
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0]).toMatchObject({ AREA: "1V", CODIGO: "JOE25", SALDO: "40" });
  });

  it("sugere mapeamento automático de colunas em português/ERP", () => {
    const map = suggestColumnMapping(["Rua", "Cód. Produto", "Descrição", "Qtde Saldo", "Lado"], "stock_map_items");
    expect(map.area_code).toBe("Rua");
    expect(map.product_code).toBe("Cód. Produto");
    expect(map.product_name).toBe("Descrição");
    expect(map.quantity).toBe("Qtde Saldo");
    expect(map.side).toBe("Lado");
  });

  it("detecta automaticamente perfil salvo compatível para importação em 1 clique", () => {
    const match = autoDetectProfile(
      ["AREA", "CODIGO", "DESCRICAO", "SALDO", "CATEGORIA", "LADO", "POSICAO"],
      DEFAULT_PROFILES
    );
    expect(match).not.toBeNull();
    expect(match.profile.id).toBe("preset-erp-estoque");
    expect(match.score).toBeGreaterThanOrEqual(0.6);
  });

  it("gera resumo automático de divergências antes de gravar no mapa do estoque", () => {
    const rows = [
      { AREA: "1V", CODIGO: "JOE25", DESCRICAO: "Joelho 25mm", SALDO: "45" }, // diverge (CD tem 30)
      { AREA: "1V", CODIGO: "NOVO1", DESCRICAO: "Registro 20mm", SALDO: "10" }, // novo
      { AREA: "9Z", CODIGO: "ERR1", DESCRICAO: "Área inexistente", SALDO: "5" }, // erro: área desconhecida
      { AREA: "1V", CODIGO: "NOVO1", DESCRICAO: "Duplicado", SALDO: "10" }, // aviso: duplicado
    ];
    const analysis = analyzeImportDivergences({
      rows,
      mapping: { area_code: "AREA", product_code: "CODIGO", product_name: "DESCRICAO", quantity: "SALDO" },
      targetType: "stock_map_items",
      existingAreas: [{ id: "A1", code: "1V" }],
      existingItems: [{ id: 1, area_id: "A1", product_code: "JOE25", product_name: "Joelho 25mm", quantity: 30 }],
    });

    expect(analysis.summary.newCount).toBe(1);
    expect(analysis.summary.updateCount).toBe(1);
    expect(analysis.summary.errorCount).toBe(1);
    expect(analysis.summary.warningCount).toBe(2); // 1 divergência de saldo + 1 duplicado
    expect(analysis.summary.netQtyDelta).toBe(25); // +15 do JOE25 + 10 do NOVO1
    expect(analysis.divergences.some((d) => d.type === "quantity_divergence" && d.diff === 15)).toBe(true);
    expect(analysis.divergences.some((d) => d.type === "unknown_area")).toBe(true);
  });

  it("analisa divergências no cruzamento de pedidos ERP × Aponta CD", () => {
    const analysis = analyzeImportDivergences({
      rows: [
        { PEDIDO: "1001", CLIENTE: "Construtora A" },
        { PEDIDO: "1002", CLIENTE: "Obra B" },
      ],
      mapping: { order_number: "PEDIDO", customer_name: "CLIENTE" },
      targetType: "orders_crosscheck",
      existingEntries: [{ order_number: "1001" }, { order_number: "9999" }],
    });

    expect(analysis.summary.unchangedCount).toBe(1); // 1001 bateu
    expect(analysis.summary.newCount).toBe(1); // 1002 só na planilha
    expect(analysis.summary.onlyInCdCount).toBe(1); // 9999 só no CD
  });
});
