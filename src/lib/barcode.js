// ============================================================
// Leitura de códigos: o que o bip significa e se ele é confiável.
// Aceita: EAN-13/EAN-8/UPC-A/ITF-14 (com conferência do dígito verificador),
// outros códigos de barras (Code 128 etc.), etiqueta de endereço do mapa
// ("END:R1D|PAR|03|2") e crachá de operador ("APONTA:101").
// ============================================================
import { parseBadge } from "./badge";

export const ADDRESS_PREFIX = "END:";

// Remove espaços, quebras de linha e caracteres de controle que alguns leitores
// acrescentam (ex.: GS = \x1d, CR/LF no fim).
export function normalizeScan(raw) {
  if (raw === null || raw === undefined) return "";
  // eslint-disable-next-line no-control-regex
  return String(raw).replace(/[\x00-\x1f\x7f]/g, "").trim();
}

// Dígito verificador GTIN (EAN-8, UPC-A de 12, EAN-13 e ITF-14).
export function isValidGtin(code) {
  if (!/^\d+$/.test(code) || ![8, 12, 13, 14].includes(code.length)) return false;
  const digits = code.split("").map(Number);
  const check = digits.pop();
  // pesos 3,1,3,1... a partir do dígito mais à direita (sem contar o verificador)
  let sum = 0;
  for (let i = digits.length - 1, w = 3; i >= 0; i--, w = w === 3 ? 1 : 3) sum += digits[i] * w;
  return (10 - (sum % 10)) % 10 === check;
}

function normalizeSide(raw) {
  const s = String(raw || "").trim().toLowerCase();
  if (!s || s === "-") return null;
  if (s === "i" || s.startsWith("impar") || s.startsWith("ímpar")) return "impar";
  if (s === "p" || s.startsWith("par")) return "par";
  return null;
}

export function addressLabelPayload({ areaCode, side = null, slot = "", level = "" }) {
  const sideCode = side === "par" ? "PAR" : side === "impar" ? "IMPAR" : "";
  return `${ADDRESS_PREFIX}${String(areaCode).trim().toUpperCase()}|${sideCode}|${String(slot || "").trim()}|${String(level || "").trim()}`;
}

// "END:R1D|PAR|03|2" -> { areaCode: "R1D", side: "par", slot: "03", level: "2" }
export function parseAddressLabel(text) {
  const t = normalizeScan(text);
  if (!t.toUpperCase().startsWith(ADDRESS_PREFIX)) return null;
  const [areaCode, side, slot, level] = t.slice(ADDRESS_PREFIX.length).split("|");
  if (!areaCode || !areaCode.trim()) return null;
  return {
    areaCode: areaCode.trim().toUpperCase(),
    side: normalizeSide(side),
    slot: (slot || "").trim(),
    level: (level || "").trim(),
  };
}

// Classifica um bip: { kind: "empty" | "address" | "badge" | "product", ... }
export function classifyScan(raw, { badgeLength = 3 } = {}) {
  const text = normalizeScan(raw);
  if (!text) return { kind: "empty" };

  const address = parseAddressLabel(text);
  if (address) return { kind: "address", ...address };

  if (text.toUpperCase().startsWith("APONTA:")) {
    const code = parseBadge(text, badgeLength);
    return code ? { kind: "badge", code } : { kind: "empty" };
  }

  const numeric = /^\d+$/.test(text);
  const gtinLength = numeric && [8, 12, 13, 14].includes(text.length);
  return {
    kind: "product",
    barcode: text.toUpperCase(),
    // Se o tamanho é de GTIN mas o dígito não confere, a leitura provavelmente falhou.
    suspicious: gtinLength && !isValidGtin(text),
    isGtin: gtinLength && isValidGtin(text),
  };
}
