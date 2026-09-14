// Configuração fixa (não editável pelo admin, por enquanto) de quais
// atividades exigem uma seleção extra antes de começar a contar o tempo,
// e quais são as opções dessa seleção.
//
// A comparação de nomes ignora maiúscula/minúscula, acentos e espaços nas
// pontas — isso evita que a seleção de local/veículo simplesmente não
// apareça se a atividade foi digitada de um jeito ligeiramente diferente
// em "Equipe" (ex.: sem acento, ou com espaço extra).
function normalize(str) {
  return (str || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

const RAW_ACTIVITY_DETAILS = {
  "Limpeza": {
    label: "Selecione o local",
    options: [
      "Frente da loja",
      "Lateral da loja",
      "Área de descanso",
      "Interno",
      "Tubos",
      "Abastecimento",
      "Mezanino",
    ],
  },
  "Organização": {
    label: "Selecione o local",
    options: [
      "Estoque entrada",
    ],
  },
  "Carregamento de Caminhão": {
    label: "Selecione o veículo",
    options: [
      "BTZ-8E99 (Volkswagen)",
      "FSY-7G52 (Volkswagen)",
      "CBR-8G48 (Mercedes)",
      "GAU-8D92 (Mercedes)",
      "SWM-9H82 (Sprinter)",
      "URW-3D80 (Sprinter)",
      "UOO-2B69 (Sprinter)",
    ],
  },
};

// Índice normalizado para lookup tolerante.
const NORMALIZED_INDEX = Object.fromEntries(
  Object.entries(RAW_ACTIVITY_DETAILS).map(([name, cfg]) => [normalize(name), cfg])
);

function configFor(activityName) {
  return NORMALIZED_INDEX[normalize(activityName)];
}

export function activityNeedsDetail(activityName) {
  return Boolean(configFor(activityName));
}

export function detailOptionsFor(activityName) {
  return configFor(activityName)?.options || [];
}

export function detailLabelFor(activityName) {
  return configFor(activityName)?.label || "Selecione";
}
