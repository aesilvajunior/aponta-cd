import React, { useEffect, useRef, useState } from "react";
import ThemeToggle from "./ThemeToggle";
import BrandMark from "./BrandMark";
import AnimatedLogoHero from "./AnimatedLogoHero";
import { Accordion } from "./ui/Accordion";
import {
  IconTv,
  IconChevronRight,
  IconLock,
  IconCheck,
} from "./Icons";

const SELECTED_MODULES = [
  {
    id: "map3d",
    index: "01",
    title: "Mapa 2D & 3D em 360°",
    category: "Espacial · 2D ↔ 3D · Rotação livre · Múltiplos andares",
    year: "2026",
    image: "/images/showcase-map3d.jpg",
    alt: "Visualização isométrica 3D do centro de distribuição no Aponta CD",
    wide: true,
    action: "map3d",
  },
  {
    id: "kiosk",
    index: "02",
    title: "Apontamento & Conferência",
    category: "Piso & Docas · Offline-first · Teclado numérico",
    year: "2026",
    image: "/images/showcase-kiosk.jpg",
    alt: "Terminal de apontamento operacional por código no Aponta CD",
    wide: false,
    action: "employee",
  },
  {
    id: "labels",
    index: "03",
    title: "Endereçamento & Etiquetas CD",
    category: "Padrão 1C1105EA · Térmica & A4 · Paridade automática",
    year: "2026",
    image: "/images/showcase-labels.jpg",
    alt: "Gerador de etiquetas de endereço compacto 1C1105EA com QR Code",
    wide: false,
    action: "employee",
  },
  {
    id: "analytics",
    index: "04",
    title: "Curva ABC, Slotting & Turnos",
    category: "Inteligência · Heatmap · Manhã vs. Tarde · Projeção 7d",
    year: "2026",
    image: "/images/showcase-analytics.jpg",
    alt: "Painel executivo de Curva ABC, produtividade por turno e mapa de calor",
    wide: true,
    action: "tv",
  },
];

const CAPABILITIES = [
  {
    code: "01",
    title: "Apontamento & Conferência",
    desc: "Registro de atividades em segundos por código numérico ou leitor de código de barras, com fila de conferência e operação contínua mesmo sem internet no galpão.",
    tags: ["Offline-first", "Teclado numérico", "Fila segura"],
  },
  {
    code: "02",
    title: "Gêmeo Digital 2D & 3D",
    desc: "Planta interativa sincronizada em tempo real. Posicione, redimensione e rotacione prateleiras, docas, escadas, elevadores e múltiplos pavimentos de 0° a 360°.",
    tags: ["Sincronia 2D ↔ 3D", "Rotação 360°", "Histórico"],
  },
  {
    code: "03",
    title: "Endereçamento & Etiquetas",
    desc: "Geração em lote no padrão compacto 1C1105EA, classificação automática de lado par (direito) e ímpar (esquerdo) e QR Codes prontos para impressão térmica ou A4.",
    tags: ["1C1105EA", "Térmica & A4", "Paridade automática"],
  },
  {
    code: "04",
    title: "Curva ABC, Slotting & Auditoria",
    desc: "Mapa de calor para aproximar itens de alto giro da expedição, comparativo Manhã vs. Tarde, checklist de abertura/fechamento, pausas e exportação executiva.",
    tags: ["Curva ABC", "Painel TV", "Excel · CSV · PDF"],
  },
];

const WORKFLOW_STEPS = [
  {
    num: "01",
    title: "Identificação no turno",
    desc: "O colaborador informa seu código numérico e senha. O sistema libera imediatamente apenas as telas da sua função.",
    detail: "Acesso individual por perfil",
  },
  {
    num: "02",
    title: "Execução sem interrupção",
    desc: "Apontamentos, conferência e inventário cíclico continuam operando se o Wi-Fi oscilar, subindo automaticamente ao reconectar.",
    detail: "Fila offline sincronizada",
  },
  {
    num: "03",
    title: "Espaço sincronizado 2D ↔ 3D",
    desc: "Consulte qualquer endereço no mapa 2D ou 3D. Administradores reorganizam corredores, docas e andares com histórico completo.",
    detail: "Rotação 0° a 360°",
  },
  {
    num: "04",
    title: "Visibilidade para líderes e TV",
    desc: "Acompanhe metas, faltas, turnos e produtividade ao vivo no painel de gestão ou em modo TV dedicado no galpão.",
    detail: "Atualização em tempo real",
  },
];

const MARQUEE_ITEMS = [
  "APONTAMENTO POR CÓDIGO",
  "PLANTA 2D & 3D 360°",
  "CURVA ABC & SLOTTING",
  "ETIQUETAS 1C1105EA",
  "CONFERÊNCIA DE DOCAS",
  "PAINEL TV AO VIVO",
  "OFFLINE-FIRST",
  "AUDITORIA OPERACIONAL",
];

const FAQ_ITEMS = [
  {
    question: "Como acesso as funcionalidades do Aponta CD?",
    answer:
      "Clique em 'Área do Funcionário' no topo da página e informe seu código e sua senha (no primeiro acesso, use os números do seu próprio código). As telas e o menu lateral são liberados imediatamente conforme o seu perfil.",
  },
  {
    question: "Posso editar e girar objetos nos mapas 2D e 3D?",
    answer:
      "Todos os colaboradores podem consultar e pesquisar produtos nos mapas 2D e 3D. Já o Modo Edição (criar, mover, redimensionar, girar em 0°–360° e criar andares) e o Histórico do Mapa são exclusivos do perfil Administrador.",
  },
  {
    question: "Como funcionam as etiquetas de endereço do CD?",
    answer:
      "O gerador suporta tanto áreas do mapa quanto o padrão compacto do CD (ex.: 1C1105EA), aplicando automaticamente lado par = direito e lado ímpar = esquerdo.",
  },
  {
    question: "O sistema continua funcionando se a internet cair no galpão?",
    answer:
      "Sim. Os apontamentos e pausas são armazenados localmente em uma fila segura e sincronizados automaticamente com o servidor assim que a conexão for restabelecida.",
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

  function handleModuleClick(mod) {
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
    <div className={`bb-page ${isAuthenticated ? "bb-embedded" : ""}`}>
      {/* ============ MINIMAL STICKY HEADER (BERRIEL ARCHITECTURE) ============ */}
      {!isAuthenticated && (
        <header className="bb-nav">
          <div className="bb-container bb-nav-inner">
            <a href="/" className="bb-wordmark-link" aria-label="Aponta CD — Início">
              <span className="bb-wordmark-main">aponta</span>
              <span className="bb-wordmark-accent">cd</span>
              <span className="bb-wordmark-dot">.</span>
              <sup className="bb-wordmark-reg">®</sup>
            </a>

            <nav className="bb-nav-links" aria-label="Navegação principal">
              <a href="#modulos">módulos</a>
              <a href="#plataforma">plataforma</a>
              <a href="#fluxo">fluxo</a>
              <a href="#duvidas">dúvidas</a>
              <a href="/tv" target="_blank" rel="noopener noreferrer" className="bb-nav-tv-link">
                painel tv ↗
              </a>
            </nav>

            <div className="bb-nav-actions">
              <ThemeToggle compact showColors={false} />
              <a
                href="/funcionario"
                className="bb-pill-cta"
                onClick={openEmployeeArea}
              >
                <span>Área do Funcionário</span>
                <span className="bb-arrow" aria-hidden="true">↗</span>
              </a>
            </div>
          </div>
        </header>
      )}

      {/* ============ MONUMENTAL SWISS EDITORIAL HERO ============ */}
      <section id="topo" className="bb-container bb-hero">
        <div className="bb-meta-strip">
          <span className="bb-meta-left">
            <span className="bb-live-dot" aria-hidden="true" />
            <span>APONTA CD® — SISTEMA OPERACIONAL LOGÍSTICO</span>
          </span>
          <span className="bb-meta-right">
            {activeOperatorsCount > 0
              ? `${String(activeOperatorsCount).padStart(2, "0")} OPERADORES ATIVOS · ${currentYear}`
              : `2D & 3D · OFFLINE-FIRST · ${currentYear}`}
          </span>
        </div>

        <h1 className="bb-display">
          <span className="bb-line-mask">
            <span className="bb-line-inner" style={{ animationDelay: "40ms" }}>
              Operação precisa,
            </span>
          </span>
          <span className="bb-line-mask">
            <span className="bb-line-inner" style={{ animationDelay: "140ms" }}>
              do piso ao <em className="bb-display-accent">mapa 3D.</em>
            </span>
          </span>
        </h1>

        <div className="bb-hero-subbar">
          <p className="bb-hero-statement">
            Apontamento por código, conferência, planta 2D e 3D em 360°, etiquetas no padrão{" "}
            <code>1C1105EA</code> e indicadores de turno desenhados para clareza absoluta.
          </p>

          <div className="bb-hero-actions">
            <a
              href="/funcionario"
              className="bb-pill-cta bb-pill-lg"
              onClick={openEmployeeArea}
            >
              <span>Área do Funcionário</span>
              <span className="bb-arrow" aria-hidden="true">↗</span>
            </a>

            {isAuthenticated && onOpenMap2D && onOpenMap3D ? (
              <>
                <button type="button" className="bb-text-link" onClick={onOpenMap2D}>
                  Abrir Mapa 2D ↗
                </button>
                <button type="button" className="bb-text-link" onClick={onOpenMap3D}>
                  Abrir Mapa 3D ↗
                </button>
              </>
            ) : (
              <a
                href="/tv"
                target="_blank"
                rel="noopener noreferrer"
                className="bb-text-link"
              >
                <IconTv size={14} />
                <span>Painel TV ao vivo ↗</span>
              </a>
            )}
          </div>
        </div>

        {/* Full-Width Architectural Showcase Stage (Animated Brand Reel) */}
        <div className="bb-hero-reel">
          <div className="bb-reel-chrome bb-reel-top">
            <span>00 / IDENTIDADE OPERACIONAL</span>
            <span>CLIQUE NA CENA PARA REVER</span>
          </div>
          <div className="bb-reel-center">
            <AnimatedLogoHero />
          </div>
          <div className="bb-reel-chrome bb-reel-bottom">
            <span>PLANTA 2D ↔ 3D · 0°–360°</span>
            <span>OFFLINE-FIRST · TEMPO REAL</span>
          </div>
        </div>
      </section>

      {/* ============ HAIRLINE EDITORIAL MARQUEE ============ */}
      <div className="bb-marquee" aria-hidden="true">
        <div className="bb-marquee-track">
          {[...MARQUEE_ITEMS, ...MARQUEE_ITEMS].map((item, idx) => (
            <span key={idx} className="bb-marquee-item">
              <span>{item}</span>
              <span className="bb-marquee-sep">/</span>
            </span>
          ))}
        </div>
      </div>

      {/* ============ SELECTED MODULES (BERRIEL 2-COL EDITORIAL PORTFOLIO GRID) ============ */}
      <section id="modulos" className="bb-container bb-section">
        <div className="bb-section-header">
          <div className="bb-section-title-wrap">
            <span className="bb-kicker">01 / MÓDULOS EM DESTAQUE</span>
            <h2 className="bb-h2">Módulos selecionados</h2>
          </div>
          <div className="bb-section-right">
            <span className="bb-count">(04)</span>
            <p className="bb-section-caption">
              Sistemas construídos para eliminar ruído na rotina do centro de distribuição — da doca à leitura executiva.
            </p>
          </div>
        </div>

        <div className="bb-work-grid">
          {SELECTED_MODULES.map((mod) => (
            <article
              key={mod.id}
              className={`bb-work-card ${mod.wide ? "bb-work-wide" : ""}`}
              onClick={() => handleModuleClick(mod)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleModuleClick(mod);
                }
              }}
            >
              <div className="bb-work-media">
                <img src={mod.image} alt={mod.alt} loading="lazy" />
                <span className="bb-work-badge">{mod.index}</span>
              </div>

              <div className="bb-work-info">
                <div className="bb-work-top">
                  <h3>{mod.title}</h3>
                  <span className="bb-work-arrow" aria-hidden="true">↗</span>
                </div>
                <div className="bb-work-meta">
                  <span>{mod.category}</span>
                  <span>{mod.year}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ============ ABOUT / PLATFORM CAPABILITIES (STICKY SPLIT) ============ */}
      <section id="plataforma" className="bb-container bb-section bb-section-ruled">
        <div className="bb-about-grid">
          <div className="bb-about-sticky">
            <span className="bb-kicker">02 / A PLATAFORMA</span>
            <h2 className="bb-h2 bb-about-headline">
              Minimalismo operacional que entrega precisão em cada turno.
            </h2>
            <p className="bb-about-body">
              Combinamos apontamento instantâneo, mapeamento espacial 2D/3D e inteligência de curva ABC em uma interface silenciosa, rápida e feita para o chão de galpão.
            </p>

            <div className="bb-about-stats">
              <div>
                <strong>2D ↔ 3D</strong>
                <span>Sincronia real</span>
              </div>
              <div>
                <strong>0°–360°</strong>
                <span>Rotação livre</span>
              </div>
              <div>
                <strong>100%</strong>
                <span>Offline-first</span>
              </div>
            </div>
          </div>

          <div className="bb-cap-list">
            {CAPABILITIES.map((cap) => (
              <div key={cap.code} className="bb-cap-row">
                <div className="bb-cap-num">{cap.code}</div>
                <div className="bb-cap-content">
                  <h3>{cap.title}</h3>
                  <p>{cap.desc}</p>
                  <div className="bb-cap-tags">
                    {cap.tags.map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ WORKFLOW / PROCESS (4-COL SWISS HAIRLINE GRID) ============ */}
      <section id="fluxo" className="bb-container bb-section bb-section-ruled">
        <div className="bb-section-header">
          <div className="bb-section-title-wrap">
            <span className="bb-kicker">03 / FLUXO DO TURNO</span>
            <h2 className="bb-h2">Quatro etapas. Zero atrito.</h2>
          </div>
          <div className="bb-section-right">
            <span className="bb-count">(04)</span>
            <p className="bb-section-caption">
              Piso, conferência, estoque e liderança olhando para os mesmos dados em tempo real.
            </p>
          </div>
        </div>

        <div className="bb-process-grid">
          {WORKFLOW_STEPS.map((step) => (
            <div key={step.num} className="bb-process-card">
              <div className="bb-process-num">{step.num}</div>
              <h3>{step.title}</h3>
              <p>{step.desc}</p>
              <span className="bb-process-detail">{step.detail}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ============ FAQ (ASYMMETRIC SPLIT) ============ */}
      <section id="duvidas" className="bb-container bb-section bb-section-ruled">
        <div className="bb-faq-grid">
          <div className="bb-faq-sticky">
            <span className="bb-kicker">04 / DÚVIDAS</span>
            <h2 className="bb-h2">Perguntas frequentes.</h2>
            <p className="bb-about-body">
              Primeiro acesso? Utilize os números do seu próprio código de funcionário como senha inicial.
            </p>
          </div>

          <div className="bb-faq-list">
            <Accordion items={FAQ_ITEMS} defaultOpen={[0]} />
          </div>
        </div>
      </section>

      {/* ============ CLOSING "LET'S TALK" EDITORIAL CTA ============ */}
      <section className="bb-container bb-section bb-section-ruled bb-cta-section">
        <span className="bb-kicker">ACESSO OPERACIONAL</span>
        <h2 className="bb-cta-display">
          Pronto para iniciar
          <br />o próximo turno?
        </h2>
        <div className="bb-cta-actions">
          <a
            href="/funcionario"
            className="bb-pill-cta bb-pill-xl"
            onClick={openEmployeeArea}
          >
            <span>Área do Funcionário</span>
            <span className="bb-arrow" aria-hidden="true">↗</span>
          </a>
          <a
            href="/tv"
            target="_blank"
            rel="noopener noreferrer"
            className="bb-pill-outline bb-pill-xl"
          >
            <span>Abrir Painel TV</span>
            <span className="bb-arrow" aria-hidden="true">↗</span>
          </a>
        </div>
      </section>

      {/* ============ MONUMENTAL BERRIEL FOOTER ============ */}
      <footer className="bb-footer">
        <div className="bb-container">
          <div className="bb-footer-top">
            <div className="bb-footer-col bb-footer-about">
              <div className="bb-footer-label">APONTA CD</div>
              <p>
                Plataforma independente de apontamento operacional, planta 2D/3D e inteligência logística para centros de distribuição.
              </p>
            </div>

            <div className="bb-footer-col">
              <div className="bb-footer-label">NAVEGAÇÃO</div>
              <a href="#modulos">Módulos</a>
              <a href="#plataforma">Plataforma</a>
              <a href="#fluxo">Fluxo</a>
              <a href="#duvidas">Dúvidas</a>
            </div>

            <div className="bb-footer-col">
              <div className="bb-footer-label">ACESSO</div>
              <a href="/funcionario" onClick={openEmployeeArea}>
                Área do Funcionário ↗
              </a>
              <a href="/tv" target="_blank" rel="noopener noreferrer">
                Painel TV ao vivo ↗
              </a>
              <a href="#topo">Voltar ao topo ↑</a>
            </div>

            <div className="bb-footer-col">
              <div className="bb-footer-label">ARQUITETURA</div>
              <span>Planta 2D & 3D 360°</span>
              <span>Fila Offline-first</span>
              <span>Padrão 1C1105EA</span>
            </div>
          </div>

          <div className="bb-footer-giant" aria-hidden="true">
            aponta<span className="bb-display-accent">cd</span>.<sup>®</sup>
          </div>

          <div className="bb-footer-bottom">
            <span>© {currentYear} Aponta CD</span>
            <span>SISTEMA OPERACIONAL LOGÍSTICO · TEMPO REAL</span>
            <a href="#topo">Topo ↑</a>
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
