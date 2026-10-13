import React, { useEffect, useRef, useState } from "react";
import { useMediaQuery, MOBILE_QUERY } from "../hooks/useMediaQuery";
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
  IconChevronDown,
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
  IconBuilding,
  IconHistory,
  IconPause,
} from "./Icons";

const STORAGE_KEY = "aponta_sidebar_collapsed";
const SECTIONS_KEY = "aponta_sidebar_sections";
const GROUPS_KEY = "aponta_sidebar_groups";

const SECTIONS = [
  {
    title: "Operação",
    items: [
      { key: "kiosk", label: "Apontar atividade", Icon: IconActivity },
      { key: "errors-kiosk", label: "Apontar erro", Icon: IconAlertTriangle },
      { key: "conference", label: "Conferência", Icon: IconClipboardCheck },
      { key: "schedules", label: "Agenda", Icon: IconCalendar },
      { key: "checklist", label: "Checklist do CD", Icon: IconClipboardCheck },
      { key: "rotation", label: "Rotação de tarefas", Icon: IconRotateCcw },
      { key: "daily-routine", label: "Rotina do Líder", Icon: IconClipboardCheck, requiresLeader: true },
    ],
  },
  {
    title: "Análise",
    items: [
      { key: "executive", label: "Visão geral", Icon: IconTrendingUp },
      { key: "panel", label: "Indicadores", Icon: IconLayoutDashboard },
      { key: "turn-comparison", label: "Comparação de turnos", Icon: IconActivity },
      { key: "workload", label: "Carga de trabalho", Icon: IconTrendingUp },
      { key: "pauses", label: "Pausas", Icon: IconPause },
      {
        key: "faltas-group",
        label: "Faltas",
        Icon: IconBox,
        children: [
          { key: "shortages", label: "Todas as faltas" },
          { key: "supplier-shortages", label: "Por fornecedor", Icon: IconBuilding },
        ],
      },
      { key: "stock-map", label: "Mapa do estoque", Icon: IconMapPin },
      { key: "stock-map-3d", label: "Mapa 3D", Icon: IconLayers },
      { key: "stock-scan", label: "Coletar endereços", Icon: IconPackage },
      { key: "stock-map-history", label: "Histórico do mapa", Icon: IconHistory },
    ],
  },
  {
    title: "Pessoas",
    items: [
      {
        key: "metas-group",
        label: "Metas",
        Icon: IconTarget,
        children: [
          { key: "goals", label: "Individuais" },
          { key: "team-goals", label: "Por equipe" },
          { key: "goals-dashboard", label: "Dashboard" },
        ],
      },
      { key: "achievements", label: "Conquistas", Icon: IconAward },
      { key: "sales-query", label: "Líder da equipe", Icon: IconSearch },
      { key: "sales-team", label: "Equipe comercial", Icon: IconUsers },
      { key: "team", label: "Cadastros", Icon: IconSettings },
      { key: "badges", label: "Crachás", Icon: IconUsers },
      { key: "address-labels", label: "Etiquetas de endereço", Icon: IconMapPin },
      { key: "equipment", label: "Equipamentos", Icon: IconTruck },
    ],
  },
  {
    title: "Sistema",
    items: [
      { key: "admin-master", label: "Central de controle", Icon: IconStar },
      { key: "manual", label: "Lançamento manual", Icon: IconEdit3 },
      { key: "csv-import", label: "Importar CSV", Icon: IconUpload },
      { key: "monthly-report", label: "Relatório mensal", Icon: IconDownload },
      { key: "fraud", label: "Detecção de fraude", Icon: IconShield },
      { key: "reports-scheduler", label: "Export agendado", Icon: IconVolume2 },
      { key: "alert-settings", label: "Alertas Telegram", Icon: IconAlertCircle },
      { key: "sound-settings", label: "Sons do sistema", Icon: IconVolume2 },
      { key: "health", label: "Saúde do sistema", Icon: IconAlertCircle },
      { key: "audit", label: "Auditoria", Icon: IconClock },
      { key: "routine-settings", label: "Config. Rotina", Icon: IconSettings, requiresAdmin: true },
    ],
  },
];

export default function Sidebar({ id, tab, setTab, isAdmin, onLock, currentOperator, mobileOpen }) {
  const { session, signOut } = useAuth();

  const isLeader = currentOperator?.role === "lider" || isAdmin;

  // Preferência do desktop (salva no aparelho). No celular o menu é uma gaveta
  // e sempre mostra os textos, sem mexer na preferência salva.
  const [collapsedPref, setCollapsed] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === "1"; } catch { return false; }
  });

  const [sectionOpen, setSectionOpen] = useState(() => {
    try {
      const raw = localStorage.getItem(SECTIONS_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return SECTIONS.reduce((acc, s) => ({ ...acc, [s.title]: true }), {});
  });

  const [groupOpen, setGroupOpen] = useState(() => {
    try {
      const raw = localStorage.getItem(GROUPS_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return { "faltas-group": false, "metas-group": false };
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, collapsedPref ? "1" : "0"); } catch {}
  }, [collapsedPref]);

  const isMobile = useMediaQuery(MOBILE_QUERY);
  const collapsed = collapsedPref && !isMobile;

  // Ao abrir a gaveta no celular, leva o foco para o primeiro item do menu.
  const navRef = useRef(null);
  useEffect(() => {
    if (mobileOpen) navRef.current?.querySelector(".nav-item")?.focus();
  }, [mobileOpen]);

  // Itens do menu são <div>: dá a eles comportamento de botão (Tab, Enter e Espaço).
  const press = (fn) => ({
    role: "button",
    tabIndex: 0,
    onClick: fn,
    onKeyDown: (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        fn();
      }
    },
  });

  useEffect(() => {
    try { localStorage.setItem(SECTIONS_KEY, JSON.stringify(sectionOpen)); } catch {}
  }, [sectionOpen]);

  useEffect(() => {
    try { localStorage.setItem(GROUPS_KEY, JSON.stringify(groupOpen)); } catch {}
  }, [groupOpen]);

  function toggle() { setCollapsed((v) => !v); }

  function toggleSection(title) {
    setSectionOpen((s) => ({ ...s, [title]: !s[title] }));
  }

  function toggleGroup(key) {
    setGroupOpen((g) => ({ ...g, [key]: !g[key] }));
  }

  async function handleSignOut() {
    if (!window.confirm("Sair da sua conta?")) return;
    await signOut();
  }

  const email = session?.user?.email || "";

  function groupHasActiveChild(item) {
    if (!item.children) return false;
    return item.children.some((c) => c.key === tab);
  }

  function isItemVisible(item) {
    if (item.requiresLeader && !isLeader) return false;
    if (item.requiresAdmin && !isAdmin) return false;
    return true;
  }

  const navClasses = [
    "sidebar",
    collapsed ? "sidebar-collapsed" : "",
    mobileOpen ? "sidebar-open" : "",
  ].filter(Boolean).join(" ");

  return (
    <nav id={id} ref={navRef} className={navClasses} aria-label="Menu principal">
      <div className="sidebar-brand-row">
        <div className="sidebar-brand">
          {!collapsed && <div className="sidebar-brand-text">Aponta CD</div>}
        </div>
        {!isMobile && (
        <button
          className="sidebar-toggle"
          onClick={toggle}
          title={collapsed ? "Expandir menu" : "Recolher menu"}
          aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
        >
          {collapsed ? <IconChevronRight size={16} /> : <IconChevronLeft size={16} />}
        </button>
        )}
      </div>

      <div className="sidebar-nav">
        {SECTIONS.map((section) => {
          const isOpen = sectionOpen[section.title] !== false;
          const visibleItems = section.items.filter(isItemVisible);
          if (visibleItems.length === 0) return null;

          return (
            <div key={section.title} className="sidebar-section">
              {!collapsed ? (
                <button
                  className="sidebar-section-header"
                  onClick={() => toggleSection(section.title)}
                  style={{
                    width: "100%",
                    background: "transparent",
                    border: "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 12px 6px 12px",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    color: "var(--text-faint)",
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                  }}
                >
                  <span>{section.title}</span>
                  <IconChevronDown
                    size={12}
                    style={{
                      transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)",
                      transition: "transform 150ms ease",
                    }}
                  />
                </button>
              ) : (
                <div className="sidebar-section-divider" />
              )}

              {isOpen && visibleItems.map((item) => {
                if (item.children) {
                  const isGroupOpen = groupOpen[item.key];
                  const hasActiveChild = groupHasActiveChild(item);
                  const GroupIcon = item.Icon;

                  return (
                    <div key={item.key}>
                      <div
                        className={`nav-item ${hasActiveChild ? "active" : ""}`}
                        {...press(() => {
                          if (collapsed) {
                            setTab(item.children[0].key);
                          } else {
                            toggleGroup(item.key);
                          }
                        })}
                        aria-expanded={collapsed ? undefined : !!isGroupOpen}
                        title={collapsed ? item.label : undefined}
                        style={{ cursor: "pointer" }}
                      >
                        <span className="nav-item-icon">
                          {GroupIcon && <GroupIcon size={18} />}
                        </span>
                        {!collapsed && (
                          <>
                            <span className="nav-item-label">{item.label}</span>
                            <IconChevronDown
                              size={12}
                              style={{
                                marginLeft: "auto",
                                transform: isGroupOpen ? "rotate(0deg)" : "rotate(-90deg)",
                                transition: "transform 150ms ease",
                                color: "var(--text-faint)",
                              }}
                            />
                          </>
                        )}
                      </div>
                      {!collapsed && isGroupOpen && (
                        <div style={{ paddingLeft: 20 }}>
                          {item.children.map((child) => {
                            const ChildIcon = child.Icon;
                            return (
                              <div
                                key={child.key}
                                className={`nav-item ${tab === child.key ? "active" : ""}`}
                                {...press(() => setTab(child.key))}
                                aria-current={tab === child.key ? "page" : undefined}
                                style={{ fontSize: 13 }}
                              >
                                <span className="nav-item-icon">
                                  {ChildIcon ? <ChildIcon size={15} /> : <span style={{ width: 15, display: "inline-block" }} />}
                                </span>
                                <span className="nav-item-label">{child.label}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                }

                const ItemIcon = item.Icon;
                return (
                  <div
                    key={item.key}
                    className={`nav-item ${tab === item.key ? "active" : ""}`}
                    {...press(() => setTab(item.key))}
                    aria-current={tab === item.key ? "page" : undefined}
                    title={collapsed ? item.label : undefined}
                  >
                    <span className="nav-item-icon">
                      {ItemIcon && <ItemIcon size={18} />}
                    </span>
                    {!collapsed && <span className="nav-item-label">{item.label}</span>}
                  </div>
                );
              })}
            </div>
          );
        })}

        {isAdmin && (
          <div className="sidebar-section">
            {!collapsed && <div className="sidebar-section-divider" />}
            <div
              className="nav-item nav-item-tv"
              {...press(() => window.open("/tv", "_blank"))}
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
            <div className="sidebar-user-avatar">{email.charAt(0).toUpperCase()}</div>
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