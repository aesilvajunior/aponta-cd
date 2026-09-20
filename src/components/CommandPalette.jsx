import React, { useEffect, useMemo, useRef, useState } from "react";

// Ícone pra cada tipo
const ICONS = {
  action: "⚡",
  operator: "👤",
  order: "📦",
  product: "🔧",
  customer: "🏢",
};

// ============================================================
// Command Palette — aberto com Ctrl+K
// Busca operadores, pedidos, produtos, clientes e ações rápidas
// ============================================================

export default function CommandPalette({
  open,
  onClose,
  operators = [],
  entries = [],
  activities = [],
  onNavigate,           // (tab) => void
  onViewOperator,       // (operator) => void
  onApplyFilter,        // ({type, value}) => void
}) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  // Reseta ao abrir
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // ------------------------------------------------------------
  // Constrói os itens disponíveis (ações + dados)
  // ------------------------------------------------------------
  const allItems = useMemo(() => {
    const items = [];

    // ---- AÇÕES RÁPIDAS ----
    items.push(
      { id: "nav-kiosk", type: "action", title: "Ir para Registrar atividade", subtitle: "Tela do quiosque", onSelect: () => onNavigate?.("kiosk") },
      { id: "nav-errors", type: "action", title: "Ir para Registrar erro", subtitle: "Quiosque de erros", onSelect: () => onNavigate?.("errors-kiosk") },
      { id: "nav-panel", type: "action", title: "Ir para Painel de métricas", subtitle: "Dashboard do admin", onSelect: () => onNavigate?.("panel") },
      { id: "nav-manual", type: "action", title: "Ir para Lançamento retroativo", subtitle: "Digitar dados antigos", onSelect: () => onNavigate?.("manual") },
      { id: "nav-team", type: "action", title: "Ir para Gestão e cadastros", subtitle: "Operadores, atividades, veículos", onSelect: () => onNavigate?.("team") },
      { id: "nav-audit", type: "action", title: "Ir para Histórico de alterações", subtitle: "Auditoria do sistema", onSelect: () => onNavigate?.("audit") },
      { id: "action-tv", type: "action", title: "Abrir Modo TV", subtitle: "Painel de exibição em nova aba", onSelect: () => window.open("/tv", "_blank") },
      { id: "action-today", type: "action", title: "Filtrar Painel por Hoje", subtitle: "Aplica filtro rápido de período", onSelect: () => { onNavigate?.("panel"); onApplyFilter?.({ type: "hoje" }); } },
      { id: "action-week", type: "action", title: "Filtrar Painel por Últimos 7 dias", subtitle: "Aplica filtro rápido de período", onSelect: () => { onNavigate?.("panel"); onApplyFilter?.({ type: "7dias" }); } },
      { id: "action-month", type: "action", title: "Filtrar Painel por Este mês", subtitle: "Aplica filtro rápido de período", onSelect: () => { onNavigate?.("panel"); onApplyFilter?.({ type: "mes" }); } },
    );

    // ---- OPERADORES ----
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

    // ---- PEDIDOS (últimos 200 únicos) ----
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

  // ------------------------------------------------------------
  // Filtro por busca
  // ------------------------------------------------------------
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

  // Garante índice válido quando a lista muda
  useEffect(() => {
    if (selectedIndex >= filteredItems.length) setSelectedIndex(0);
  }, [filteredItems, selectedIndex]);

  // ------------------------------------------------------------
  // Teclado
  // ------------------------------------------------------------
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

  // Scroll do item selecionado pra dentro da view
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  // Agrupa itens por tipo pra exibir títulos de seção
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

  // ⬇️ RETORNO CONDICIONAL — SÓ DEPOIS DE TODOS OS HOOKS
  if (!open) return null;

  return (
    <div className="cmd-backdrop" onClick={onClose}>
      <div className="cmd-palette" onClick={(e) => e.stopPropagation()}>
        <div className="cmd-input-wrap">
          <span className="cmd-input-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </span>
          <input
            ref={inputRef}
            className="cmd-input"
            placeholder="Buscar operador, pedido, ação…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <span className="cmd-kbd">ESC</span>
        </div>

        <div className="cmd-results" ref={listRef}>
          {filteredItems.length === 0 ? (
            <div className="cmd-empty">
              Nada encontrado pra <strong>"{query}"</strong>
              <br />
              <span style={{ fontSize: 12 }}>Tenta buscar por nome, código ou número de pedido.</span>
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
                          <div className="cmd-item-icon">{ICONS[item.type] || "•"}</div>
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