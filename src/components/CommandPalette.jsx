import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  IconActivity,
  IconUser,
  IconPackage,
  IconSettings,
  IconBuilding,
  IconSearch,
  IconTv,
  IconCalendar,
  IconClipboardCheck,
  IconBox,
  IconLayoutDashboard,
  IconEdit3,
  IconStar,
  IconUsers,
  IconClock,
  IconTrendingUp,
  IconRotateCcw,
  IconTarget,
  IconUpload,
  IconMapPin,
  IconShield,
  IconVolume2,
  IconAlertTriangle,
  IconLayers,
  IconCheckSquare,
  IconBarChart,
  IconPause,
  IconDownload,
} from "./Icons";

function ItemIcon({ type, actionKey }) {
  if (type === "operator") return <IconUser size={15} />;
  if (type === "order") return <IconPackage size={15} />;
  if (type === "product") return <IconSettings size={15} />;
  if (type === "customer") return <IconBuilding size={15} />;

  // action
  switch (actionKey) {
    case "nav-kiosk": return <IconActivity size={15} />;
    case "nav-errors": return <IconAlertTriangle size={15} />;
    case "nav-schedules": return <IconCalendar size={15} />;
    case "nav-conference": return <IconClipboardCheck size={15} />;
    case "nav-checklist": return <IconCheckSquare size={15} />;
    case "nav-shortages": return <IconBox size={15} />;
    case "nav-rotation": return <IconRotateCcw size={15} />;
    case "nav-goals-dashboard": return <IconTrendingUp size={15} />;
    case "nav-stock-map": return <IconMapPin size={15} />;
    case "nav-stock-map-3d": return <IconLayers size={15} />;
    case "nav-stock-scan": return <IconPackage size={15} />;
    case "nav-address-labels": return <IconEdit3 size={15} />;
    case "nav-turn-comparison": return <IconBarChart size={15} />;
    case "nav-workload": return <IconTrendingUp size={15} />;
    case "nav-pauses": return <IconPause size={15} />;
    case "nav-monthly-report": return <IconDownload size={15} />;
    case "nav-panel": return <IconLayoutDashboard size={15} />;
    case "nav-manual": return <IconEdit3 size={15} />;
    case "nav-goals": return <IconTarget size={15} />;
    case "nav-admin-master": return <IconStar size={15} />;
    case "nav-csv-import": return <IconUpload size={15} />;
    case "nav-fraud": return <IconShield size={15} />;
    case "nav-reports-scheduler": return <IconDownload size={15} />;
    case "nav-team": return <IconSettings size={15} />;
    case "nav-sales-team": return <IconUsers size={15} />;
    case "nav-audit": return <IconClock size={15} />;
    case "action-tv": return <IconTv size={15} />;
    default: return <IconActivity size={15} />;
  }
}

export default function CommandPalette({
  open,
  onClose,
  operators = [],
  entries = [],
  activities = [],
  onNavigate,
  onViewOperator,
  onApplyFilter,
}) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const allItems = useMemo(() => {
    const items = [];

    items.push(
      { id: "nav-kiosk", type: "action", actionKey: "nav-kiosk", title: "Ir para Apontar atividade", subtitle: "Registro de atividade no chão de fábrica", onSelect: () => onNavigate?.("kiosk") },
      { id: "nav-errors", type: "action", actionKey: "nav-errors", title: "Ir para Apontar erro", subtitle: "Registro de erro de separação", onSelect: () => onNavigate?.("errors-kiosk") },
      { id: "nav-schedules", type: "action", actionKey: "nav-schedules", title: "Ir para Agenda", subtitle: "Agendamentos de recebimento", onSelect: () => onNavigate?.("schedules") },
      { id: "nav-conference", type: "action", actionKey: "nav-conference", title: "Ir para Conferência", subtitle: "Mesa de conferência de pedidos", onSelect: () => onNavigate?.("conference") },
      { id: "nav-checklist", type: "action", actionKey: "nav-checklist", title: "Ir para Checklist do CD", subtitle: "Abertura e fechamento do turno", onSelect: () => onNavigate?.("checklist") },
      { id: "nav-shortages", type: "action", actionKey: "nav-shortages", title: "Ir para Faltas", subtitle: "Consulta de faltas de material", onSelect: () => onNavigate?.("shortages") },
      { id: "nav-rotation", type: "action", actionKey: "nav-rotation", title: "Ir para Rotação de tarefas", subtitle: "Limpezas e organizações", onSelect: () => onNavigate?.("rotation") },
      { id: "nav-goals-dashboard", type: "action", actionKey: "nav-goals-dashboard", title: "Ir para Dashboard de metas", subtitle: "Progresso consolidado", onSelect: () => onNavigate?.("goals-dashboard") },
      { id: "nav-stock-map", type: "action", actionKey: "nav-stock-map", title: "Ir para Mapa do estoque (2D)", subtitle: "Layout interativo e edição 360°", onSelect: () => onNavigate?.("stock-map") },
      { id: "nav-stock-map-3d", type: "action", actionKey: "nav-stock-map-3d", title: "Ir para Mapa 3D", subtitle: "Galpão em 3D com edição e andares", onSelect: () => onNavigate?.("stock-map-3d") },
      { id: "nav-stock-scan", type: "action", actionKey: "nav-stock-scan", title: "Ir para Coletar endereços", subtitle: "Bipar códigos de barras e endereços", onSelect: () => onNavigate?.("stock-scan") },
      { id: "nav-address-labels", type: "action", actionKey: "nav-address-labels", title: "Ir para Etiquetas de endereço", subtitle: "Gerar QR padrão CD (ex.: 1C1105EA)", onSelect: () => onNavigate?.("address-labels") },
      { id: "nav-turn-comparison", type: "action", actionKey: "nav-turn-comparison", title: "Ir para Comparação de turnos", subtitle: "Manhã vs. Tarde", onSelect: () => onNavigate?.("turn-comparison") },
      { id: "nav-workload", type: "action", actionKey: "nav-workload", title: "Ir para Carga de trabalho", subtitle: "Mapa de calor, previsão e filtros", onSelect: () => onNavigate?.("workload") },
      { id: "nav-pauses", type: "action", actionKey: "nav-pauses", title: "Ir para Pausas", subtitle: "Histórico e motivos de pausa", onSelect: () => onNavigate?.("pauses") },
      { id: "nav-monthly-report", type: "action", actionKey: "nav-monthly-report", title: "Ir para Relatório mensal", subtitle: "Consolidado gerencial do mês", onSelect: () => onNavigate?.("monthly-report") },
      { id: "nav-landing", type: "action", actionKey: "nav-kiosk", title: "Ir para Página Inicial", subtitle: "Apresentação do Aponta CD", onSelect: () => onNavigate?.("landing") },
      { id: "nav-panel", type: "action", actionKey: "nav-panel", title: "Ir para Indicadores", subtitle: "Painel de métricas do admin", onSelect: () => onNavigate?.("panel") },
      { id: "nav-manual", type: "action", actionKey: "nav-manual", title: "Ir para Lançamento manual", subtitle: "Digitar dados antigos", onSelect: () => onNavigate?.("manual") },
      { id: "nav-goals", type: "action", actionKey: "nav-goals", title: "Ir para Metas individuais", subtitle: "Configurar metas por operador", onSelect: () => onNavigate?.("goals") },
      { id: "nav-admin-master", type: "action", actionKey: "nav-admin-master", title: "Ir para Central de controle", subtitle: "Poderes totais do admin", onSelect: () => onNavigate?.("admin-master") },
      { id: "nav-csv-import", type: "action", actionKey: "nav-csv-import", title: "Ir para Importar CSV", subtitle: "Analisar planilhas externas", onSelect: () => onNavigate?.("csv-import") },
      { id: "nav-fraud", type: "action", actionKey: "nav-fraud", title: "Ir para Detecção de fraude", subtitle: "Padrões suspeitos", onSelect: () => onNavigate?.("fraud") },
      { id: "nav-reports-scheduler", type: "action", actionKey: "nav-reports-scheduler", title: "Ir para Export agendado", subtitle: "Envio automático de relatórios", onSelect: () => onNavigate?.("reports-scheduler") },
      { id: "nav-team", type: "action", actionKey: "nav-team", title: "Ir para Cadastros", subtitle: "Operadores, atividades, veículos", onSelect: () => onNavigate?.("team") },
      { id: "nav-sales-team", type: "action", actionKey: "nav-sales-team", title: "Ir para Equipe comercial", subtitle: "Líderes e vendedores", onSelect: () => onNavigate?.("sales-team") },
      { id: "nav-audit", type: "action", actionKey: "nav-audit", title: "Ir para Auditoria", subtitle: "Histórico de alterações", onSelect: () => onNavigate?.("audit") },
      { id: "action-tv", type: "action", actionKey: "action-tv", title: "Abrir Painel TV", subtitle: "Painel de exibição em nova aba", onSelect: () => window.open("/tv", "_blank", "noopener,noreferrer") },
      { id: "action-today", type: "action", actionKey: "nav-panel", title: "Filtrar Indicadores por Hoje", subtitle: "Aplica filtro de período rápido", onSelect: () => { onNavigate?.("panel"); onApplyFilter?.({ type: "hoje" }); } },
      { id: "action-week", type: "action", actionKey: "nav-panel", title: "Filtrar Indicadores por Últimos 7 dias", subtitle: "Aplica filtro de período rápido", onSelect: () => { onNavigate?.("panel"); onApplyFilter?.({ type: "7dias" }); } },
      { id: "action-month", type: "action", actionKey: "nav-panel", title: "Filtrar Indicadores por Este mês", subtitle: "Aplica filtro de período rápido", onSelect: () => { onNavigate?.("panel"); onApplyFilter?.({ type: "mes" }); } },
    );

    operators.forEach((op) => {
      items.push({
        id: `op-${op.code}`,
        type: "operator",
        title: op.name,
        subtitle: `${op.role || "—"} · #${op.code}`,
        keywords: `${op.name} ${op.code} ${op.role || ""}`.toLowerCase(),
        onSelect: () => onViewOperator?.(op),
      });
    });

    const seenOrders = new Set();
    entries.forEach((e) => {
      if (!e.order_number) return;
      const key = `${e.order_number}-${e.customer_name || ""}`;
      if (seenOrders.has(key)) return;
      seenOrders.add(key);
      if (seenOrders.size > 200) return;
      items.push({
        id: `order-${key}`,
        type: "order",
        title: `Pedido #${e.order_number}`,
        subtitle: `${e.customer_name || "sem cliente"} · ${e.operator_name || "—"}`,
        keywords: `${e.order_number} ${e.customer_name || ""}`.toLowerCase(),
        onSelect: () => {
          onNavigate?.("panel");
          onApplyFilter?.({ type: "pedido", value: e.order_number });
        },
      });
    });

    return items;
  }, [operators, entries, onNavigate, onViewOperator, onApplyFilter]);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allItems.slice(0, 30);

    return allItems
      .map((item) => {
        const haystack = `${item.title || ""} ${item.subtitle || ""} ${item.keywords || ""}`.toLowerCase();
        const idx = haystack.indexOf(q);
        if (idx === -1) return null;
        const titleIdx = (item.title || "").toLowerCase().indexOf(q);
        const score = titleIdx >= 0 ? titleIdx : idx + 100;
        return { item, score };
      })
      .filter(Boolean)
      .sort((a, b) => a.score - b.score)
      .slice(0, 30)
      .map((x) => x.item);
  }, [allItems, query]);

  useEffect(() => {
    if (selectedIndex >= filteredItems.length) setSelectedIndex(0);
  }, [filteredItems, selectedIndex]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose?.();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filteredItems.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const item = filteredItems[selectedIndex];
        if (item) {
          item.onSelect?.();
          onClose?.();
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, filteredItems, selectedIndex, onClose]);

  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const grouped = useMemo(() => {
    const groups = { action: [], operator: [], order: [], product: [], customer: [] };
    filteredItems.forEach((item) => {
      if (groups[item.type]) groups[item.type].push(item);
      else groups.action.push(item);
    });
    return groups;
  }, [filteredItems]);

  const groupLabels = {
    action: "Ações rápidas",
    operator: "Operadores",
    order: "Pedidos",
    product: "Produtos",
    customer: "Clientes",
  };

  if (!open) return null;

  return (
    <div className="cmd-backdrop" onClick={onClose}>
      <div className="cmd-palette" onClick={(e) => e.stopPropagation()}>
        <div className="cmd-input-wrap">
          <span className="cmd-input-icon">
            <IconSearch size={18} />
          </span>
          <input
            ref={inputRef}
            className="cmd-input"
            placeholder="Buscar operador, pedido, ação..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <span className="cmd-kbd">ESC</span>
        </div>

        <div className="cmd-results" ref={listRef}>
          {filteredItems.length === 0 ? (
            <div className="cmd-empty">
              Nada encontrado para <strong>"{query}"</strong>
              <br />
              <span style={{ fontSize: 12 }}>Tente buscar por nome, código ou número de pedido.</span>
            </div>
          ) : (
            <>
              {Object.entries(grouped).map(([type, items]) => {
                if (items.length === 0) return null;
                return (
                  <React.Fragment key={type}>
                    <div className="cmd-section">{groupLabels[type] || type}</div>
                    {items.map((item) => {
                      const globalIdx = filteredItems.indexOf(item);
                      const isSelected = globalIdx === selectedIndex;
                      return (
                        <div
                          key={item.id}
                          data-index={globalIdx}
                          className={`cmd-item ${isSelected ? "selected" : ""}`}
                          onClick={() => {
                            item.onSelect?.();
                            onClose?.();
                          }}
                          onMouseEnter={() => setSelectedIndex(globalIdx)}
                        >
                          <div className="cmd-item-icon">
                            <ItemIcon type={item.type} actionKey={item.actionKey} />
                          </div>
                          <div className="cmd-item-content">
                            <div className="cmd-item-title">{item.title}</div>
                            {item.subtitle && <div className="cmd-item-subtitle">{item.subtitle}</div>}
                          </div>
                          {isSelected && <span className="cmd-item-badge">ENTER</span>}
                        </div>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </>
          )}
        </div>

        <div className="cmd-footer">
          <div className="cmd-footer-item">
            <span className="cmd-kbd">↑↓</span>
            <span>Navegar</span>
          </div>
          <div className="cmd-footer-item">
            <span className="cmd-kbd">ENTER</span>
            <span>Selecionar</span>
          </div>
          <div className="cmd-footer-item">
            <span className="cmd-kbd">ESC</span>
            <span>Fechar</span>
          </div>
        </div>
      </div>
    </div>
  );
}