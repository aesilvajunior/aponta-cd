import React, { useEffect, useMemo, useRef, useState } from "react";
import { useMediaQuery, MOBILE_QUERY } from "../hooks/useMediaQuery";
import ThemeToggle from "./ThemeToggle";
import { useAuth } from "../context/AuthContext";
import { AccordionSection } from "./ui/Accordion";
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
  IconCheckSquare,
  IconBarChart,
} from "./Icons";

const STORAGE_KEY = "aponta_sidebar_collapsed";
const SECTIONS_KEY = "aponta_sidebar_sections_v2";
const GROUPS_KEY = "aponta_sidebar_groups";

const SECTIONS = [
  {
    title: "Operação",
    accent: "#3b82f6",
    items: [
      { key: "kiosk", label: "Apontar atividade", Icon: IconActivity },
      { key: "errors-kiosk", label: "Apontar erro", Icon: IconAlertTriangle },
      { key: "conference", label: "Conferência", Icon: IconClipboardCheck },
      { key: "checklist", label: "Checklist do CD", Icon: IconCheckSquare },
      { key: "schedules", label: "Agenda", Icon: IconCalendar },
      { key: "rotation", label: "Rotação de tarefas", Icon: IconRotateCcw },
      { key: "daily-routine", label: "Rotina do Líder", Icon: IconStar, requiresLeader: true },
    ],
  },
  {
    title: "Mapa & Estoque",
    accent: "#10b981",
    items: [
      { key: "stock-map", label: "Mapa do estoque", Icon: IconMapPin },
      { key: "stock-map-3d", label: "Mapa 3D", Icon: IconLayers },
      { key: "stock-scan", label: "Coletar endereços", Icon: IconPackage },
      { key: "address-labels", label: "Etiquetas de endereço", Icon: IconEdit3 },
      { key: "stock-map-history", label: "Histórico do mapa", Icon: IconHistory },
      {
        key: "faltas-group",
        label: "Faltas",
        Icon: IconBox,
        children: [
          { key: "shortages", label: "Todas as faltas" },
          { key: "supplier-shortages", label: "Por fornecedor", Icon: IconBuilding },
        ],
      },
    ],
  },
  {
    title: "Análise & KPIs",
    accent: "#f59e0b",
    items: [
      { key: "executive", label: "Visão geral", Icon: IconTrendingUp },
      { key: "panel", label: "Indicadores", Icon: IconLayoutDashboard },
      { key: "turn-comparison", label: "Comparação de turnos", Icon: IconBarChart },
      { key: "workload", label: "Carga de trabalho", Icon: IconActivity },
      { key: "pauses", label: "Pausas", Icon: IconPause },
      { key: "monthly-report", label: "Relatório mensal", Icon: IconDownload },
    ],
  },
  {
    title: "Equipe & Metas",
    accent: "#8b5cf6",
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
      { key: "badges", label: "Crachás", Icon: IconStar },
      { key: "equipment", label: "Equipamentos", Icon: IconTruck },
      { key: "team", label: "Cadastros", Icon: IconSettings },
    ],
  },
  {
    title: "Sistema",
    accent: "#64748b",
    items: [
      { key: "admin-master", label: "Central de controle", Icon: IconStar },
      { key: "manual", label: "Lançamento manual", Icon: IconEdit3 },
      { key: "csv-import", label: "Importar CSV / Excel", Icon: IconUpload },
      { key: "fraud", label: "Detecção de fraude", Icon: IconShield },
      { key: "reports-scheduler", label: "Export agendado", Icon: IconDownload },
      { key: "alert-settings", label: "Alertas Telegram", Icon: IconAlertCircle },
      { key: "sound-settings", label: "Sons do sistema", Icon: IconVolume2 },
      { key: "health", label: "Saúde do sistema", Icon: IconActivity },
      { key: "audit", label: "Auditoria", Icon: IconClock },
      { key: "routine-settings", label: "Config. Rotina", Icon: IconSettings, requiresAdmin: true },
    ],
  },
];

export default function Sidebar({ id, tab, setTab, isAdmin, onLock, currentOperator, mobileOpen }) {
  const { session, signOut } = useAuth();
  const isLeader = currentOperator?.role === "lider" || isAdmin;

  const [collapsedPref, setCollapsed] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === "1"; } catch { return false; }
  });

  const [navSearch, setNavSearch] = useState("");

  const [sectionOpen, setSectionOpen] = useState(() => {
    try {
      const raw = localStorage.getItem(SECTIONS_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return {
      Operação: true,
      "Mapa & Estoque": true,
      "Análise & KPIs": false,
      "Equipe & Metas": false,
      Sistema: false,
    };
  });

  const [groupOpen, setGroupOpen] = useState(() => {
    try {
      const raw = localStorage.getItem(GROUPS_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return { "faltas-group": false, "metas-group": false };
  });

  // Garante que a seção da aba ativa esteja sempre aberta
  useEffect(() => {
    const activeSection = SECTIONS.find((s) =>
      s.items.some((it) => it.key === tab || it.children?.some((c) => c.key === tab))
    );
    if (activeSection) {
      setSectionOpen((prev) => (prev[activeSection.title] ? prev : { ...prev, [activeSection.title]: true }));
    }
  }, [tab]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, collapsedPref ? "1" : "0"); } catch {}
  }, [collapsedPref]);

  const isMobile = useMediaQuery(MOBILE_QUERY);
  const collapsed = collapsedPref && !isMobile;

  const navRef = useRef(null);
  useEffect(() => {
    if (mobileOpen) navRef.current?.querySelector(".nav-item")?.focus();
  }, [mobileOpen]);

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
  function toggleSection(title) { setSectionOpen((s) => ({ ...s, [title]: !s[title] })); }
  function toggleGroup(key) { setGroupOpen((g) => ({ ...g, [key]: !g[key] })); }

  async function handleSignOut() {
    if (!window.confirm("Sair da sua conta?")) return;
    await signOut();
  }

  const email = session?.user?.email || "";

  function groupHasActiveChild(item) {
    if (!item.children) return false;
    return item.children.some((c) => c.key === tab);
  }

  const normalizedSearch = navSearch.trim().toLowerCase();

  const filteredSections = useMemo(() => {
    return SECTIONS.map((section) => {
      const visibleItems = section.items.filter((item) => {
        if (item.requiresLeader && !isLeader) return false;
        if (item.requiresAdmin && !isAdmin) return false;
        if (!normalizedSearch) return true;
        if (item.label.toLowerCase().includes(normalizedSearch)) return true;
        if (item.children?.some((c) => c.label.toLowerCase().includes(normalizedSearch))) return true;
        return false;
      });
      return { ...section, visibleItems };
    }).filter((s) => s.visibleItems.length > 0);
  }, [isLeader, isAdmin, normalizedSearch]);

  const navClasses = [
    "sidebar",
    collapsed ? "sidebar-collapsed" : "",
    mobileOpen ? "sidebar-open" : "",
  ].filter(Boolean).join(" ");

  function renderItem(item) {
    if (item.children) {
      const isGroupOpen = normalizedSearch ? true : !!groupOpen[item.key];
      const hasActiveChild = groupHasActiveChild(item);
      const GroupIcon = item.Icon;

      return (
        <div key={item.key}>
          <div
            className={`nav-item ${hasActiveChild ? "active" : ""}`}
            {...press(() => {
              if (collapsed) setTab(item.children[0].key);
              else toggleGroup(item.key);
            })}
            aria-expanded={collapsed ? undefined : isGroupOpen}
            title={collapsed ? item.label : undefined}
          >
            <span className="nav-item-icon-pill">
              {GroupIcon && <GroupIcon size={16} />}
            </span>
            {!collapsed && (
              <>
                <span className="nav-item-label">{item.label}</span>
                <IconChevronDown
                  size={12}
                  style={{
                    marginLeft: "auto",
                    transform: isGroupOpen ? "rotate(0deg)" : "rotate(-90deg)",
                    transition: "transform 160ms ease",
                    color: "var(--text-faint)",
                  }}
                />
              </>
            )}
          </div>
          {!collapsed && isGroupOpen && (
            <div style={{ paddingLeft: 22 }}>
              {item.children.map((child) => {
                const ChildIcon = child.Icon;
                return (
                  <div
                    key={child.key}
                    className={`nav-item ${tab === child.key ? "active" : ""}`}
                    {...press(() => setTab(child.key))}
                    aria-current={tab === child.key ? "page" : undefined}
                    style={{ fontSize: 13, padding: "8px 12px" }}
                  >
                    <span className="nav-item-icon">
                      {ChildIcon ? <ChildIcon size={14} /> : <span style={{ width: 14, display: "inline-block" }} />}
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
        <span className="nav-item-icon-pill">
          {ItemIcon && <ItemIcon size={16} />}
        </span>
        {!collapsed && <span className="nav-item-label">{item.label}</span>}
      </div>
    );
  }

  return (
    <nav id={id} ref={navRef} className={navClasses} aria-label="Menu principal">
      <div className="sidebar-brand-row">
        <div
          className="sidebar-brand"
          {...press(() => setTab("landing"))}
          title="Ver página inicial de apresentação"
          style={{ cursor: "pointer" }}
        >
          <div className="sidebar-brand-mark">AC</div>
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

      {!collapsed && (
        <div className="sidebar-search-wrap">
          <div className="sidebar-search-box">
            <span className="sidebar-search-icon"><IconSearch size={13} /></span>
            <input
              type="text"
              className="sidebar-search-input"
              placeholder="Filtrar menu..."
              value={navSearch}
              onChange={(e) => setNavSearch(e.target.value)}
              aria-label="Filtrar menu lateral"
            />
            {navSearch && (
              <button
                type="button"
                className="sidebar-search-clear"
                onClick={() => setNavSearch("")}
                aria-label="Limpar filtro"
              >
                ×
              </button>
            )}
          </div>
        </div>
      )}

      <div className="sidebar-nav">
        {filteredSections.map((section) => {
          const isOpen = normalizedSearch ? true : sectionOpen[section.title] !== false;

          if (collapsed) {
            return (
              <div key={section.title} className="sidebar-section">
                <div className="sidebar-section-divider" />
                {section.visibleItems.map(renderItem)}
              </div>
            );
          }

          return (
            <AccordionSection
              key={section.title}
              title={section.title}
              accentColor={section.accent}
              count={section.visibleItems.length}
              isOpen={isOpen}
              onToggle={() => toggleSection(section.title)}
              compact
            >
              <div className="sidebar-section" style={{ marginBottom: 4 }}>
                {section.visibleItems.map(renderItem)}
              </div>
            </AccordionSection>
          );
        })}

        {isAdmin && (
          <div className="sidebar-section">
            {!collapsed && <div className="sidebar-section-divider" />}
            <div
              className="nav-item nav-item-tv"
              {...press(() => window.open("/tv", "_blank", "noopener,noreferrer"))}
              title={collapsed ? "Painel TV" : "Abrir painel de exibição numa nova aba"}
            >
              <span className="nav-item-icon-pill"><IconTv size={16} /></span>
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
