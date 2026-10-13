import { describe, it, expect } from "vitest";
import { isValidGtin, normalizeScan, parseAddressLabel, addressLabelPayload, classifyScan } from "../barcode";

describe("isValidGtin", () => {
  it("aceita EAN-13, EAN-8 e UPC-A com dígito verificador correto", () => {
    expect(isValidGtin("7891000100103")).toBe(true);
    expect(isValidGtin("7891910000197")).toBe(true);
    expect(isValidGtin("4012345678901")).toBe(true);
    expect(isValidGtin("96385074")).toBe(true);
    expect(isValidGtin("400638133390")).toBe(true);
  });
  it("recusa dígito errado (leitura ruim da câmera) e tamanhos inválidos", () => {
    expect(isValidGtin("7891000100104")).toBe(false);
    expect(isValidGtin("96385075")).toBe(false);
    expect(isValidGtin("12345")).toBe(false);
    expect(isValidGtin("78910001A0103")).toBe(false);
  });
});

describe("normalizeScan", () => {
  it("tira quebra de linha, espaços e caracteres de controle do leitor", () => {
    expect(normalizeScan("  7891000100103\r\n")).toBe("7891000100103");
    expect(normalizeScan("AB\x1dCD")).toBe("ABCD");
    expect(normalizeScan(null)).toBe("");
  });
});

describe("etiqueta de endereço", () => {
  it("gera e lê o mesmo endereço", () => {
    const text = addressLabelPayload({ areaCode: "r1d", side: "par", slot: "03", level: "2" });
    expect(text).toBe("END:R1D|PAR|03|2");
    expect(parseAddressLabel(text)).toEqual({ areaCode: "R1D", side: "par", slot: "03", level: "2" });
  });
  it("lado ímpar, sem lado e campos vazios", () => {
    expect(parseAddressLabel("END:R2|IMPAR||")).toEqual({ areaCode: "R2", side: "impar", slot: "", level: "" });
    expect(parseAddressLabel("END:R2|||")).toMatchObject({ side: null });
    expect(parseAddressLabel("END:R3")).toMatchObject({ areaCode: "R3", slot: "" });
  });
  it("rejeita o que não é etiqueta de endereço", () => {
    expect(parseAddressLabel("7891000100103")).toBeNull();
    expect(parseAddressLabel("END:")).toBeNull();
  });
});

describe("classifyScan", () => {
  it("separa produto, endereço, crachá e vazio", () => {
    expect(classifyScan("")).toEqual({ kind: "empty" });
    expect(classifyScan("END:R1D|PAR|1|1").kind).toBe("address");
    expect(classifyScan("APONTA:101")).toEqual({ kind: "badge", code: "101" });
    expect(classifyScan("7891000100103")).toMatchObject({ kind: "product", barcode: "7891000100103", isGtin: true, suspicious: false });
  });
  it("marca como suspeito um GTIN com dígito errado, mas aceita código interno", () => {
    expect(classifyScan("7891000100104")).toMatchObject({ kind: "product", suspicious: true });
    expect(classifyScan("tub-25-br")).toMatchObject({ kind: "product", barcode: "TUB-25-BR", suspicious: false, isGtin: false });
  });
});
