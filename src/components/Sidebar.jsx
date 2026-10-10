import React, { useMemo } from "react";

// Menu lateral do Aponta CD.
// Recebe:
//  - tab: aba atual
//  - setTab: função para trocar de aba
//  - isAdmin: se o usuário destravou o admin com PIN
//  - onLock: função para travar admin (volta pro kiosk)
//  - currentOperator: operador logado (com role: 'operator' | 'lider' | 'admin')
export default function Sidebar({ tab, setTab, isAdmin, onLock, currentOperator }) {
  const isLeader = currentOperator?.role === "lider" || isAdmin;

  // Lista de itens "públicos" (não precisam de admin).
  const publicItems = useMemo(
    () => [
      { key: "kiosk", label: "Kiosk", icon: "🕒" },
      { key: "errors-kiosk", label: "Erros de Separação", icon: "⚠" },
      { key: "shortages", label: "Faltas", icon: "📦" },
      { key: "conference", label: "Conferência", icon: "🔎" },
      { key: "checklist", label: "Checklist CD", icon: "✅" },
      { key: "schedules", label: "Escalas", icon: "🗓" },
      { key: "sales-query", label: "Consulta Vendas", icon: "💬" },
      { key: "rotation", label: "Rotação", icon: "🔄" },
      { key: "goals-dashboard", label: "Metas", icon: "🎯" },
      { key: "stock-map", label: "Mapa de Estoque", icon: "🗺" },
      // ↓↓ NOVO ↓↓
      {
        key: "daily-routine",
        label: "Rotina do Líder",
        icon: "📋",
        visible: isLeader, // só aparece para líder ou admin
      },
    ],
    [isLeader]
  );

  // Lista de itens ADMIN (precisam de PIN).
  const adminItems = useMemo(
    () => [
      { key: "executive", label: "Visão Executiva", icon: "📊" },
      { key: "panel", label: "Painel", icon: "📈" },
      { key: "team", label: "Equipe", icon: "👥" },
      { key: "manual", label: "Lançamento Manual", icon: "✍" },
      { key: "audit", label: "Auditoria", icon: "🔍" },
      { key: "sales-team", label: "Equipe de Vendas", icon: "🛒" },
      { key: "admin-master", label: "Admin Master", icon: "🔧" },
      { key: "goals", label: "Metas (Admin)", icon: "🎯" },
      { key: "csv-import", label: "Importar CSV", icon: "📥" },
      { key: "fraud", label: "Fraudes", icon: "🚨" },
      { key: "reports-scheduler", label: "Relatórios Agendados", icon: "🕐" },
      { key: "stock-map-edit", label: "Editar Mapa", icon: "🗺" },
      { key: "turn-comparison", label: "Comparar Turnos", icon: "🔀" },
      { key: "supplier-shortages", label: "Faltas Fornecedor", icon: "📦" },
      { key: "sound-settings", label: "Sons", icon: "🔊" },
      { key: "alert-settings", label: "Alertas", icon: "🔔" },
      { key: "team-goals", label: "Metas da Equipe", icon: "🥇" },
      { key: "achievements", label: "Conquistas", icon: "🏆" },
      { key: "equipment", label: "Equipamentos", icon: "🧰" },
      { key: "stock-map-history", label: "Hist. Mapa", icon: "📜" },
      { key: "monthly-report", label: "Relatório Mensal", icon: "📅" },
      // ↓↓ NOVO ↓↓
      { key: "routine-settings", label: "Config. Rotina", icon: "⚙" },
    ],
    []
  );

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <strong>Aponta CD</strong>
      </div>

      <nav className="sidebar-nav">
        {publicItems
          .filter((it) => it.visible !== false)
          .map((it) => (
            <button
              key={it.key}
              className={`sidebar-item ${tab === it.key ? "active" : ""}`}
              onClick={() => setTab(it.key)}
              type="button"
            >
              <span className="sidebar-icon">{it.icon}</span>
              <span className="sidebar-label">{it.label}</span>
            </button>
          ))}

        {isAdmin && (
          <>
            <div className="sidebar-sep">Admin</div>
            {adminItems.map((it) => (
              <button
                key={it.key}
                className={`sidebar-item ${tab === it.key ? "active" : ""}`}
                onClick={() => setTab(it.key)}
                type="button"
              >
                <span className="sidebar-icon">{it.icon}</span>
                <span className="sidebar-label">{it.label}</span>
              </button>
            ))}

            <button
              className="sidebar-item sidebar-lock"
              onClick={onLock}
              type="button"
            >
              <span className="sidebar-icon">🔒</span>
              <span className="sidebar-label">Travar Admin</span>
            </button>
          </>
        )}
      </nav>
    </aside>
  );
}