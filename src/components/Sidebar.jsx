import React, { useEffect, useMemo, useRef, useState } from "react";
import { useMediaQuery, MOBILE_QUERY } from "../hooks/useMediaQuery";
import ThemeToggle from "./ThemeToggle";
import { useAuth } from "../context/AuthContext";
import { AccordionSection } from "./ui/Accordion";
import BrandMark from "./BrandMark";
import { getOperatorProfileCustom, getProfileTheme } from "../lib/operatorProfileCustom";
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
  IconUser,
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
  IconDownload,
  IconBuilding,
  IconPause,
  IconCheckSquare,
  IconBarChart,
  IconArrowLeftRight,
} from "./Icons";

const STORAGE_KEY = "aponta_sidebar_collapsed";
const SECTIONS_KEY = "aponta_sidebar_sections_v3";
const GROUPS_KEY = "aponta_sidebar_groups";

const SECTIONS = [
  {
    title: "Operação",
    accent: "#38bdf8",
    items: [
      { key: "kiosk", label: "Apontar atividade", Icon: IconActivity },
      { key: "errors-kiosk", label: "Apontar erro", Icon: IconAlertTriangle },
      { key: "conference", label: "Conferência", Icon: IconClipboardCheck },
      { key: "schedules", label: "Agenda", Icon: IconCalendar },
    ],
  },
  {
    title: "Mapa & Estoque",
    accent: "#10b981",
    items: [
      {
        key: "stock-map",
        label: "Mapa",
        Icon: IconMapPin,
        matchTabs: ["stock-map", "stock-map-3d", "stock-map-history"],
      },
      { key: "stock-scan", label: "Coletar endereços", Icon: IconPackage },
      { key: "address-labels", label: "Etiquetas de endereço", Icon: IconEdit3, requiresAdmin: true },
      {
        key: "faltas-group",
        label: "Faltas",
        Icon: IconBox,
        children: [
          { key: "shortages", label: "Todas as faltas" },
          { key: "supplier-shortages", label: "Por fornecedor", Icon: IconBuilding },
          { key: "transfer-shortages", label: "Por transferência", Icon: IconArrowLeftRight },
        ],
      },
    ],
  },
  {
    title: "Gestão & Liderança",
    accent: "#f59e0b",
    items: [
      { key: "checklist", label: "Checklist do CD", Icon: IconCheckSquare, requiresLeader: true },
      { key: "rotation", label: "Rotação de tarefas", Icon: IconRotateCcw, requiresLeader: true },
      { key: "daily-routine", label: "Rotina do Líder", Icon: IconStar, requiresLeader: true },
    ],
  },
  {
    title: "Equipe & Recursos",
    accent: "#8b5cf6",
    items: [
      { key: "my-profile", label: "Meu perfil", Icon: IconUser },
      { key: "sales-query", label: "Líder da equipe", Icon: IconSearch },
      { key: "sales-team", label: "Equipe comercial", Icon: IconUsers, requiresAdmin: true },
      { key: "badges", label: "Crachás", Icon: IconStar },
      { key: "equipment", label: "Equipamentos", Icon: IconTruck },
      {
        key: "metas-group",
        label: "Metas",
        Icon: IconTarget,
        children: [
          { key: "goals-dashboard", label: "Dashboard" },
          { key: "goals", label: "Individuais", requiresAdmin: true },
          { key: "team-goals", label: "Por equipe", requiresAdmin: true },
        ],
      },
      { key: "achievements", label: "Conquistas", Icon: IconAward, requiresAdmin: true },
      { key: "team", label: "Cadastros", Icon: IconSettings, requiresAdmin: true },
    ],
  },
  {
    title: "Análise & KPIs",
    accent: "#0ea5c6",
    items: [
      { key: "executive", label: "Visão geral", Icon: IconTrendingUp, requiresAdmin: true },
      { key: "panel", label: "Indicadores", Icon: IconLayoutDashboard, requiresAdmin: true },
      { key: "turn-comparison", label: "Comparação de turnos", Icon: IconBarChart, requiresAdmin: true },
      { key: "workload", label: "Carga de trabalho", Icon: IconActivity, requiresAdmin: true },
      { key: "pauses", label: "Pausas", Icon: IconPause, requiresAdmin: true },
      { key: "monthly-report", label: "Relatório mensal", Icon: IconDownload, requiresAdmin: true },
    ],
  },
  {
    title: "Sistema",
    accent: "#64748b",
    items: [
      { key: "admin-master", label: "Central de controle", Icon: IconStar, requiresAdmin: true },
      { key: "manual", label: "Lançamento manual", Icon: IconEdit3, requiresAdmin: true },
      { key: "csv-import", label: "Importar CSV / Excel", Icon: IconUpload, requiresAdmin: true },
      { key: "fraud", label: "Detecção de fraude", Icon: IconShield, requiresAdmin: true },
      { key: "reports-scheduler", label: "Export agendado", Icon: IconDownload, requiresAdmin: true },
      { key: "alert-settings", label: "Alertas Telegram", Icon: IconAlertCircle, requiresAdmin: true },
      { key: "sound-settings", label: "Sons do sistema", Icon: IconVolume2, requiresAdmin: true },
      { key: "health", label: "Saúde do sistema", Icon: IconActivity, requiresAdmin: true },
      { key: "audit", label: "Auditoria", Icon: IconClock, requiresAdmin: true },
      { key: "routine-settings", label: "Config. Rotina", Icon: IconSettings, requiresAdmin: true },
    ],
  },
];

export default function Sidebar({ id, tab, setTab, isAdmin, onLock, onOperatorLogout, currentOperator, mobileOpen }) {
  const { session, signOut } = useAuth();
  const isLeader =
    isAdmin ||
    currentOperator?.role === "lider" ||
    currentOperator?.role === "gestor" ||
    currentOperator?.role === "admin" ||
    (Array.isArray(currentOperator?.roles) &&
      (currentOperator.roles.includes("lider") || currentOperator.roles.includes("gestor")));

  const [collapsedPref, setCollapsed] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === "1"; } catch { return false; }
  });

  const [navSearch, setNavSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [profileCustom, setProfileCustom] = useState(() =>
    getOperatorProfileCustom(currentOperator?.code)
  );

  useEffect(() => {
    setProfileCustom(getOperatorProfileCustom(currentOperator?.code));
    function onProfileUpdated(e) {
      if (String(e.detail?.code) === String(currentOperator?.code)) {
        setProfileCustom(e.detail.profile);
      }
    }
    window.addEventListener("aponta:profile-updated", onProfileUpdated);
    return () => window.removeEventListener("aponta:profile-updated", onProfileUpdated);
  }, [currentOperator?.code]);

  const [sectionOpen, setSectionOpen] = useState(() => {
    try {
      const raw = localStorage.getItem(SECTIONS_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return {
      Operação: true,
      "Mapa & Estoque": true,
      "Gestão & Liderança": true,
      "Equipe & Recursos": true,
      "Análise & KPIs": false,
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

  const email = session?.user?.email || "";

  // Proteção contra autofill do navegador jogando o e-mail no campo de busca do menu
  useEffect(() => {
    if (navSearch && (navSearch.includes("@") || (email && navSearch.toLowerCase() === email.toLowerCase()))) {
      setNavSearch("");
    }
  }, [navSearch, email]);

  // Garante que a seção da aba ativa esteja sempre aberta
  useEffect(() => {
    const activeSection = SECTIONS.find((s) =>
      s.items.some(
        (it) =>
          it.key === tab ||
          it.matchTabs?.includes(tab) ||
          it.children?.some((c) => c.key === tab)
      )
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

  function groupHasActiveChild(item) {
    if (!item.children) return false;
    return item.children.some((c) => c.key === tab);
  }

  const normalizedSearch = navSearch.includes("@") ? "" : navSearch.trim().toLowerCase();

  const filteredSections = useMemo(() => {
    return SECTIONS.map((section) => {
      const visibleItems = section.items
        .filter((item) => {
          if (item.requiresAdmin && !isAdmin) return false;
          if (item.requiresLeader && !isLeader) return false;
          if (!normalizedSearch) return true;
          if (item.label.toLowerCase().includes(normalizedSearch)) return true;
          if (item.children?.some((c) => (!c.requiresAdmin || isAdmin) && c.label.toLowerCase().includes(normalizedSearch))) return true;
          return false;
        })
        .map((item) => {
          if (!item.children) return item;
          const children = item.children.filter((c) => !c.requiresAdmin || isAdmin);
          return { ...item, children };
        })
        .filter((item) => !item.children || item.children.length > 0);
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
    const isActive = tab === item.key || item.matchTabs?.includes(tab);
    return (
      <div
        key={item.key}
        className={`nav-item ${isActive ? "active" : ""}`}
        {...press(() => setTab(item.key))}
        aria-current={isActive ? "page" : undefined}
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
          {...press(() => setTab("welcome"))}
          title="Voltar para o início"
          style={{ cursor: "pointer" }}
        >
          <BrandMark variant={collapsed ? "icon" : "lockup"} />
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
              type="search"
              name="aponta_sidebar_menu_filter"
              className="sidebar-search-input"
              placeholder="Filtrar menu..."
              value={navSearch}
              readOnly={!searchFocused}
              onFocus={() => setSearchFocused(true)}
              onPointerDown={() => setSearchFocused(true)}
              onChange={(e) => {
                const val = e.target.value;
                if (val.includes("@")) return;
                setNavSearch(val);
              }}
              autoComplete="off"
              data-lpignore="true"
              data-1p-ignore="true"
              data-form-type="other"
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
        {!collapsed && currentOperator && (
          <div
            className="sidebar-user"
            {...press(() => setTab("my-profile"))}
            title={`Abrir Meu Perfil — ${currentOperator.name} (cód. ${currentOperator.code})`}
            style={{ cursor: "pointer" }}
          >
            <div
              className="sidebar-user-avatar"
              style={{
                background: getProfileTheme(profileCustom.themeId).accent,
                color: "#fff",
                overflow: "hidden",
              }}
            >
              {profileCustom.avatarDataUrl ? (
                <img
                  src={profileCustom.avatarDataUrl}
                  alt={currentOperator.name}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                (currentOperator.name || "O").charAt(0).toUpperCase()
              )}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {profileCustom.nickname || currentOperator.name}
              </div>
              <div style={{ fontSize: 10.5, color: "var(--text-faint)" }}>Cód. {currentOperator.code} · Ver perfil</div>
            </div>
          </div>
        )}

        {!collapsed && !currentOperator && email && (
          <div className="sidebar-user" title={email}>
            <div className="sidebar-user-avatar">{email.charAt(0).toUpperCase()}</div>
            <div className="sidebar-user-email">{email}</div>
          </div>
        )}

        <ThemeToggle compact={collapsed} />

        {!isAdmin && (
          <button
            className="sidebar-logout"
            onClick={() => setTab("panel")}
            title={collapsed ? "Acesso Admin" : "Desbloquear painel de administrador"}
          >
            <IconShield size={16} />
            {!collapsed && <span>Acesso Admin</span>}
          </button>
        )}

        {onOperatorLogout && currentOperator && (
          <button
            className="sidebar-logout"
            onClick={onOperatorLogout}
            title={collapsed ? "Trocar operador" : undefined}
          >
            <IconLogOut size={16} />
            {!collapsed && <span>Trocar operador</span>}
          </button>
        )}

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
