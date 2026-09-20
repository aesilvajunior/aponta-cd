import React, { useEffect, useState } from "react";
import ThemeToggle from "./ThemeToggle";
import logo from "../assets/logo.png";

const STORAGE_KEY = "aponta_sidebar_collapsed";

/* ============ ÍCONES SVG ============ */

function IconActivity() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="9" y1="13" x2="15" y2="13" />
      <line x1="9" y1="17" x2="13" y2="17" />
    </svg>
  );
}

function IconAlert() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function IconDashboard() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="9" />
      <rect x="14" y="3" width="7" height="5" />
      <rect x="14" y="12" width="7" height="9" />
      <rect x="3" y="16" width="7" height="5" />
    </svg>
  );
}

function IconExecutive() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" />
      <path d="M18 9l-5 5-3-3-5 5" />
      <path d="M18 9h-4" />
      <path d="M18 9v4" />
    </svg>
  );
}

function IconManual() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="12" y1="18" x2="12" y2="12" />
      <line x1="9" y1="15" x2="15" y2="15" />
    </svg>
  );
}

function IconSettings() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function IconHistory() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <polyline points="3 3 3 8 8 8" />
      <line x1="12" y1="7" x2="12" y2="12" />
      <line x1="12" y1="12" x2="15" y2="14" />
    </svg>
  );
}

function IconTv() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="15" rx="2" ry="2" />
      <polyline points="17 2 12 7 7 2" />
    </svg>
  );
}

function IconLogout() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function IconCollapse() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="11 17 6 12 11 7" />
      <polyline points="18 17 13 12 18 7" />
    </svg>
  );
}

function IconExpand() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="13 17 18 12 13 7" />
      <polyline points="6 17 11 12 6 7" />
    </svg>
  );
}

/* ============ ESTRUTURA ============ */

const SECTIONS = [
  {
    title: "Operação",
    items: [
      { key: "kiosk", label: "Registrar atividade", Icon: IconActivity },
      { key: "errors-kiosk", label: "Registrar erro", Icon: IconAlert },
      { key: "schedules", label: "Agendamentos", Icon: IconCalendar },
    ],
  },
  {
    title: "Gestão",
    items: [
      { key: "executive", label: "Visão executiva", Icon: IconExecutive },
      { key: "panel", label: "Painel de métricas", Icon: IconDashboard },
      { key: "manual", label: "Lançamento retroativo", Icon: IconManual },
      { key: "team", label: "Gestão e cadastros", Icon: IconSettings },
      { key: "audit", label: "Histórico de alterações", Icon: IconHistory },
    ],
  },
];

export default function Sidebar({ tab, setTab, isAdmin, onLock }) {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
    } catch {}
  }, [collapsed]);

  function toggle() {
    setCollapsed((v) => !v);
  }

  return (
    <nav className={`sidebar ${collapsed ? "sidebar-collapsed" : ""}`}>
      <div className="sidebar-brand-row">
        <div className="sidebar-brand">
          <img src={logo} alt="Hidráulica Tropeiro" />
          {!collapsed && (
            <div className="sidebar-brand-text">
              Aponta CD
              <span>Hidráulica Tropeiro</span>
            </div>
          )}
        </div>
        <button
          className="sidebar-toggle"
          onClick={toggle}
          title={collapsed ? "Expandir menu" : "Recolher menu"}
          aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
        >
          {collapsed ? <IconExpand /> : <IconCollapse />}
        </button>
      </div>

      <div className="sidebar-nav">
        {SECTIONS.map((section) => (
          <div key={section.title} className="sidebar-section">
            {!collapsed ? (
              <div className="sidebar-section-title">{section.title}</div>
            ) : (
              <div className="sidebar-section-divider" />
            )}
            {section.items.map(({ key, label, Icon }) => (
              <div
                key={key}
                className={`nav-item ${tab === key ? "active" : ""}`}
                onClick={() => setTab(key)}
                title={collapsed ? label : undefined}
              >
                <span className="nav-item-icon"><Icon /></span>
                {!collapsed && <span className="nav-item-label">{label}</span>}
              </div>
            ))}
          </div>
        ))}

        {isAdmin && (
          <div className="sidebar-section">
            {!collapsed && <div className="sidebar-section-divider" />}
            <div
              className="nav-item nav-item-tv"
              onClick={() => window.open("/tv", "_blank")}
              title={collapsed ? "Modo TV" : "Abre o painel de exibição numa nova aba"}
            >
              <span className="nav-item-icon"><IconTv /></span>
              {!collapsed && (
                <>
                  <span className="nav-item-label">Modo TV</span>
                  <span className="nav-item-badge">↗</span>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="sidebar-footer">
        <ThemeToggle compact={collapsed} />
        {isAdmin && (
          <button
            className="sidebar-logout"
            onClick={onLock}
            title={collapsed ? "Sair do admin" : undefined}
          >
            <IconLogout />
            {!collapsed && <span>Sair do admin</span>}
          </button>
        )}
      </div>
    </nav>
  );
}