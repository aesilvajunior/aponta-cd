// Dados padrão usados quando o banco ainda não foi populado ou está
// inacessível. Ficam aqui (fora do App.jsx) pra deixar o componente
// principal mais limpo e permitir reuso em outros lugares.

export const DEFAULT_OPERATORS = [
  { code: "101", name: "Adeildo Junior", role: "Líder" },
  { code: "102", name: "Matheus", role: "Analista" },
  { code: "103", name: "Juliana", role: "Auxiliar" },
  { code: "104", name: "Alex Sander", role: "Recebimento" },
  { code: "105", name: "Gustavo", role: "Recebimento" },
  { code: "106", name: "César", role: "Conferência" },
  { code: "107", name: "Davi", role: "Conferência" },
  { code: "108", name: "Bryan", role: "Separação/Conferência (manhã)" },
  { code: "109", name: "Lucca", role: "Separação/Conferência (tarde)" },
  { code: "110", name: "Cauã", role: "Separação (manhã)" },
  { code: "111", name: "Felipe", role: "Separação (tarde)" },
  { code: "112", name: "Kauã", role: "Separação (manhã)" },
  { code: "113", name: "Pedro Paulo", role: "Separação (tarde)" },
  { code: "114", name: "Lucas", role: "Separação" },
  { code: "115", name: "João Victor", role: "Separação" },
  { code: "116", name: "Breno", role: "Separação" },
  { code: "117", name: "Klévio", role: "Separação" },
  { code: "118", name: "Leandro", role: "Separação" },
  { code: "119", name: "Lo-Ami", role: "Híbrido" },
];

export const DEFAULT_ACTIVITIES = [
  "Recebimento", "Conferência", "Separação", "Embalagem",
  "Expedição", "Reposição", "Inventário", "Outros",
].map((name) => ({ name, active: true }));

// Fallback dos tipos de erro — a fonte de verdade é a tabela error_types.
export const DEFAULT_ERROR_TYPES = [
  "Sobra de Material",
  "Não Tem no Pedido",
  "Falta de Material",
  "Outros",
].map((name) => ({ name, active: true }));