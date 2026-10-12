import { describe, it, expect } from "vitest";
import { badgePayload, parseBadge } from "../badge";

describe("crachá", () => {
  it("gera e lê o mesmo código", () => {
    expect(parseBadge(badgePayload("101"))).toBe("101");
  });
  it("aceita só os dígitos (leitor de código de barras)", () => {
    expect(parseBadge("205\n")).toBe("205");
  });
  it("rejeita lixo e códigos de tamanho errado", () => {
    expect(parseBadge("https://exemplo.com")).toBeNull();
    expect(parseBadge("APONTA:12")).toBeNull();
    expect(parseBadge("1234")).toBeNull();
    expect(parseBadge(null)).toBeNull();
  });
});
