import React, { useEffect, useRef, useState } from "react";
import ThemeToggle from "./ThemeToggle";
import BrandMark from "./BrandMark";
import {
  IconTv,
  IconChevronRight,
  IconLock,
  IconCheck,
} from "./Icons";

/* Crisp inline SVG icons matching the Stitch Material Symbols design (100% offline-safe) */
function StIcon({ name, size = 20, className = "" }) {
  const props = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.9",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className,
    "aria-hidden": "true",
  };
  switch (name) {
    case "verified_user":
      return (
        <svg {...props}>
          <path d="M12 3l7 3v5c0 5-3.4 9.2-7 10-3.6-.8-7-5-7-10V6l7-3z" />
          <path d="M9.2 12.2l1.9 1.9 3.9-4.1" />
        </svg>
      );
    case "view_in_ar":
      return (
        <svg {...props}>
          <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" />
          <path d="M12 12l8-4.5M12 12v9M12 12L4 7.5" />
        </svg>
      );
    case "grid_view":
      return (
        <svg {...props}>
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
      );
    case "groups":
      return (
        <svg {...props}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case "analytics":
      return (
        <svg {...props}>
          <path d="M3 3v18h18" />
          <path d="M7 15v-4M12 15V8M17 15v-6" />
        </svg>
      );
    case "terminal":
      return (
        <svg {...props}>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M7 10l3 2.5L7 15M12 15h5" />
        </svg>
      );
    case "rocket":
      return (
        <svg {...props}>
          <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
          <path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
          <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
        </svg>
      );
    case "inventory":
      return (
        <svg {...props}>
          <path d="M21 8l-9-5-9 5v8l9 5 9-5V8z" />
          <path d="M3.3 7.2L12 12l8.7-4.8M12 22V12" />
        </svg>
      );
    case "timer":
      return (
        <svg {...props}>
          <circle cx="12" cy="13" r="8" />
          <path d="M12 9v4l2.5 2M9 2h6" />
        </svg>
      );
    case "sensors":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="2" />
          <path d="M16.24 7.76a6 6 0 0 1 0 8.49M7.76 16.24a6 6 0 0 1 0-8.49M19.07 4.93a10 10 0 0 1 0 14.14M4.93 19.07a10 10 0 0 1 0-14.14" />
        </svg>
      );
    case "plumbing":
      return (
        <svg {...props}>
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
        </svg>
      );
    case "trending_down":
      return (
        <svg {...props}>
          <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
          <polyline points="17 18 23 18 23 12" />
        </svg>
      );
    case "cancel":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="9" />
          <path d="M15 9l-6 6M9 9l6 6" />
        </svg>
      );
    case "check_circle":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="9" />
          <path d="M8.5 12.2l2.3 2.3 4.7-4.8" />
        </svg>
      );
    case "arrow_forward":
      return (
        <svg {...props}>
          <path d="M5 12h14M13 5l7 7-7 7" />
        </svg>
      );
    case "support":
      return (
        <svg {...props}>
          <path d="M4 12a8 8 0 0 1 16 0" />
          <rect x="2" y="12" width="4" height="6" rx="2" />
          <rect x="18" y="12" width="4" height="6" rx="2" />
          <path d="M18 18a4 4 0 0 1-4 4h-2" />
        </svg>
      );
    case "hub":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="3" />
          <circle cx="5" cy="6" r="2" />
          <circle cx="19" cy="6" r="2" />
          <circle cx="5" cy="18" r="2" />
          <circle cx="19" cy="18" r="2" />
          <path d="M6.7 7.3L9.8 10M17.3 7.3L14.2 10M6.7 16.7L9.8 14M17.3 16.7L14.2 14" />
        </svg>
      );
    default:
      return null;
  }
}

const MODULES = [
  {
    id: "mapas-picking",
    icon: "view_in_ar",
    title: "Visualização & Mapas 2D / 3D de Picking",
    desc: "Navegação tridimensional precisa pelas ruas do armazém. O sistema calcula a rota tridimensional ótima de separação evitando contrafluxos de empilhadeiras e diminuindo trajetos a pé.",
    footerLeft: "Simulação Algorítmica",
    footerRight: "Roteamento Anti-Colisão",
    action: "map3d",
  },
  {
    id: "buffer-enderecamento",
    icon: "grid_view",
    title: "Gestão de Pulmão & Buffer Inteligente",
    desc: "Alocação dinâmica de estoque entre áreas de armazenagem pesada (tubos 6m e paletes fechados) e áreas de apanhe rápido (gôndolas para joelhos, conexões e registros roscáveis).",
    footerLeft: "Reabastecimento Preventivo",
    footerRight: "Zero Quebra de Posição",
    action: "employee",
  },
  {
    id: "kpis-equipe",
    icon: "groups",
    title: "Controle Total de Equipe & Produtividade",
    desc: "Apontamento individual e por turnos de conferentes, separadores e motoristas de doca. Metas por hora de itens apontados, pesados e despachados com rastreio de micro-pausas.",
    footerLeft: "Gamificação Operacional",
    footerRight: "Score de Eficiência 100%",
    action: "employee",
  },
  {
    id: "dashboard-kpis",
    icon: "analytics",
    title: "Dashboard de KPIs em Tempo Real",
    desc: "Painel com métricas essenciais como OTIF (On-Time In-Full), taxa de avarias mecânicas por transporte, tempo ciclo de conferência e previsibilidade de reposição de curva ABC.",
    footerLeft: "Relatórios Gerenciais",
    footerRight: "Exportação ERP Instantânea",
    action: "tv",
  },
];

export default function LandingPage({
  mode = "auth", // "auth" | "operator" | "authenticated"
  operators = [],
  onEnterLogin,
  onEnterEmployeeArea,
  onOperatorLogin,
  onBackToLanding,
  standaloneGate = false,
  isAuthenticated = false,
  onOpenMap2D,
  onOpenMap3D,
}) {
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [codeError, setCodeError] = useState("");
  const [shake, setShake] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [empFieldsUnlocked, setEmpFieldsUnlocked] = useState(false);
  const inputRef = useRef(null);

  const isOperatorGate = mode === "operator";
  const activeOperatorsCount = operators.filter((o) => o.active !== false).length;
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    if (!authModalOpen && !standaloneGate) return undefined;
    setCode("");
    setPassword("");
    setCodeError("");
    setEmpFieldsUnlocked(false);
    const t = setTimeout(() => {
      setEmpFieldsUnlocked(true);
      inputRef.current?.focus();
    }, 120);
    const onKey = (e) => {
      if (e.key === "Escape" && authModalOpen) setAuthModalOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [authModalOpen, standaloneGate]);

  function openEmployeeArea(e) {
    if (e) e.preventDefault();
    if (onEnterEmployeeArea) {
      onEnterEmployeeArea();
      return;
    }
    if (isOperatorGate) {
      setCodeError("");
      setAuthModalOpen(true);
    } else {
      onEnterLogin?.();
    }
  }

  function handleModuleAction(mod) {
    if (mod.action === "map3d" && isAuthenticated && onOpenMap3D) {
      onOpenMap3D();
      return;
    }
    if (mod.action === "tv") {
      window.open("/tv", "_blank", "noopener,noreferrer");
      return;
    }
    openEmployeeArea();
  }

  function triggerError(msg) {
    setCodeError(msg);
    setShake(true);
    setTimeout(() => setShake(false), 450);
  }

  function handleCodeSubmit(e) {
    if (e) e.preventDefault();
    const cleanCode = code.trim().toUpperCase();
    const cleanPass = password.trim().toUpperCase();
    if (!cleanCode) {
      triggerError("Digite seu código de funcionário.");
      return;
    }
    if (!cleanPass) {
      triggerError("Digite sua senha.");
      return;
    }
    const found = (operators || []).find(
      (op) => String(op.code || "").trim().toUpperCase() === cleanCode && op.active !== false
    );
    if (!found) {
      triggerError(`Código "${cleanCode}" não encontrado ou inativo.`);
      return;
    }
    const expectedPass = String(found.password || found.code || "").trim().toUpperCase();
    if (cleanPass !== expectedPass) {
      triggerError("Senha incorreta. (Dica: use os números do seu código.)");
      return;
    }
    setCodeError("");
    setAuthModalOpen(false);
    onOperatorLogin?.(found);
  }

  // Página dedicada em /funcionario para o colaborador entrar com código + senha
  if (standaloneGate) {
    return (
      <div className="login-page">
        <div className="login-theme-corner">
          <ThemeToggle compact showColors={false} />
        </div>

        <div className={`br-modal-card ${shake ? "shake" : ""}`} style={{ maxWidth: 440 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
            <BrandMark variant="lockup" />
            {onBackToLanding && (
              <a
                href="/"
                className="btn-small"
                style={{ textDecoration: "none" }}
                onClick={(e) => {
                  e.preventDefault();
                  onBackToLanding();
                }}
              >
                ← Início
              </a>
            )}
          </div>

          <div className="br-operator-head" style={{ marginBottom: 18 }}>
            <div className="br-operator-icon">
              <IconLock size={18} />
            </div>
            <div>
              <h2 id="employee-modal-title">Área do Funcionário</h2>
              <p>Informe seu código e sua senha para acessar</p>
            </div>
          </div>

          <form onSubmit={handleCodeSubmit} autoComplete="off" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label className="br-field-label" htmlFor="emp-code-standalone">Código do funcionário</label>
              <input
                id="emp-code-standalone"
                name="aponta_emp_code_guard"
                ref={inputRef}
                type="text"
                inputMode="numeric"
                className="br-code-input"
                placeholder="Ex.: 101"
                value={code}
                readOnly={!empFieldsUnlocked}
                onFocus={() => setEmpFieldsUnlocked(true)}
                onPointerDown={() => setEmpFieldsUnlocked(true)}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val.includes("@")) return;
                  setCodeError("");
                  setCode(val);
                }}
                autoComplete="off"
                data-lpignore="true"
                data-1p-ignore="true"
                data-form-type="other"
              />
            </div>

            <div>
              <label className="br-field-label" htmlFor="emp-pass-standalone">Senha</label>
              <div style={{ position: "relative" }}>
                <input
                  id="emp-pass-standalone"
                  name="aponta_emp_pass_guard"
                  type={showPass ? "text" : "password"}
                  inputMode="numeric"
                  className="br-code-input"
                  style={{ paddingRight: 78 }}
                  placeholder="••••"
                  value={password}
                  readOnly={!empFieldsUnlocked}
                  onFocus={() => setEmpFieldsUnlocked(true)}
                  onPointerDown={() => setEmpFieldsUnlocked(true)}
                  onChange={(e) => {
                    setCodeError("");
                    setPassword(e.target.value);
                  }}
                  autoComplete="new-password"
                  data-lpignore="true"
                  data-1p-ignore="true"
                  data-form-type="other"
                />
                <button
                  type="button"
                  className="br-pass-toggle"
                  onClick={() => setShowPass((v) => !v)}
                >
                  {showPass ? "OCULTAR" : "VER"}
                </button>
              </div>
              <div style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 5 }}>
                Primeiro acesso: use os números do seu próprio código como senha.
              </div>
            </div>

            {codeError && (
              <div className="login-error" role="alert" style={{ margin: 0 }}>
                {codeError}
              </div>
            )}

            <button type="submit" className="br-submit-btn" style={{ marginTop: 4 }}>
              <span>Entrar no sistema</span>
              <IconChevronRight size={16} />
            </button>
          </form>

          {activeOperatorsCount === 0 && onOperatorLogin && (
            <button
              type="button"
              className="btn-small"
              style={{ width: "100%", marginTop: 12, justifyContent: "center" }}
              onClick={() => onOperatorLogin({ code: "ADMIN", name: "Administrador", role: "lider" })}
            >
              Primeiro acesso (cadastrar equipe)
            </button>
          )}

          <div className="br-operator-foot">
            <span><IconCheck size={13} /> Teclado numérico</span>
            <span><IconCheck size={13} /> Acesso protegido</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`st-page ${isAuthenticated ? "st-embedded" : ""}`}>
      {/* ============ HEADER FIXO (STITCH DESIGN SYSTEM) ============ */}
      {!isAuthenticated && (
        <header className="st-header">
          <div className="st-header-inner">
            <a href="#topo" className="st-brand-link">
              <img
                src="/logo-aponta-cd-animado.gif"
                alt="Aponta CD"
                className="st-brand-gif"
              />
              <div className="st-brand-text">
                <span className="st-brand-title">Aponta CD</span>
                <span className="st-brand-sub">Logística Hidráulica</span>
              </div>
            </a>

            <nav className="st-nav" aria-label="Navegação principal">
              <a href="#topo">Início</a>
              <a href="#modulos">Funções &amp; Módulos</a>
              <a href="#sobre-cd">Sobre o CD Hidráulico</a>
              <a href="#mapas-picking">Mapas 2D &amp; 3D Picking</a>
              <a href="#buffer-enderecamento">Buffer &amp; Endereçamento</a>
              <a href="#kpis-equipe">KPIs &amp; Equipe</a>
            </nav>

            <div className="st-header-actions">
              <ThemeToggle compact showColors={false} />
              <a
                href="/tv"
                target="_blank"
                rel="noopener noreferrer"
                className="st-btn-outline st-hide-sm"
              >
                <IconTv size={15} />
                <span>Painel TV</span>
              </a>
              <a
                href="/funcionario"
                className="st-btn-primary"
                onClick={openEmployeeArea}
              >
                <StIcon name="verified_user" size={17} />
                <span>Área do Funcionário</span>
              </a>
            </div>
          </div>
        </header>
      )}

      <main className="st-main">
        {/* ============ HERO SECTION ============ */}
        <section id="topo" className="st-hero">
          <div className="st-hero-glow" aria-hidden="true" />

          <div className="st-status-chip">
            <span className="st-ping-wrap" aria-hidden="true">
              <span className="st-ping-ring" />
              <span className="st-ping-dot" />
            </span>
            <span>
              Logística Especializada em Construção Civil &amp; Hidráulica
              {activeOperatorsCount > 0 ? ` · ${activeOperatorsCount} Operadores Ativos` : ""}
            </span>
          </div>

          <h1 className="st-hero-title">
            O Único Sistema com{" "}
            <span className="st-gradient-text">Controle Absoluto de Atividades</span>,
            Picking 3D e Equipes para seu CD Hidráulico
          </h1>

          <p className="st-hero-subtitle">
            Gerenciamento completo de todas as atividades de um centro de distribuição: produtividade da equipe, KPIs em tempo real, mapas interativos de endereçamento 2D e 3D, buffer inteligente e rastreabilidade total de tubos, conexões PVC, registros e válvulas.
          </p>

          <div className="st-hero-ctas">
            <a
              href="/funcionario"
              className="st-cta-primary"
              onClick={openEmployeeArea}
            >
              <StIcon name="verified_user" size={19} />
              <span>Acessar Área do Funcionário</span>
            </a>

            {isAuthenticated && onOpenMap2D && onOpenMap3D ? (
              <>
                <button type="button" className="st-cta-secondary" onClick={onOpenMap2D}>
                  <StIcon name="grid_view" size={19} />
                  <span>Abrir Mapa 2D</span>
                </button>
                <button type="button" className="st-cta-secondary" onClick={onOpenMap3D}>
                  <StIcon name="view_in_ar" size={19} />
                  <span>Abrir Mapa 3D</span>
                </button>
              </>
            ) : (
              <a href="#mapas-picking" className="st-cta-secondary">
                <StIcon name="view_in_ar" size={19} />
                <span>Conhecer Mapas de Picking</span>
              </a>
            )}
          </div>

          {/* 3 Operational High-Impact Metric Badges */}
          <div className="st-metrics-grid">
            <div className="st-metric-card">
              <div className="st-metric-label">Taxa Mensal Registrada</div>
              <div className="st-metric-value">
                <span>+3.200.000</span>
                <span className="st-metric-unit">itens/mês</span>
              </div>
              <div className="st-metric-desc">Conexões &amp; tubos apontados</div>
            </div>

            <div className="st-metric-card">
              <div className="st-metric-label">Acurácia de Inventário</div>
              <div className="st-metric-value st-emerald">
                <span>99.8%</span>
                <StIcon name="check_circle" size={17} />
              </div>
              <div className="st-metric-desc">Eliminação de furos de estoque</div>
            </div>

            <div className="st-metric-card">
              <div className="st-metric-label">Velocidade de Despacho</div>
              <div className="st-metric-value st-cyan">
                <span>-42%</span>
                <StIcon name="trending_down" size={17} />
              </div>
              <div className="st-metric-desc">Tempo de separação e expedição</div>
            </div>
          </div>

          {/* Main Visual Container (Warehouse Digital Twin) */}
          <div className="st-twin-frame">
            <div className="st-twin-fade" aria-hidden="true" />
            <img
              src="/images/stitch-hero-warehouse.jpg"
              alt="Centro de Distribuição Aponta CD com visualização 3D de ruas, tubos, racks verticais e empilhadeiras em rotas dinâmicas"
              className="st-twin-img"
            />

            {/* Top-left Telemetry */}
            <div className="st-telemetry-tl">
              <span className="st-cyan-dot" aria-hidden="true" />
              <div>
                <div className="st-tel-kicker">Picking Ativo</div>
                <div className="st-tel-val">Rua H-04 • Válvulas PN16</div>
              </div>
            </div>

            {/* Top-right Online Tower */}
            <div className="st-telemetry-tr">
              <StIcon name="sensors" size={15} />
              <span>TORRE LOGÍSTICA ONLINE</span>
            </div>

            {/* Bottom-left Telemetry Cards */}
            <div className="st-telemetry-bl">
              <div className="st-tel-pill">
                <span className="st-tel-icon st-cyan">
                  <StIcon name="inventory" size={20} />
                </span>
                <div>
                  <span className="st-tel-kicker">Buffer PPR/CPVC</span>
                  <div className="st-tel-metric">
                    94% Ocupação <span className="st-emerald st-tel-note">(Estável)</span>
                  </div>
                </div>
              </div>

              <div className="st-tel-pill">
                <span className="st-tel-icon st-primary">
                  <StIcon name="timer" size={20} />
                </span>
                <div>
                  <span className="st-tel-kicker">Apontamento Médio</span>
                  <div className="st-tel-metric st-cyan">14.2s / Conexão</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============ STRATEGIC SECTION: DIAGNÓSTICO DO SETOR ============ */}
        <section id="sobre-cd" className="st-section-alt">
          <div className="st-container">
            <div className="st-section-center">
              <div className="st-badge-cyan">
                <StIcon name="plumbing" size={15} />
                <span>Diagnóstico do Setor</span>
              </div>
              <h2 className="st-h2">
                Por que o Mercado Hidráulico Exige uma Solução Dedicada?
              </h2>
              <p className="st-section-lead">
                Sistemas WMS tradicionais falham ao lidar com as particularidades da engenharia hidráulica: curvatura de tubos, alta densidade volumétrica de miudezas e separação fracionada crítica.
              </p>
            </div>

            <div className="st-split-12">
              <div className="st-photo-card">
                <img
                  src="/images/stitch-hydraulics.jpg"
                  alt="Conexões hidráulicas de latão, registros de esfera, tubos de cobre e conexões em PVC branco sobre bancada industrial"
                  loading="lazy"
                />
                <div className="st-photo-fade" aria-hidden="true" />
                <div className="st-photo-overlay">
                  <div>
                    <div className="st-tel-kicker st-cyan">SKU Catalogado #H-9021</div>
                    <div className="st-photo-title">Válvula de Esfera Latão Forjado DN20 PN25</div>
                  </div>
                  <span className="st-lot-badge">LOTE AP-2025.1</span>
                </div>
              </div>

              <div className="st-compare-col">
                <div className="st-compare-card st-compare-before">
                  <div className="st-compare-head st-error">
                    <StIcon name="cancel" size={19} />
                    <span>Antes: WMS Genérico &amp; Planilhas</span>
                  </div>
                  <ul>
                    <li>Falta de distinção dimensional entre bitolas similares (ex: 20mm vs 25mm e 1/2&quot; vs 3/4&quot;).</li>
                    <li>Armazenagem inadequada de barras de 6 metros gerando gargalos nos corredores de apanhe.</li>
                    <li>Extravios constantes e divergências de peso durante a expedição fracionada para construtoras.</li>
                  </ul>
                </div>

                <div className="st-compare-card st-compare-after">
                  <div className="st-compare-glow" aria-hidden="true" />
                  <div className="st-compare-head st-cyan">
                    <StIcon name="check_circle" size={19} />
                    <span>Com o Aponta CD: Rastreabilidade Total</span>
                  </div>
                  <ul>
                    <li>Auditoria fotográfica e volumétrica no recebimento com validação direta por código de barras e QR.</li>
                    <li>Buffer automatizado e endereçamento inteligente separado por classe de pressão (PN10, PN16, PN25).</li>
                    <li>Roteirização precisa para veículos de carga pesada e operadores com carrinhos de cubagem ajustada.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============ NUCLEAR MODULES BENTO GRID 2x2 ============ */}
        <section id="modulos" className="st-section">
          <div className="st-container">
            <div className="st-mod-head">
              <div>
                <span className="st-kicker-primary">Engenharia Funcional</span>
                <h2 className="st-h2">Módulos de Controle Absoluto</h2>
              </div>
              <p className="st-mod-sub">
                Projetado ponta a ponta para a rotina ininterrupta de galpões logísticos de alto giro na distribuição de materiais hidro-prediais e industriais.
              </p>
            </div>

            <div className="st-bento-grid">
              {MODULES.map((mod) => (
                <article
                  key={mod.id}
                  id={mod.id}
                  className="st-bento-card"
                  onClick={() => handleModuleAction(mod)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleModuleAction(mod);
                    }
                  }}
                >
                  <div>
                    <div className="st-bento-icon">
                      <StIcon name={mod.icon} size={26} />
                    </div>
                    <h3>{mod.title}</h3>
                    <p>{mod.desc}</p>
                  </div>

                  <div className="st-bento-foot">
                    <span className="st-bento-meta">{mod.footerLeft}</span>
                    <span className="st-bento-link">
                      <span>{mod.footerRight}</span>
                      <StIcon name="arrow_forward" size={15} />
                    </span>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ============ QUICK ACCESS: EMPLOYEE WORKSPACE BANNER ============ */}
        <section className="st-banner-wrap">
          <div className="st-container">
            <div className="st-emp-banner">
              <div className="st-emp-left">
                <div className="st-emp-icon">
                  <StIcon name="terminal" size={32} />
                </div>
                <div>
                  <span className="st-kicker-cyan">Terminal do Colaborador</span>
                  <h4>Área do Funcionário &amp; Coletores Rugged</h4>
                  <p>
                    Acesso rápido otimizado para coletores Zebra, Honeywell e tablets de empilhadeira. Login seguro com código numérico ou crachá.
                  </p>
                </div>
              </div>

              <a
                href="/funcionario"
                className="st-btn-cyan"
                onClick={openEmployeeArea}
              >
                <span>Ir para Área do Funcionário</span>
                <StIcon name="arrow_forward" size={17} />
              </a>
            </div>
          </div>
        </section>

        {/* ============ FINAL CTA ============ */}
        <section className="st-section st-final-cta">
          <div className="st-container st-final-inner">
            <div className="st-rocket-badge">
              <StIcon name="rocket" size={28} />
            </div>
            <h2 className="st-final-title">
              Pronto para Elevar a Eficiência do seu CD Hidráulico?
            </h2>
            <p className="st-final-sub">
              Reduza erros de separação a praticamente zero, acompanhe o turno em tempo real e obtenha visibilidade 2D &amp; 3D instantânea do galpão.
            </p>
            <div className="st-final-actions">
              <a
                href="/funcionario"
                className="st-cta-primary st-cta-lg"
                onClick={openEmployeeArea}
              >
                <span>Acessar Área do Funcionário</span>
                <StIcon name="arrow_forward" size={17} />
              </a>
              <a
                href="/tv"
                target="_blank"
                rel="noopener noreferrer"
                className="st-cta-secondary st-cta-lg"
              >
                <IconTv size={17} />
                <span>Abrir Painel TV ao Vivo</span>
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* ============ FOOTER (STITCH 5-COLUMN + CONNECTIVITY BAR) ============ */}
      <footer className="st-footer">
        <div className="st-footer-inner">
          <div className="st-footer-grid">
            <div className="st-footer-brand">
              <div className="st-brand-link" style={{ marginBottom: 12 }}>
                <img
                  src="/logo-aponta-cd-animado.gif"
                  alt="Aponta CD"
                  className="st-brand-gif st-brand-gif-sm"
                />
                <span className="st-brand-title">Aponta CD</span>
              </div>
              <p>
                Plataforma integrada de inteligência e controle de armazenagem especializada no ecossistema de materiais hidráulicos para construção civil: tubos, conexões, registros e válvulas de alto calibre.
              </p>
              <div className="st-footer-badges">
                <span className="st-version-pill">
                  <span className="st-cyan-dot" aria-hidden="true" />
                  <span>Sistema Operacional v3.8</span>
                </span>
                <span className="st-iso-note">Offline-first • WMS Grade</span>
              </div>
            </div>

            <div className="st-footer-col">
              <span className="st-footer-heading">Navegação do CD</span>
              <a href="#topo">Início Geral</a>
              <a href="#modulos">Módulos de Separação</a>
              <a href="#mapas-picking">Roteirização 2D/3D</a>
              <a href="#buffer-enderecamento">Pulmão &amp; Buffer A-Z</a>
              <a href="#kpis-equipe">Painel de Produtividade</a>
            </div>

            <div className="st-footer-col">
              <span className="st-footer-heading">Engenharia &amp; Setor</span>
              <span>Tubulações PVC, CPVC &amp; PPR</span>
              <span>Sistemas de Cobre &amp; Ferro Galvanizado</span>
              <span>Conexões de Grande Porte &amp; Valvulários</span>
              <span>Auditoria de Racks &amp; Carga Viva</span>
              <a href="#sobre-cd" className="st-link-cyan">Especificações Técnicas</a>
            </div>

            <div className="st-footer-col">
              <span className="st-footer-heading">Central Operacional</span>
              <div className="st-footer-meta-item">
                <StIcon name="support" size={15} className="st-cyan" />
                <span>Suporte Torre 24/7</span>
              </div>
              <div className="st-footer-meta-item">
                <StIcon name="hub" size={15} className="st-cyan" />
                <span>Integração ERP/WMS Nativa</span>
              </div>
              <div className="st-footer-meta-item">
                <IconLock size={15} />
                <span>Acesso Restrito por Perfil</span>
              </div>
              <a
                href="/funcionario"
                className="st-footer-terminal"
                onClick={openEmployeeArea}
              >
                Terminal Operacional →
              </a>
            </div>
          </div>

          <div className="st-footer-bottom">
            <div className="st-connectivity">
              <span className="st-cyan-dot" aria-hidden="true" />
              <strong>Status de Conectividade:</strong>
              <span className="st-conn-ok">Todos os nós operacionais (Sincronia em tempo real)</span>
            </div>

            <div className="st-footer-legal">
              <a href="/tv" target="_blank" rel="noopener noreferrer">Painel TV</a>
              <a href="/funcionario" onClick={openEmployeeArea}>Área do Funcionário</a>
              <a href="#topo">Voltar ao topo ↑</a>
            </div>

            <div className="st-copyright">
              © {currentYear} Aponta CD Logística Hidráulica. Todos os direitos reservados.
            </div>
          </div>
        </div>
      </footer>

      {/* ============ MODAL ÁREA DO FUNCIONÁRIO (CÓDIGO + SENHA) ============ */}
      {isOperatorGate && authModalOpen && (
        <div className="br-modal-backdrop" onClick={() => setAuthModalOpen(false)}>
          <div
            className={`br-modal-card ${shake ? "shake" : ""}`}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="employee-modal-title"
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <BrandMark variant="lockup" />
              <button
                type="button"
                className="br-modal-close"
                onClick={() => setAuthModalOpen(false)}
                aria-label="Fechar"
              >
                ×
              </button>
            </div>

            <div className="br-operator-head" style={{ marginBottom: 18 }}>
              <div className="br-operator-icon">
                <IconLock size={18} />
              </div>
              <div>
                <h2 id="employee-modal-title">Área do Funcionário</h2>
                <p>Informe seu código e sua senha para acessar</p>
              </div>
            </div>

            <form onSubmit={handleCodeSubmit} autoComplete="off" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label className="br-field-label" htmlFor="emp-code">Código do funcionário</label>
                <input
                  id="emp-code"
                  name="aponta_emp_code_guard"
                  ref={inputRef}
                  type="text"
                  inputMode="numeric"
                  className="br-code-input"
                  placeholder="Ex.: 101"
                  value={code}
                  readOnly={!empFieldsUnlocked}
                  onFocus={() => setEmpFieldsUnlocked(true)}
                  onPointerDown={() => setEmpFieldsUnlocked(true)}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val.includes("@")) return;
                    setCodeError("");
                    setCode(val);
                  }}
                  autoComplete="off"
                  data-lpignore="true"
                  data-1p-ignore="true"
                  data-form-type="other"
                />
              </div>

              <div>
                <label className="br-field-label" htmlFor="emp-pass">Senha</label>
                <div style={{ position: "relative" }}>
                  <input
                    id="emp-pass"
                    name="aponta_emp_pass_guard"
                    type={showPass ? "text" : "password"}
                    inputMode="numeric"
                    className="br-code-input"
                    style={{ paddingRight: 78 }}
                    placeholder="••••"
                    value={password}
                    readOnly={!empFieldsUnlocked}
                    onFocus={() => setEmpFieldsUnlocked(true)}
                    onPointerDown={() => setEmpFieldsUnlocked(true)}
                    onChange={(e) => {
                      setCodeError("");
                      setPassword(e.target.value);
                    }}
                    autoComplete="new-password"
                    data-lpignore="true"
                    data-1p-ignore="true"
                    data-form-type="other"
                  />
                  <button
                    type="button"
                    className="br-pass-toggle"
                    onClick={() => setShowPass((v) => !v)}
                  >
                    {showPass ? "OCULTAR" : "VER"}
                  </button>
                </div>
                <div style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 5 }}>
                  Primeiro acesso: use os números do seu próprio código como senha.
                </div>
              </div>

              {codeError && (
                <div className="login-error" role="alert" style={{ margin: 0 }}>
                  {codeError}
                </div>
              )}

              <button type="submit" className="br-submit-btn" style={{ marginTop: 4 }}>
                <span>Entrar no sistema</span>
                <IconChevronRight size={16} />
              </button>
            </form>

            {activeOperatorsCount === 0 && onOperatorLogin && (
              <button
                type="button"
                className="btn-small"
                style={{ width: "100%", marginTop: 12, justifyContent: "center" }}
                onClick={() => {
                  setAuthModalOpen(false);
                  onOperatorLogin({ code: "ADMIN", name: "Administrador", role: "lider" });
                }}
              >
                Primeiro acesso (cadastrar equipe)
              </button>
            )}

            <div className="br-operator-foot">
              <span><IconCheck size={13} /> Teclado numérico</span>
              <span><IconCheck size={13} /> Acesso protegido</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
