// Configuração fixa (não editável pelo admin, por enquanto) de quais
// atividades exigem uma seleção extra antes de começar a contar o tempo,
// e quais são as opções dessa seleção.
//
// A chave precisa bater exatamente com o nome da atividade cadastrado em
// "activities" no banco. Se o nome da atividade for renomeado pelo admin
// em Equipe, essa ligação se perde — como combinado, por ora isso fica
// fixo no código em vez de editável.
export const ACTIVITY_DETAILS = {
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

export function activityNeedsDetail(activityName) {
  return Boolean(ACTIVITY_DETAILS[activityName]);
}

export function detailOptionsFor(activityName) {
  return ACTIVITY_DETAILS[activityName]?.options || [];
}

export function detailLabelFor(activityName) {
  return ACTIVITY_DETAILS[activityName]?.label || "Selecione";
}
