// Crachá do operador: QR/código de barras com o código do operador.
// Formato gerado: "APONTA:101". Também aceita só os dígitos ("101"), que é
// o que um leitor de código de barras comum envia.
export const BADGE_PREFIX = "APONTA:";

export function badgePayload(operatorCode) {
  return `${BADGE_PREFIX}${operatorCode}`;
}

// Extrai o código do operador do texto lido. Retorna null se não for um crachá.
export function parseBadge(text, codeLength = 3) {
  if (typeof text !== "string") return null;
  const t = text.trim();
  const m = t.match(new RegExp(`^(?:${BADGE_PREFIX})?(\\d{${codeLength}})$`, "i"));
  return m ? m[1] : null;
}
