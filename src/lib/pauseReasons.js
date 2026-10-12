// Motivos de pausa mostrados ao operador. A chave (key) é o que fica gravado
// no banco: não renomeie as chaves; para mudar o texto, altere só o label.
export const PAUSE_REASONS = [
  { key: "almoco", label: "Almoço / lanche" },
  { key: "banheiro", label: "Banheiro / pessoal" },
  { key: "falta_material", label: "Falta de material" },
  { key: "aguardando_equipamento", label: "Aguardando empilhadeira / equipamento" },
  { key: "aguardando_lideranca", label: "Aguardando liderança / orientação" },
  { key: "reuniao", label: "Reunião / treinamento" },
  { key: "outro", label: "Outro motivo" },
];

export function reasonLabel(key) {
  return PAUSE_REASONS.find((r) => r.key === key)?.label || key || "Sem motivo";
}
