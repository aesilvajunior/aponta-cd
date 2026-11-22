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

const MARQUEE_ITEMS = [
  "MAPA 2D & 3D 360°",
  "APONTAMENTO POR CÓDIGO",
  "CURVA ABC & SLOTTING",
  "ETIQUETAS 1C1105EA",
  "CHECKLIST DO CD",
  "DETECÇÃO DE FRAUDE",
  "MODO OFFLINE",
  "PAINEL TV AO VIVO",
];

const SHOWCASE_MODULES = [
  {
    index: "01",
    tag: "ESPACIAL · 2D & 3D",
    title: "Gêmeo digital do galpão em 360°",
    desc: "Modele e reorganize toda a planta do centro de distribuição em tempo real. Posicione, redimensione e rotacione prateleiras, escadas, elevadores, mesas de conferência, carros de apoio, salas e múltiplos andares com sincronia instantânea entre 2D e 3D.",
    tone: "cobalt",
    art: "map",
    image: "/images/showcase-map3d.jpg",
    wide: true,
  },
  {
    index: "02",
    tag: "PRODUTIVIDADE NO TURNO",
    title: "Apontamento ágil & Conferência",
    desc: "Elimine gargalos no chão de fábrica com registro de atividades em um clique, leitura por código de barras, controle de fila de conferência e operação contínua mesmo sem conexão à internet.",
    tone: "obsidian",
    art: "kiosk",
    image: "/images/showcase-kiosk.jpg",
  },
  {
    index: "03",
    tag: "RASTREABILIDADE",
    title: "Endereçamento & Etiquetas CD",
    desc: "Padronize o estoque com geração em lote de etiquetas no formato 1C1105EA, classificação automática de corredores pares e ímpares e QR Codes prontos para impressão térmica ou A4.",
    tone: "slate",
    art: "labels",
    image: "/images/showcase-labels.jpg",
  },
  {
    index: "04",
    tag: "INTELIGÊNCIA LOGÍSTICA",
    title: "Slotting Curva ABC & Turnos",
    desc: "Identifique itens de alto giro distantes da expedição pelo mapa de calor, compare o desempenho entre os turnos Manhã e Tarde e antecipe picos de demanda com projeção de 7 dias.",
    tone: "cyan",
    art: "slotting",
    image: "/images/showcase-analytics.jpg",
  },
  {
    index: "05",
    tag: "CONTROLE & AUDITORIA",
    title: "Checklist, Pausas & Detecção de Fraude",
    desc: "Assegure conformidade na abertura e fechamento do CD, monitore pausas operacionais, detecte anomalias automaticamente e exporte relatórios executivos em Excel, CSV, JSON ou PDF.",
    tone: "ink",
    art: "audit",
  },
];

const PROCESS_STEPS = [
  {
    num: "01",
    title: "Acesso individual por código",
    desc: "O colaborador digita seu código na página inicial — via teclado numérico ou toque — e o sistema libera apenas as ferramentas da sua função.",
    stat: "2s",
    statLabel: "Login no turno",
    lit: [0, 1, 2, 5, 6],
  },
  {
    num: "02",
    title: "Layout sincronizado 2D ↔ 3D",
    desc: "Arraste, crie andares e gire qualquer objeto de 0° a 360°. Toda alteração no Mapa 2D reflete instantaneamente no Mapa 3D.",
    stat: "360°",
    statLabel: "Rotação livre",
    lit: [4, 5, 6, 9, 10, 11],
  },
  {
    num: "03",
    title: "Rastreabilidade de ponta a ponta",
    desc: "Bipe endereços, produtos e inventário cíclico mesmo se a rede oscilar. Tudo fica salvo na fila offline e sobe automaticamente.",
    stat: "100%",
    statLabel: "Offline-first",
    lit: [7, 8, 12, 13, 14],
  },
  {
    num: "04",
    title: "Visibilidade para líderes e TV",
    desc: "Acompanhe metas, faltas, turnos e produtividade ao vivo no painel de gestão ou em modo TV no galpão.",
    stat: "LIVE",
    statLabel: "Tempo real",
    lit: [2, 3, 6, 10, 11, 14, 15],
  },
];

const FAQ_ITEMS = [
  {
    question: "Como acesso as funcionalidades do Aponta CD?",
    answer:
      "Clique no botão 'Área do Funcionário' no topo desta página e informe seu código e sua senha (no primeiro acesso, use os números do seu próprio código). As telas e o menu lateral são liberados imediatamente conforme o seu perfil.",
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
];

function EditorialModuleArt({ kind }) {
  if (kind === "map") {
    return (
      <svg viewBox="0 0 420 210" className="berriel-art-svg" aria-hidden="true">
        <defs>
          <pattern id="br-grid" width="24" height="24" patternUnits="userSpaceOnUse">
            <path d="M 24 0 L 0 0 0 24" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="420" height="210" fill="url(#br-grid)" />
        {/* Minimal Swiss isometric floorplan */}
        <g transform="translate(210, 112)">
          <polygon points="0,78 -148,4 0,-70 148,4" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.28)" strokeWidth="1.2" />
          <g className="iso-float-slow">
            <polygon points="-44,-10 -84,-30 -44,-50 -4,-30" fill="#38bdf8" />
            <polygon points="-44,18 -84,-2 -84,-30 -44,-10" fill="#0284c7" />
            <polygon points="-44,18 -4,-2 -4,-30 -44,-10" fill="#1d4ed8" />
          </g>
          <g className="iso-float-delay">
            <polygon points="36,-22 -4,-42 36,-62 76,-42" fill="#ffffff" />
            <polygon points="36,8 -4,-12 -4,-42 36,-22" fill="#cbd5e1" />
            <polygon points="36,8 76,-12 76,-42 36,-22" fill="#94a3b8" />
          </g>
          <g className="iso-float-subtle">
            <polygon points="22,36 -18,16 22,-4 62,16" fill="#22d3ee" />
            <polygon points="22,56 -18,36 -18,16 22,36" fill="#0891b2" />
            <polygon points="22,56 62,36 62,16 22,36" fill="#16336e" />
          </g>
          <path d="M-84,8 L22,56 L108,12" fill="none" stroke="#38bdf8" strokeWidth="2.2" strokeDasharray="6 6" className="iso-flow-path" />
          <circle cx="-84" cy="8" r="4" fill="#fff" className="iso-pulse-dot" />
          <circle cx="108" cy="12" r="4" fill="#38bdf8" className="iso-pulse-dot" />
        </g>
      </svg>
    );
  }
  if (kind === "kiosk") {
    return (
      <svg viewBox="0 0 280 180" className="berriel-art-svg" aria-hidden="true">
        <rect x="44" y="28" width="192" height="124" rx="14" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.22)" />
        <rect x="64" y="48" width="152" height="28" rx="7" fill="rgba(56,189,248,0.18)" stroke="rgba(56,189,248,0.55)" />
        <text x="140" y="67" textAnchor="middle" fill="#e0f2fe" fontSize="13" fontFamily="monospace" fontWeight="700" letterSpacing="4">1042</text>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <rect
            key={i}
            x={64 + (i % 3) * 53}
            y={88 + Math.floor(i / 3) * 26}
            width="45"
            height="19"
            rx="5"
            fill={i === 5 ? "#0ea5c6" : "rgba(255,255,255,0.12)"}
          />
        ))}
      </svg>
    );
  }
  if (kind === "labels") {
    return (
      <svg viewBox="0 0 280 180" className="berriel-art-svg" aria-hidden="true">
        <g className="iso-float-subtle">
          <rect x="46" y="34" width="188" height="112" rx="12" fill="rgba(255,255,255,0.95)" />
          <text x="64" y="64" fill="#0f172a" fontSize="18" fontFamily="monospace" fontWeight="800">1C1105EA</text>
          <text x="64" y="82" fill="#0284c7" fontSize="10" fontFamily="sans-serif" fontWeight="700">ÍMPAR · LADO ESQUERDO</text>
          <rect x="64" y="96" width="94" height="32" rx="4" fill="#0f172a" opacity="0.08" />
          {[0, 4, 9, 12, 18, 22, 27, 33, 38, 44, 50, 56, 61, 68, 74, 80].map((x, idx) => (
            <rect key={idx} x={70 + x} y="102" width={idx % 3 === 0 ? 3 : 1.8} height="20" fill="#0f172a" />
          ))}
          <rect x="174" y="88" width="42" height="42" rx="4" fill="#0f172a" />
          <rect x="180" y="94" width="12" height="12" fill="#fff" />
          <rect x="198" y="94" width="12" height="12" fill="#fff" />
          <rect x="180" y="112" width="12" height="12" fill="#fff" />
          <rect x="198" y="112" width="12" height="12" fill="#38bdf8" />
        </g>
      </svg>
    );
  }
  if (kind === "slotting") {
    return (
      <svg viewBox="0 0 280 180" className="berriel-art-svg" aria-hidden="true">
        {[
          { x: 48, h: 42, c: "rgba(255,255,255,0.28)" },
          { x: 84, h: 68, c: "rgba(255,255,255,0.45)" },
          { x: 120, h: 96, c: "#38bdf8" },
          { x: 156, h: 118, c: "#ffffff" },
          { x: 192, h: 82, c: "rgba(255,255,255,0.6)" },
        ].map((b, i) => (
          <rect key={i} x={b.x} y={148 - b.h} width="24" height={b.h} rx="6" fill={b.c} className={i === 3 ? "iso-float-subtle" : undefined} />
        ))}
        <path d="M56,112 Q128,44 208,60" fill="none" stroke="#38bdf8" strokeWidth="2.5" strokeDasharray="5 5" className="iso-flow-path" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 280 180" className="berriel-art-svg" aria-hidden="true">
      <circle cx="140" cy="90" r="54" fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth="1.5" />
      <circle cx="140" cy="90" r="36" fill="none" stroke="rgba(56,189,248,0.45)" strokeWidth="1.5" strokeDasharray="6 6" className="iso-flow-path" />
      <circle cx="140" cy="90" r="16" fill="#0ea5c6" className="iso-pulse-dot" />
      <polyline points="133,90 138,95 148,85" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function LandingPage({
  mode = "auth", // "auth" | "operator" | "authenticated"
  operators = [],
  currentOperator = null,
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
  const [activeStep, setActiveStep] = useState(0);
  const [heroScrollFade, setHeroScrollFade] = useState(0);
  const inputRef = useRef(null);
  const pageRef = useRef(null);

  const isOperatorGate = mode === "operator";

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

  // Efeito fade sutil apenas no palco do logo ao rolar (nunca desfoca o título ou login)
  useEffect(() => {
    const scroller = pageRef.current;
    if (!scroller || isAuthenticated) return undefined;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        const progress = Math.max(0, Math.min(1, (scroller.scrollTop - 120) / 360));
        setHeroScrollFade(progress);
      });
    };
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      scroller.removeEventListener("scroll", onScroll);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [isAuthenticated]);

  // Berriel-style smooth quartic scroll-reveal observer
  useEffect(() => {
    const rootEl = pageRef.current;
    if (!rootEl) return undefined;
    const targets = rootEl.querySelectorAll(".br-reveal");
    if (typeof IntersectionObserver === "undefined") {
      targets.forEach((el) => el.classList.add("is-visible"));
      return undefined;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        });
      },
      { root: isAuthenticated ? null : rootEl, threshold: 0.1 }
    );
    targets.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [isAuthenticated]);

  function handleSpotlight(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", `${e.clientX - rect.left}px`);
    e.currentTarget.style.setProperty("--my", `${e.clientY - rect.top}px`);
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
    // Neste primeiro momento, a senha de cada funcionário é o próprio número do seu código
    const expectedPass = String(found.password || found.code || "").trim().toUpperCase();
    if (cleanPass !== expectedPass) {
      triggerError("Senha incorreta. (Dica: use os números do seu código.)");
      return;
    }
    setCodeError("");
    setAuthModalOpen(false);
    onOperatorLogin?.(found);
  }

  const step = PROCESS_STEPS[activeStep] || PROCESS_STEPS[0];

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

          {operators.filter((o) => o.active !== false).length === 0 && onOperatorLogin && (
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
    <div ref={pageRef} className={`br-page ${isAuthenticated ? "br-embedded" : ""}`}>
      {/* ============ MINIMAL SWISS EDITORIAL NAVBAR ============ */}
      {!isAuthenticated && (
        <header className="br-nav">
          <div className="br-container br-nav-inner">
            <a href="/" className="br-nav-brand" style={{ textDecoration: "none" }}>
              <BrandMark variant="lockup" />
            </a>

            <nav className="br-nav-links" aria-label="Navegação principal">
              <a href="#modulos">Módulos</a>
              <a href="#processo">Processo</a>
              <a href="#duvidas">Dúvidas</a>
              <a href="/tv" target="_blank" rel="noopener noreferrer">
                <IconTv size={13} style={{ verticalAlign: "-2px", marginRight: 5 }} />
                Painel TV
              </a>
            </nav>

            <div className="br-nav-actions">
              <ThemeToggle compact showColors={false} />
              <a
                href="/funcionario"
                className="br-pill-btn"
                style={{ textDecoration: "none" }}
                onClick={openEmployeeArea}
              >
                <span>Área do Funcionário</span>
                <span className="br-pill-arrow">↗</span>
              </a>
            </div>
          </div>
        </header>
      )}

      {/* ============ EDITORIAL MONUMENTAL HERO (ABOVE THE FOLD) ============ */}
      <section id="topo" className="br-container br-hero">
        <div className="br-hero-top-bar">
          <div className="br-hero-eyebrow">
            <span className="br-status-dot" />
            <span>APONTA CD / OPERAÇÃO LOGÍSTICA EM TEMPO REAL</span>
          </div>
          <span className="br-hero-edition" aria-hidden="true">
            {operators.filter((o) => o.active !== false).length > 0
              ? `${String(operators.filter((o) => o.active !== false).length).padStart(2, "0")} OPERADORES ATIVOS`
              : "SISTEMA DE GESTÃO CD"}
          </span>
        </div>

        <div className="br-hero-stage-split">
          <div className="br-hero-copy">
            <h1 className="br-display-title">
              <span className="br-line-mask"><span className="br-line-inner" style={{ animationDelay: "60ms" }}>Operação precisa,</span></span>
              <span className="br-line-mask"><span className="br-line-inner" style={{ animationDelay: "160ms" }}>do piso ao <em className="br-accent-em">mapa 3D.</em></span></span>
            </h1>

            <p className="br-hero-lead">
              Apontamento por código, conferência, planta 2D e 3D em 360°, slotting por Curva ABC e auditoria operacional desenhados para clareza absoluta no turno.
            </p>

            <div className="br-hero-cta">
              <a
                href="/funcionario"
                className="br-cta-primary"
                style={{ textDecoration: "none" }}
                onClick={openEmployeeArea}
              >
                <span>Acessar Área do Funcionário</span>
                <IconChevronRight size={16} />
              </a>

              {isAuthenticated && onOpenMap2D && onOpenMap3D ? (
                <>
                  <button type="button" className="br-cta-ghost" onClick={onOpenMap2D}>Mapa 2D</button>
                  <button type="button" className="br-cta-ghost" onClick={onOpenMap3D}>Mapa 3D</button>
                </>
              ) : (
                <a href="#modulos" className="br-cta-ghost" style={{ textDecoration: "none" }}>
                  Explorar módulos ↓
                </a>
              )}
            </div>
          </div>

          <div
            className="br-hero-visual-col"
            style={
              !isAuthenticated && heroScrollFade > 0.01
                ? {
                    opacity: Math.max(0.4, 1 - heroScrollFade * 0.55),
                    transform: `translateY(${Math.round(-heroScrollFade * 14)}px)`,
                  }
                : undefined
            }
          >
            <AnimatedLogoHero />
          </div>
        </div>

        <div className="br-hero-meta" role="list" aria-label="Pilares operacionais">
          <div className="br-hero-meta-item" role="listitem">
            <span className="br-meta-num">01</span>
            <strong>Planta 2D & 3D</strong>
            <span>Sincronia real com rotação 360°</span>
          </div>
          <div className="br-hero-meta-item" role="listitem">
            <span className="br-meta-num">02</span>
            <strong>Curva ABC</strong>
            <span>Mapa de calor & slotting inteligente</span>
          </div>
          <div className="br-hero-meta-item" role="listitem">
            <span className="br-meta-num">03</span>
            <strong>Offline-first</strong>
            <span>Fila segura mesmo sem internet no galpão</span>
          </div>
        </div>
      </section>

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

            {operators.filter((o) => o.active !== false).length === 0 && onOperatorLogin && (
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

      {/* ============ CONTINUOUS EDITORIAL MARQUEE ============ */}
      <div className="br-marquee-strip" aria-hidden="true">
        <div className="br-marquee-track">
          {[...MARQUEE_ITEMS, ...MARQUEE_ITEMS].map((txt, idx) => (
            <span key={idx} className="br-marquee-item">
              {txt} <span className="br-marquee-sep">/</span>
            </span>
          ))}
        </div>
      </div>

      {/* ============ SELECTED MODULES — BERRIEL CASE-STUDY GRID ============ */}
      <section id="modulos" className="br-container br-section">
        <div className="br-section-bar br-reveal">
          <span className="br-mono-label">01 / FUNCIONALIDADES SELECIONADAS</span>
          <h2 className="br-section-h2">Minimalismo funcional no dia a dia do CD.</h2>
        </div>

        <div className="br-work-grid">
          {SHOWCASE_MODULES.map((mod, idx) => (
            <article
              key={mod.index}
              className={`br-work-card ${mod.wide ? "br-work-wide" : ""} br-reveal`}
              style={{ transitionDelay: `${idx * 70}ms` }}
              onMouseMove={handleSpotlight}
            >
              <div className={`br-work-canvas br-tone-${mod.tone}`}>
                {mod.image ? (
                  <img src={mod.image} alt={mod.title} className="br-work-photo" loading="lazy" />
                ) : (
                  <EditorialModuleArt kind={mod.art} />
                )}
                <span className="br-work-hover-pill">Módulo {mod.index} ↗</span>
              </div>

              <div className="br-work-meta">
                <div className="br-work-top">
                  <span className="br-mono-label">{mod.index} — {mod.tag}</span>
                </div>
                <h3>{mod.title}</h3>
                <p>{mod.desc}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ============ PROCESS / COMO FUNCIONA ============ */}
      <section id="processo" className="br-container br-section br-reveal">
        <div className="br-section-bar">
          <span className="br-mono-label">02 / FLUXO OPERACIONAL</span>
          <h2 className="br-section-h2">Como o Aponta CD conecta toda a equipe.</h2>
        </div>

        <div className="br-process-grid">
          <div className="br-process-list" role="tablist" aria-label="Fluxo operacional">
            {PROCESS_STEPS.map((s, idx) => {
              const active = idx === activeStep;
              return (
                <button
                  key={s.num}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={`br-process-row ${active ? "active" : ""}`}
                  onClick={() => setActiveStep(idx)}
                >
                  <span className="br-process-num">{s.num}</span>
                  <span className="br-process-title">{s.title}</span>
                  <span className="br-process-arrow">→</span>
                </button>
              );
            })}
          </div>

          <div className="br-process-stage">
            <div className="br-process-copy">
              <span className="br-mono-label">ETAPA {step.num}</span>
              <h3>{step.title}</h3>
              <p>{step.desc}</p>
            </div>

            <div className="br-process-visual">
              <div className="br-matrix-4x4" aria-hidden="true">
                {Array.from({ length: 16 }, (_, i) => (
                  <div
                    key={i}
                    className={`br-matrix-cell ${step.lit.includes(i) ? "lit" : ""}`}
                    style={{ transitionDelay: `${(i % 4) * 40}ms` }}
                  />
                ))}
              </div>
              <div className="br-process-stat">
                <strong>{step.stat}</strong>
                <span>{step.statLabel}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ FAQ — XEVRION FOLDED-FLAP ACCORDION ============ */}
      <section id="duvidas" className="br-container br-section br-reveal">
        <div className="br-section-bar">
          <span className="br-mono-label">03 / DÚVIDAS FREQUENTES</span>
          <h2 className="br-section-h2">Respostas diretas.</h2>
        </div>

        <div className="br-faq-wrap">
          <Accordion items={FAQ_ITEMS} defaultOpen={[0]} />
        </div>
      </section>

      {/* ============ EDITORIAL FOOTER ============ */}
      <footer className="br-footer">
        <div className="br-container">
          <div className="br-footer-grid">
            <div className="br-footer-brand-col">
              <BrandMark variant="lockup" />
              <p className="br-footer-desc">
                Plataforma integrada de apontamento operacional, mapeamento 2D/3D e inteligência logística para centros de distribuição.
              </p>
            </div>

            <div className="br-footer-col">
              <div className="br-footer-col-title">Navegação</div>
              <a href="#modulos">Módulos</a>
              <a href="#processo">Fluxo operacional</a>
              <a href="#duvidas">Dúvidas frequentes</a>
            </div>

            <div className="br-footer-col">
              <div className="br-footer-col-title">Acesso rápido</div>
              <a href="/funcionario" className="br-footer-link-btn" onClick={openEmployeeArea}>
                Área do Funcionário ↗
              </a>
              <a href="/tv" target="_blank" rel="noopener noreferrer">
                Painel TV ao vivo ↗
              </a>
              <a href="#topo">Voltar ao topo ↑</a>
            </div>
          </div>

          <div className="br-footer-bottom">
            <span className="br-muted-mono">© {new Date().getFullYear()} APONTA CD · OPERAÇÃO LOGÍSTICA</span>
            <span className="br-muted-mono">TEMPO REAL · 2D & 3D · OFFLINE-FIRST</span>
          </div>
        </div>
      </footer>

      <div className="br-scroll-fade-bottom" aria-hidden="true" />
    </div>
  );
}
