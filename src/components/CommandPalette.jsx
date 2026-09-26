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
  IconDot,
} from "./Icons";

// Ícone por tipo de item
function ItemIcon({ type }) {
  switch (type) {
    case "action":
      return <IconActivity size={15} />;
    case "operator":
      return <IconUser size={15} />;
    case "order":
      return <IconPackage size={15} />;
    case "product":
      return <IconSettings size={15} />;
    case "customer":
      return <IconBuilding size={15} />;
    default:
      return <IconDot size={15} />;
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

    // Ações rápidas
    items.push(
      { id: "nav-kiosk", type: "action", title: "Ir para Apontar atividade", subtitle: "Registro de atividade no chão de fábrica", onSelect: () => onNavigate?.("kiosk") },
      { id: "nav-errors", type: "action", title: "Ir para Apontar erro", subtitle: "Registro de erro de separação", onSelect: () => onNavigate?.("errors-kiosk") },
      { id: "nav-schedules", type: "action", title: "Ir para Agenda", subtitle: "Agendamentos de recebimento", onSelect: () => onNavigate?.("schedules") },
      { id: "nav-conference", type: "action", title: "Ir para Conferência", subtitle: "Mesa de conferência de pedidos", onSelect: () => onNavigate?.("conference") },
      { id: "nav-shortages", type: "action", title: "Ir para Faltas", subtitle: "Consulta de faltas de material", onSelect: () => onNavigate?.("shortages") },
      { id: "nav-panel", type: "action", title: "Ir para Indicadores", subtitle: "Painel de métricas do admin", onSelect: () => onNavigate?.("panel") },
      { id: "nav-manual", type: "action", title: "Ir para Lançamento manual", subtitle: "Digitar dados antigos", onSelect: () => onNavigate?.("manual") },
      { id: "nav-team", type: "action", title: "Ir para Cadastros", subtitle: "Operadores, atividades, veículos", onSelect: () => onNavigate?.("team") },
      { id: "nav-admin-master", type: "action", title: "Ir para Central de controle", subtitle: "Poderes totais do admin", onSelect: () => onNavigate?.("admin-master") },
      { id: "nav-audit", type: "action", title: "Ir para Auditoria", subtitle: "Histórico de alterações", onSelect: () => onNavigate?.("audit") },
      { id: "action-tv", type: "action", title: "Abrir Painel TV", subtitle: "Painel de exibição em nova aba", onSelect: () => window.open("/tv", "_blank") },
      { id: "action-today", type: "action", title: "Filtrar Indicadores por Hoje", subtitle: "Aplica filtro de período rápido", onSelect: () => { onNavigate?.("panel"); onApplyFilter?.({ type: "hoje" }); } },
      { id: "action-week", type: "action", title: "Filtrar Indicadores por Últimos 7 dias", subtitle: "Aplica filtro de período rápido", onSelect: () => { onNavigate?.("panel"); onApplyFilter?.({ type: "7dias" }); } },
      { id: "action-month", type: "action", title: "Filtrar Indicadores por Este mês", subtitle: "Aplica filtro de período rápido", onSelect: () => { onNavigate?.("panel"); onApplyFilter?.({ type: "mes" }); } },
    );

    // Operadores
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

    // Pedidos
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
                          <div className="cmd-item-icon"><ItemIcon type={item.type} /></div>
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