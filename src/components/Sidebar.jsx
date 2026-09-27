import React, { useEffect, useState } from "react";
import ThemeToggle from "./ThemeToggle";
import { useAuth } from "../context/AuthContext";
import {
  IconActivity,
  IconAlertTriangle,
  IconCalendar,
  IconClipboardCheck,
  IconBox,
  IconSearch,
  IconLayoutDashboard,
  IconTrendingUp,
  IconEdit3,
  IconSettings,
  IconUsers,
  IconClock,
  IconTv,
  IconStar,
  IconLogOut,
  IconChevronLeft,
  IconChevronRight,
  IconRotateCcw,
  IconTarget,
  IconUpload,
  IconMapPin,
  IconShield,
  IconVolume2,
  IconPackage,
  IconAlertCircle,
  IconAward,
  IconTruck,
  IconLayers,
  IconDownload,
} from "./Icons";

const STORAGE_KEY = "aponta_sidebar_collapsed";

const SECTIONS = [
  {
    title: "Operação",
    items: [
      { key: "kiosk", label: "Apontar atividade", Icon: IconActivity },
      { key: "errors-kiosk", label: "Apontar erro", Icon: IconAlertTriangle },
      { key: "schedules", label: "Agenda", Icon: IconCalendar },
      { key: "conference", label: "Conferência", Icon: IconClipboardCheck },
      { key: "shortages", label: "Faltas", Icon: IconBox },
      { key: "checklist", label: "Checklist do CD", Icon: IconClipboardCheck },
      { key: "equipment", label: "Equipamentos", Icon: IconTruck },
      { key: "sales-query", label: "Líder da equipe", Icon: IconSearch },
      { key: "rotation", label: "Rotação de tarefas", Icon: IconRotateCcw },
      { key: "goals-dashboard", label: "Dashboard de metas", Icon: IconTrendingUp },
      { key: "stock-map", label: "Mapa do estoque", Icon: IconMapPin },
    ],
  },
  {
    title: "Gestão",
    items: [
      { key: "executive", label: "Visão geral", Icon: IconTrendingUp },
      { key: "panel", label: "Indicadores", Icon: IconLayoutDashboard },
      { key: "turn-comparison", label: "Comparação de turnos", Icon: IconActivity },
      { key: "supplier-shortages", label: "Faltas por fornecedor", Icon: IconPackage },
      { key: "team-goals", label: "Metas por equipe", Icon: IconTarget },
      { key: "achievements", label: "Conquistas", Icon: IconAward },
      { key: "monthly-report", label: "Relatório mensal", Icon: IconDownload },
      { key: "stock-map-history", label: "Histórico do mapa", Icon: IconLayers },
      { key: "manual", label: "Lançamento manual", Icon: IconEdit3 },
      { key: "goals", label: "Metas individuais", Icon: IconTarget },
      { key: "admin-master", label: "Central de controle", Icon: IconStar },
      { key: "csv-import", label: "Importar CSV", Icon: IconUpload },
      { key: "fraud", label: "Detecção de fraude", Icon: IconShield },
      { key: "reports-scheduler", label: "Export agendado", Icon: IconVolume2 },
      { key: "alert-settings", label: "Alertas WhatsApp", Icon: IconAlertCircle },
      { key: "team", label: "Cadastros", Icon: IconSettings },
      { key: "sound-settings", label: "Sons do sistema", Icon: IconVolume2 },
      { key: "sales-team", label: "Equipe comercial", Icon: IconUsers },
      { key: "audit", label: "Auditoria", Icon: IconClock },
    ],
  },
];

export default function Sidebar({ tab, setTab, isAdmin, onLock }) {
  const { session, signOut } = useAuth();
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

  async function handleSignOut() {
    if (!window.confirm("Sair da sua conta?")) return;
    await signOut();
  }

  const email = session?.user?.email || "";

  return (
    <nav className={`sidebar ${collapsed ? "sidebar-collapsed" : ""}`}>
      <div className="sidebar-brand-row">
        <div className="sidebar-brand">
          {!collapsed && (
            <div className="sidebar-brand-text">Aponta CD</div>
          )}
        </div>
        <button
          className="sidebar-toggle"
          onClick={toggle}
          title={collapsed ? "Expandir menu" : "Recolher menu"}
          aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
        >
          {collapsed ? <IconChevronRight size={16} /> : <IconChevronLeft size={16} />}
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
                <span className="nav-item-icon"><Icon size={18} /></span>
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
              title={collapsed ? "Painel TV" : "Abrir painel de exibição numa nova aba"}
            >
              <span className="nav-item-icon"><IconTv size={18} /></span>
              {!collapsed && (
                <>
                  <span className="nav-item-label">Painel TV</span>
                  <span className="nav-item-badge">↗</span>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="sidebar-footer">
        {!collapsed && email && (
          <div className="sidebar-user" title={email}>
            <div className="sidebar-user-avatar">
              {email.charAt(0).toUpperCase()}
            </div>
            <div className="sidebar-user-email">{email}</div>
          </div>
        )}

        <ThemeToggle compact={collapsed} />

        {isAdmin && (
          <button
            className="sidebar-logout"
            onClick={onLock}
            title={collapsed ? "Sair do admin" : undefined}
          >
            <IconLogOut size={16} />
            {!collapsed && <span>Sair do admin</span>}
          </button>
        )}

        <button
          className="sidebar-logout sidebar-logout-danger"
          onClick={handleSignOut}
          title={collapsed ? "Sair da conta" : undefined}
        >
          <IconLogOut size={16} />
          {!collapsed && <span>Sair da conta</span>}
        </button>
      </div>
    </nav>
  );
}