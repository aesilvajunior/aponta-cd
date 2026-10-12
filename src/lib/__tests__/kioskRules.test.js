import { describe, it, expect } from "vitest";
import { shouldAskShortage, isSeparationEntry } from "../kioskRules";

const acts = [
  { name: "Separação", asks_shortage: null },
  { name: "Recebimento", asks_shortage: false },
  { name: "Conferência", asks_shortage: true },
];

describe("shouldAskShortage", () => {
  it("sem sessão não pergunta", () => {
    expect(shouldAskShortage(null, acts)).toBe(false);
  });
  it("a configuração da atividade manda (true/false)", () => {
    expect(shouldAskShortage({ activity: "Conferência" }, acts)).toBe(true);
    expect(shouldAskShortage({ activity: "Recebimento", order_number: "1" }, acts)).toBe(false);
  });
  it("sem configuração, pergunta só se houve pedido/cliente/transferência", () => {
    expect(shouldAskShortage({ activity: "Separação", order_number: "55" }, acts)).toBe(true);
    expect(shouldAskShortage({ activity: "Separação", customer_name: "ACME" }, acts)).toBe(true);
    expect(shouldAskShortage({ activity: "Separação", transfer_type: "AP" }, acts)).toBe(true);
    expect(shouldAskShortage({ activity: "Separação" }, acts)).toBe(false);
  });
});

describe("isSeparationEntry", () => {
  it("pedido ou transferência = separação (vai para a conferência)", () => {
    expect(isSeparationEntry({ order_number: "9" })).toBe(true);
    expect(isSeparationEntry({ transfer_type: "ZN" })).toBe(true);
    expect(isSeparationEntry({ activity: "Limpeza" })).toBe(false);
  });
});
