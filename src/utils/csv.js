// Exportação simples de CSV — usado no Painel pra baixar o histórico.

export function exportEntriesCsv(entries) {
  if (!entries || !entries.length) {
    alert("Nada para exportar.");
    return;
  }

  const headers = [
    "Operador", "Atividade", "Início", "Fim", "Duração (s)", "Turno",
    "Pedido", "Cliente", "Tipo Transferência", "Transferência",
    "Veículo", "Placa", "Estação", "Observação", "Manual",
  ];

  const escape = (v) => {
    if (v == null) return "";
    const s = String(v);
    if (/[";\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const rows = entries.map((e) => [
    e.operator_name,
    e.activity,
    e.start_time,
    e.end_time,
    e.duration_seconds,
    e.shift,
    e.order_number,
    e.customer_name,
    e.transfer_type,
    e.transfer_number,
    e.vehicle,
    e.plate,
    e.station,
    e.note,
    e.manual_entry ? "Sim" : "Não",
  ].map(escape).join(";"));

  const csv = [headers.join(";"), ...rows].join("\r\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `aponta-cd-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}