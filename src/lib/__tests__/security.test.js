import { describe, it, expect } from "vitest";
import { sanitizeCsvCell } from "../../utils/csv";
import { csvEscape } from "../../components/panel/panelHelpers";
import { toCsv } from "../../../supabase/functions/_shared/reportLogic";

describe("Segurança — proteção contra CSV Formula Injection", () => {
  it("neutraliza células que começam com =, +, -, @, tab ou CR", () => {
    expect(sanitizeCsvCell("=CMD|' /C calc'!A0")).toBe("'=CMD|' /C calc'!A0");
    expect(sanitizeCsvCell("+2+3")).toBe("'+2+3");
    expect(sanitizeCsvCell("-SUM(A1:A5)")).toBe("'-SUM(A1:A5)");
    expect(sanitizeCsvCell("@SUM(1+1)")).toBe("'@SUM(1+1)");
    expect(csvEscape("=HYPERLINK(\"http://evil\")")).toContain("'=HYPERLINK");
  });

  it("preserva números negativos puros e texto comum sem alterar", () => {
    expect(sanitizeCsvCell("-15")).toBe("-15");
    expect(sanitizeCsvCell("-12,50")).toBe("-12,50");
    expect(sanitizeCsvCell("Joelho 25mm")).toBe("Joelho 25mm");
    expect(csvEscape("Cliente Normal")).toBe("Cliente Normal");
  });

  it("toCsv neutraliza fórmulas nos relatórios agendados", () => {
    const csv = toCsv([{ obs: "=1+1", cliente: "Normal" }]);
    expect(csv).toContain("'=1+1;Normal");
  });
});
