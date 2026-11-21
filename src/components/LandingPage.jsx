import React, { useEffect, useRef, useState } from "react";
import ThemeToggle from "./ThemeToggle";
import BrandMark from "./BrandMark";
import AnimatedLogoHero from "./AnimatedLogoHero";
import { Accordion } from "./ui/Accordion";
import {
  IconTv,
  IconChevronRight,
  IconLock,
  IconDelete,
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
    title: "Planta interativa em 360°",
    desc: "Crie, mova, redimensione e gire livremente prateleiras, escadas, elevadores, mesas de pedidos/transferência, carros de apoio, salas e andares.",
    tone: "cobalt",
    art: "map",
    image: "/images/showcase-map3d.jpg",
    wide: true,
  },
  {
    index: "02",
    tag: "CHÃO DE FÁBRICA",
    title: "Kiosk & Conferência",
    desc: "Registro ultrarrápido por código numérico, leitor de código de barras ou toque, com fila offline segura e controle de SLA.",
    tone: "obsidian",
    art: "kiosk",
    image: "/images/showcase-kiosk.jpg",
  },
  {
    index: "03",
    tag: "ENDEREÇAMENTO",
    title: "Etiquetas padrão CD",
    desc: "Geração em lote no formato 1C1105EA com regra automática de corredor par (direito) e ímpar (esquerdo) e QR Codes prontos para impressão.",
    tone: "slate",
    art: "labels",
    image: "/images/showcase-labels.jpg",
  },
  {
    index: "04",
    tag: "INTELIGÊNCIA",
    title: "Slotting ABC & Turnos",
    desc: "Mapa de calor de giro, comparação entre turno Manhã e Tarde, previsão de demanda para 7 dias e sugestões de realocação.",
    tone: "cyan",
    art: "slotting",
    image: "/images/showcase-analytics.jpg",
  },
  {
    index: "05",
    tag: "GOVERNANÇA",
    title: "Checklist, Pausas & Fraude",
    desc: "Abertura e fechamento auditados por operador, controle de pausas, varredura de anomalias e exportação CSV em 1 clique.",
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
      "Informe seu código de funcionário no campo de acesso no topo desta página inicial (pelo teclado físico, teclado numérico ou teclado na tela). As telas e o menu lateral são liberados imediatamente conforme o seu perfil.",
  },
  {
    question: "Posso editar e girar objetos nos mapas 2D e 3D?",
    answer:
      "Sim. Ative o Modo Edição tanto no Mapa 2D quanto no Mapa 3D para criar, mover, redimensionar e girar em qualquer grau (0°–360°) prateleiras, escadas, elevadores, mesas de conferência (pedidos e transferência), carros de apoio, salas, corredores e andares.",
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
  onOperatorLogin,
  isAuthenticated = false,
  onOpenMap2D,
  onOpenMap3D,
}) {
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const [shake, setShake] = useState(false);
  const [showKeypad, setShowKeypad] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [heroScrollFade, setHeroScrollFade] = useState(0);
  const inputRef = useRef(null);
  const pageRef = useRef(null);

  const isOperatorGate = mode === "operator";

  useEffect(() => {
    if (isOperatorGate) {
      inputRef.current?.focus();
    }
  }, [isOperatorGate]);

  // Efeito fade fluido no hero ao rolar a página (referência Berriel Brands)
  useEffect(() => {
    const scroller = pageRef.current;
    if (!scroller || isAuthenticated) return undefined;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        const progress = Math.max(0, Math.min(1, scroller.scrollTop / 460));
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
    const clean = code.trim().toUpperCase();
    if (!clean) {
      triggerError("Digite seu código de funcionário.");
      return;
    }
    const found = (operators || []).find(
      (op) => String(op.code || "").trim().toUpperCase() === clean && op.active !== false
    );
    if (!found) {
      triggerError(`Código "${clean}" não encontrado ou inativo.`);
      return;
    }
    setCodeError("");
    onOperatorLogin?.(found);
  }

  function appendDigit(d) {
    setCodeError("");
    setCode((prev) => (prev.length < 12 ? prev + d : prev));
    inputRef.current?.focus();
  }

  function backspaceDigit() {
    setCodeError("");
    setCode((prev) => prev.slice(0, -1));
    inputRef.current?.focus();
  }

  const step = PROCESS_STEPS[activeStep] || PROCESS_STEPS[0];

  return (
    <div ref={pageRef} className={`br-page ${isAuthenticated ? "br-embedded" : ""}`}>
      {/* ============ MINIMAL SWISS EDITORIAL NAVBAR ============ */}
      {!isAuthenticated && (
        <header className="br-nav">
          <div className="br-container br-nav-inner">
            <a href="#topo" className="br-nav-brand" style={{ textDecoration: "none" }}>
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
              <ThemeToggle compact />
              <button
                type="button"
                className="br-pill-btn"
                onClick={isOperatorGate ? () => inputRef.current?.focus() : onEnterLogin}
              >
                <span>{isOperatorGate ? "Acessar CD" : "Entrar"}</span>
                <span className="br-pill-arrow">↗</span>
              </button>
            </div>
          </div>
        </header>
      )}

      {/* ============ EDITORIAL MONUMENTAL HERO ============ */}
      <section
        id="topo"
        className="br-container br-hero br-hero-scroll-wrap"
        style={
          !isAuthenticated && heroScrollFade > 0.01
            ? {
                opacity: Math.max(0.18, 1 - heroScrollFade * 0.85),
                transform: `translateY(${Math.round(-heroScrollFade * 24)}px)`,
                filter: `blur(${(heroScrollFade * 3).toFixed(2)}px)`,
              }
            : undefined
        }
      >
        <div className="br-hero-eyebrow">
          <span className="br-status-dot" />
          <span>APONTA CD / OPERAÇÃO LOGÍSTICA EM TEMPO REAL</span>
        </div>

        {/* Animação grande do logo: caminhão entrando e saindo do galpão + construção "aponta cd" */}
        <AnimatedLogoHero />

        <div className="br-hero-grid">
          <div className="br-hero-copy">
            <h1 className="br-display-title">
              <span className="br-line-mask"><span className="br-line-inner" style={{ animationDelay: "60ms" }}>Operação precisa,</span></span>
              <span className="br-line-mask"><span className="br-line-inner" style={{ animationDelay: "160ms" }}>do piso ao <em className="br-accent-em">mapa 3D.</em></span></span>
            </h1>

            <p className="br-hero-lead">
              Apontamento por código, conferência, planta 2D e 3D com rotação livre em 360°,
              slotting por Curva ABC e auditoria operacional desenhados para máxima clareza no turno.
            </p>

            <div className="br-hero-cta">
              {isOperatorGate ? (
                <button
                  type="button"
                  className="br-cta-primary"
                  onClick={() => inputRef.current?.focus()}
                >
                  Digitar meu código <IconChevronRight size={16} />
                </button>
              ) : (
                <button type="button" className="br-cta-primary" onClick={onEnterLogin}>
                  {isAuthenticated ? "Ir para a Operação" : "Entrar no sistema"} <IconChevronRight size={16} />
                </button>
              )}

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

            <div className="br-hero-meta">
              <div>
                <strong>2D + 3D</strong>
                <span>Rotação livre 360°</span>
              </div>
              <div>
                <strong>Curva ABC</strong>
                <span>Mapa de calor</span>
              </div>
              <div>
                <strong>Offline</strong>
                <span>Fila segura no CD</span>
              </div>
            </div>
          </div>

          {/* Right column: Operator Code Gate OR Editorial Adapted Brand Frame */}
          <div className="br-hero-right">
            {isOperatorGate ? (
              <div className={`br-operator-card ${shake ? "shake" : ""}`}>
                <div className="br-operator-brand">
                  <BrandMark variant="full" />
                </div>

                <div className="br-operator-head">
                  <div className="br-operator-icon">
                    <IconLock size={17} />
                  </div>
                  <div>
                    <h2>Acesso do Funcionário</h2>
                    <p>Digite seu código para liberar o painel</p>
                  </div>
                </div>

                <form onSubmit={handleCodeSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <input
                    ref={inputRef}
                    type="text"
                    inputMode="numeric"
                    className="br-code-input"
                    placeholder="CÓDIGO (EX.: 101)"
                    value={code}
                    onChange={(e) => {
                      setCodeError("");
                      setCode(e.target.value);
                    }}
                    autoComplete="off"
                    aria-label="Código do funcionário"
                  />

                  {codeError && (
                    <div className="login-error" role="alert" style={{ margin: 0 }}>
                      {codeError}
                    </div>
                  )}

                  <button type="submit" className="br-submit-btn">
                    <span>Entrar no Aponta CD</span>
                    <IconChevronRight size={16} />
                  </button>
                </form>

                <div className="br-keypad-bar">
                  <button
                    type="button"
                    className="br-text-btn"
                    onClick={() => setShowKeypad((v) => !v)}
                  >
                    {showKeypad ? "Ocultar teclado" : "Usar teclado na tela"}
                  </button>
                  <span className="br-muted-mono">
                    {operators.filter((o) => o.active !== false).length} ATIVOS
                  </span>
                </div>

                {showKeypad && (
                  <div className="landing-keypad anim-fade-up">
                    {["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0"].map((k) => (
                      <button
                        key={k}
                        type="button"
                        className="br-keypad-btn"
                        onClick={() => (k === "C" ? setCode("") : appendDigit(k))}
                      >
                        {k}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="br-keypad-btn"
                      onClick={backspaceDigit}
                      aria-label="Apagar"
                    >
                      <IconDelete size={16} />
                    </button>
                  </div>
                )}

                <div className="br-operator-foot">
                  <span><IconCheck size={13} /> Teclado numérico</span>
                  <span><IconCheck size={13} /> Acesso imediato</span>
                </div>

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
              </div>
            ) : (
              <div className="br-studio-showcase">
                <BrandMark variant="full" />
                <div className="br-studio-caption">
                  <span>IDENTIDADE · APONTA CD</span>
                  <span>{currentOperator ? `${currentOperator.name} · #${currentOperator.code}` : "V2.0 · TEMPO REAL"}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

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
        <div className="br-container br-footer-inner">
          <BrandMark variant="lockup" />
          <span className="br-muted-mono">GESTÃO DE CENTRO DE DISTRIBUIÇÃO · TEMPO REAL</span>
          <a href="#topo" className="br-back-top">Topo ↑</a>
        </div>
      </footer>

      <div className="br-scroll-fade-bottom" aria-hidden="true" />
    </div>
  );
}
