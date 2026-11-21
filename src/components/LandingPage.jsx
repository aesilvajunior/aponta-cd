import React, { useEffect, useRef, useState } from "react";
import ThemeToggle from "./ThemeToggle";
import { Accordion } from "./ui/Accordion";
import {
  IconTv,
  IconChevronRight,
  IconLock,
  IconDelete,
  IconCheck,
} from "./Icons";

const BENTO_CARDS = [
  {
    num: "01",
    variant: "navy",
    title: "Apontamento & Conferência",
    desc: "Registre atividades, conferências e erros em segundos por código, leitor USB/Bluetooth ou toque — com fila offline automática.",
    iso: "kiosk",
  },
  {
    num: "02",
    variant: "carbon",
    title: "Mapa 2D e 3D em 360°",
    desc: "Crie, mova, redimensione e gire livremente prateleiras, escadas, elevadores, mesas de pedidos/transferência, carros de apoio, salas e andares.",
    iso: "map3d",
  },
  {
    num: "03",
    variant: "blue",
    title: "Endereços & Etiquetas CD",
    desc: "Padrão compacto 1C1105EA com regra automática par (direito) e ímpar (esquerdo) e QR Codes prontos para impressão.",
    iso: "labels",
  },
  {
    num: "04",
    variant: "blue",
    title: "Slotting ABC & Turnos",
    desc: "Mapa de calor de giro, comparação Manhã/Tarde, previsão de carga para 7 dias e realocação inteligente de itens Curva A.",
    iso: "slotting",
  },
  {
    num: "05",
    variant: "blue",
    title: "Checklist, Pausas & Fraude",
    desc: "Abertura e fechamento auditados por operador, monitoramento de pausas, varredura de anomalias e exportação CSV instantânea.",
    iso: "audit",
  },
];

const WORKFLOW_STEPS = [
  {
    id: "code",
    title: "Acesso instantâneo por código",
    summary: "Cada colaborador entra com seu código pessoal em segundos — sem telas confusas, liberando exatamente o que precisa no turno.",
    metricA: "2 seg",
    labelA: "Tempo médio de login",
    metricB: "100% auditado",
    labelB: "Ações por operador",
    highlight: [0, 1, 2, 7, 8],
  },
  {
    id: "map",
    title: "Planta 2D e 3D sempre viva",
    summary: "Altere o layout do galpão arrastando e girando objetos em qualquer ângulo. Mudanças no 2D aparecem na hora no 3D e vice-versa.",
    metricA: "0°–360°",
    labelA: "Rotação livre de objetos",
    metricB: "Multi-andares",
    labelB: "Térreo, 1º, 2º andar+",
    highlight: [4, 5, 6, 11, 12, 13],
  },
  {
    id: "scan",
    title: "Coleta e inventário cíclico",
    summary: "Bipe endereços e códigos EAN pela câmera ou coletor. O sistema prioriza contagens de itens Curva A e reduz rupturas.",
    metricA: "QR + EAN",
    labelA: "Leitura instantânea",
    metricB: "Offline-first",
    labelB: "Sincronia automática",
    highlight: [9, 10, 14, 15, 16],
  },
  {
    id: "kpi",
    title: "Decisões em tempo real",
    summary: "Acompanhe produtividade por turno, SLA de conferência, alertas de fraude e painel TV no galpão sem planilhas manuais.",
    metricA: "Tempo real",
    labelA: "Painel TV e Indicadores",
    metricB: "1 clique",
    labelB: "Exportação CSV / Excel",
    highlight: [2, 3, 6, 10, 14, 17, 18],
  },
];

const FAQ_ITEMS = [
  {
    question: "Como entro no sistema pelo meu código de funcionário?",
    answer:
      "Digite seu código no cartão Acesso do Funcionário no topo desta página (usando o teclado físico, teclado numérico ou o teclado na tela) e clique em Entrar. O menu lateral e todas as funções do seu perfil são liberados imediatamente.",
  },
  {
    question: "Consigo editar o layout do galpão tanto no 2D quanto no 3D?",
    answer:
      "Sim. Ative o Modo Edição no Mapa 2D ou no Mapa 3D para criar, arrastar, redimensionar e girar em 0°–360° prateleiras, escadas, elevadores, mesas de conferência (pedidos e transferência), carros de apoio, salas, corredores e andares.",
  },
  {
    question: "O sistema funciona no chão de fábrica se a internet oscilar?",
    answer:
      "Sim. Os lançamentos de apontamento e coleta utilizam fila offline segura e sincronizam automaticamente com o Supabase assim que a conexão retorna.",
  },
];

function IsometricMiniGraphic({ kind }) {
  if (kind === "kiosk") {
    return (
      <svg viewBox="0 0 180 110" className="iso-mini-svg" aria-hidden="true">
        <polygon points="90,96 24,64 90,32 156,64" fill="rgba(255,255,255,0.92)" />
        <polygon points="90,102 24,70 24,64 90,96" fill="rgba(203,213,225,0.9)" />
        <polygon points="90,102 156,70 156,64 90,96" fill="rgba(148,163,184,0.8)" />
        <g className="iso-float-slow">
          <polygon points="90,46 66,34 90,22 114,34" fill="#38bdf8" />
          <polygon points="90,72 66,60 66,34 90,46" fill="#0284c7" />
          <polygon points="90,72 114,60 114,34 90,46" fill="#1d4ed8" />
        </g>
        <path d="M54,62 L72,53" stroke="#38bdf8" strokeWidth="2" strokeDasharray="3 3" />
      </svg>
    );
  }
  if (kind === "map3d") {
    return (
      <svg viewBox="0 0 180 110" className="iso-mini-svg" aria-hidden="true">
        <polygon points="90,98 20,64 90,30 160,64" fill="rgba(255,255,255,0.92)" />
        <polygon points="90,104 20,70 20,64 90,98" fill="rgba(203,213,225,0.85)" />
        <polygon points="90,104 160,70 160,64 90,98" fill="rgba(148,163,184,0.75)" />
        <g className="iso-float-slow">
          <polygon points="72,56 54,47 72,38 90,47" fill="#60a5fa" />
          <polygon points="72,76 54,67 54,47 72,56" fill="#2563eb" />
          <polygon points="72,76 90,67 90,47 72,56" fill="#1d4ed8" />
        </g>
        <g className="iso-float-delay">
          <polygon points="108,60 90,51 108,42 126,51" fill="#22d3ee" />
          <polygon points="108,82 90,73 90,51 108,60" fill="#0891b2" />
          <polygon points="108,82 126,73 126,51 108,60" fill="#0e7490" />
        </g>
        <polygon points="90,42 74,34 90,26 106,34" fill="#e2e8f0" />
        <polygon points="90,56 74,48 74,34 90,42" fill="#cbd5e1" />
        <polygon points="90,56 106,48 106,34 90,42" fill="#94a3b8" />
      </svg>
    );
  }
  if (kind === "labels") {
    return (
      <svg viewBox="0 0 160 100" className="iso-mini-svg" aria-hidden="true">
        <polygon points="80,88 22,60 80,32 138,60" fill="rgba(255,255,255,0.92)" />
        <polygon points="80,93 22,65 22,60 80,88" fill="rgba(203,213,225,0.88)" />
        <polygon points="80,93 138,65 138,60 80,88" fill="rgba(148,163,184,0.78)" />
        <g className="iso-float-slow">
          <polygon points="62,56 46,48 62,40 78,48" fill="#ffffff" stroke="#94a3b8" strokeWidth="1" />
          <polygon points="62,70 46,62 46,48 62,56" fill="#e2e8f0" />
          <polygon points="62,70 78,62 78,48 62,56" fill="#cbd5e1" />
          <polygon points="98,64 82,56 98,48 114,56" fill="#38bdf8" />
          <polygon points="98,78 82,70 82,56 98,64" fill="#0284c7" />
          <polygon points="98,78 114,70 114,56 98,64" fill="#0369a1" />
        </g>
      </svg>
    );
  }
  if (kind === "slotting") {
    return (
      <svg viewBox="0 0 160 100" className="iso-mini-svg" aria-hidden="true">
        <polygon points="80,88 22,60 80,32 138,60" fill="rgba(255,255,255,0.92)" />
        <polygon points="80,93 22,65 22,60 80,88" fill="rgba(203,213,225,0.88)" />
        <polygon points="80,93 138,65 138,60 80,88" fill="rgba(148,163,184,0.78)" />
        <g className="iso-float-slow">
          <polygon points="66,50 52,43 66,36 80,43" fill="#38bdf8" />
          <polygon points="66,72 52,65 52,43 66,50" fill="#0284c7" />
          <polygon points="66,72 80,65 80,43 66,50" fill="#1d4ed8" />
        </g>
        <g className="iso-float-delay">
          <polygon points="98,58 84,51 98,44 112,51" fill="#ffffff" />
          <polygon points="98,74 84,67 84,51 98,58" fill="#cbd5e1" />
          <polygon points="98,74 112,67 112,51 98,58" fill="#94a3b8" />
        </g>
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 160 100" className="iso-mini-svg" aria-hidden="true">
      <polygon points="80,88 22,60 80,32 138,60" fill="rgba(255,255,255,0.92)" />
      <polygon points="80,93 22,65 22,60 80,88" fill="rgba(203,213,225,0.88)" />
      <polygon points="80,93 138,65 138,60 80,88" fill="rgba(148,163,184,0.78)" />
      {[0, 1, 2].map((i) => (
        <g key={i} transform={`translate(${i * 18 - 18}, ${i * 9 - 9})`} className="iso-float-slow">
          <polygon points="80,50 70,45 80,40 90,45" fill={i === 1 ? "#38bdf8" : "#60a5fa"} />
          <polygon points="80,62 70,57 70,45 80,50" fill={i === 1 ? "#0284c7" : "#2563eb"} />
          <polygon points="80,62 90,57 90,45 80,50" fill="#1e3a8a" />
        </g>
      ))}
    </svg>
  );
}

function HeroIsometricWarehouse() {
  return (
    <div className="hero-iso-stage" aria-hidden="true">
      <svg viewBox="0 0 460 320" className="hero-iso-svg">
        {/* Base isometric dock platform */}
        <polygon points="230,295 36,198 230,101 424,198" fill="rgba(255,255,255,0.96)" />
        <polygon points="230,308 36,211 36,198 230,295" fill="#cbd5e1" />
        <polygon points="230,308 424,211 424,198 230,295" fill="#94a3b8" />

        {/* Subtle floor grid lines on platform */}
        <g stroke="rgba(30,64,175,0.14)" strokeWidth="1">
          <line x1="133" y1="150" x2="327" y2="246" />
          <line x1="181" y1="125" x2="375" y2="222" />
          <line x1="84" y1="174" x2="278" y2="271" />
          <line x1="133" y1="246" x2="327" y2="150" />
          <line x1="181" y1="271" x2="375" y2="174" />
          <line x1="84" y1="222" x2="278" y2="125" />
        </g>

        {/* Warehouse bay structure (back-right) */}
        <g className="iso-float-subtle">
          <polygon points="270,152 195,115 270,78 345,115" fill="#e2e8f0" />
          <polygon points="270,210 195,173 195,115 270,152" fill="#1e3a8a" />
          <polygon points="270,210 345,173 345,115 270,152" fill="#172554" />
          {/* Door opening */}
          <polygon points="246,198 214,182 214,145 246,161" fill="#0f172a" />
          {/* Roof ribs */}
          <line x1="230" y1="98" x2="305" y2="135" stroke="#94a3b8" strokeWidth="2" />
          <line x1="250" y1="88" x2="325" y2="125" stroke="#94a3b8" strokeWidth="2" />
        </g>

        {/* Isometric Racks / Cargo Stacks */}
        <g className="iso-float-slow">
          <polygon points="150,192 118,176 150,160 182,176" fill="#38bdf8" />
          <polygon points="150,226 118,210 118,176 150,192" fill="#0284c7" />
          <polygon points="150,226 182,210 182,176 150,192" fill="#0369a1" />
        </g>

        <g className="iso-float-delay">
          <polygon points="200,218 168,202 200,186 232,202" fill="#60a5fa" />
          <polygon points="200,252 168,236 168,202 200,218" fill="#2563eb" />
          <polygon points="200,252 232,236 232,202 200,218" fill="#1d4ed8" />
        </g>

        <g className="iso-float-slow">
          <polygon points="318,206 290,192 318,178 346,192" fill="#22d3ee" />
          <polygon points="318,234 290,220 290,192 318,206" fill="#0891b2" />
          <polygon points="318,234 346,220 346,192 318,206" fill="#0e7490" />
        </g>

        {/* Animated flow line connecting warehouse to dock */}
        <path
          d="M230,175 L155,212 L230,250 L318,206"
          fill="none"
          stroke="#38bdf8"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="8 8"
          className="iso-flow-path"
        />

        {/* Pulsing telemetry nodes */}
        <circle cx="230" cy="175" r="5" fill="#38bdf8" className="iso-pulse-dot" />
        <circle cx="155" cy="212" r="5" fill="#ffffff" className="iso-pulse-dot" />
        <circle cx="318" cy="206" r="5" fill="#22d3ee" className="iso-pulse-dot" />
      </svg>
    </div>
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
  const [activeWorkflow, setActiveWorkflow] = useState(0);
  const inputRef = useRef(null);
  const pageRef = useRef(null);

  const isOperatorGate = mode === "operator";

  useEffect(() => {
    if (isOperatorGate) {
      inputRef.current?.focus();
    }
  }, [isOperatorGate]);

  // Scroll-reveal motion observer
  useEffect(() => {
    const rootEl = pageRef.current;
    if (!rootEl) return undefined;
    const targets = rootEl.querySelectorAll(".reveal-on-scroll");
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
      { root: isAuthenticated ? null : rootEl, threshold: 0.12 }
    );
    targets.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [isAuthenticated]);

  function handleCardMouseMove(e) {
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

  const currentStep = WORKFLOW_STEPS[activeWorkflow] || WORKFLOW_STEPS[0];

  return (
    <div ref={pageRef} className={`landing-page ${isAuthenticated ? "landing-embedded" : ""}`}>
      {/* ============ ROYAL BLUE ISOMETRIC HERO ============ */}
      <section className="k8s-hero-shell">
        <div className="k8s-hero-grid-bg" aria-hidden="true" />

        {/* Floating pill navigation bar */}
        {!isAuthenticated && (
          <div className="k8s-nav-wrap">
            <header className="k8s-pill-nav">
              <div className="k8s-nav-brand">
                <img src="/logo-aponta-cd.jpg" alt="Aponta CD" className="k8s-nav-logo" />
              </div>

              <nav className="k8s-nav-links" aria-label="Navegação da página inicial">
                <a href="#recursos">Recursos</a>
                <a href="#como-funciona">Como funciona</a>
                <a href="#duvidas">Dúvidas</a>
                <a href="/tv" target="_blank" rel="noopener noreferrer">
                  <IconTv size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} />
                  Painel TV
                </a>
              </nav>

              <div className="k8s-nav-actions">
                <ThemeToggle compact />
                {!isOperatorGate && onEnterLogin ? (
                  <button type="button" className="k8s-nav-cta" onClick={onEnterLogin}>
                    Entrar
                  </button>
                ) : (
                  <button
                    type="button"
                    className="k8s-nav-cta"
                    onClick={() => inputRef.current?.focus()}
                  >
                    Acessar CD
                  </button>
                )}
              </div>
            </header>
          </div>
        )}

        <div className="landing-container k8s-hero-grid">
          <div className="k8s-hero-copy">
            <div className="k8s-hero-badge">
              <span className="k8s-badge-tag">CD</span>
              <span>Operação Logística · Planta 2D & 3D em Tempo Real</span>
            </div>

            <h1 className="k8s-hero-title">
              Orquestração completa do seu Centro de Distribuição
            </h1>

            <p className="k8s-hero-lead">
              Apontamento rápido por código, conferência, mapa 2D e 3D editável com rotação livre em 360°,
              slotting por Curva ABC e auditoria operacional em uma interface fluida.
            </p>

            <div className="k8s-hero-buttons">
              {isOperatorGate ? (
                <button
                  type="button"
                  className="k8s-btn-white"
                  onClick={() => inputRef.current?.focus()}
                >
                  Digitar meu código <IconChevronRight size={15} />
                </button>
              ) : (
                <button type="button" className="k8s-btn-white" onClick={onEnterLogin}>
                  {isAuthenticated ? "Abrir Operação" : "Entrar no sistema"} <IconChevronRight size={15} />
                </button>
              )}

              {isAuthenticated && onOpenMap2D && onOpenMap3D ? (
                <>
                  <button type="button" className="k8s-btn-ghost" onClick={onOpenMap2D}>
                    Mapa 2D
                  </button>
                  <button type="button" className="k8s-btn-ghost" onClick={onOpenMap3D}>
                    Mapa 3D
                  </button>
                </>
              ) : (
                <a href="#recursos" className="k8s-btn-ghost" style={{ textDecoration: "none" }}>
                  Ver recursos
                </a>
              )}
            </div>

            <div className="k8s-hero-metrics">
              <div>
                <strong>2D + 3D</strong>
                <span>Rotação livre 360°</span>
              </div>
              <div>
                <strong>Curva ABC</strong>
                <span>Slotting & calor</span>
              </div>
              <div>
                <strong>Offline-first</strong>
                <span>Chão de fábrica</span>
              </div>
            </div>
          </div>

          {/* Right side: Operator Code Gate OR Isometric Warehouse Visual */}
          <div className="k8s-hero-right">
            {isOperatorGate ? (
              <div className={`k8s-login-card ${shake ? "shake" : ""}`}>
                <div className="k8s-login-logo-wrap">
                  <img src="/logo-aponta-cd.jpg" alt="Logo Aponta CD" className="k8s-login-logo" />
                </div>

                <div className="k8s-login-head">
                  <div className="k8s-login-icon">
                    <IconLock size={18} />
                  </div>
                  <div>
                    <h2>Acesso do Funcionário</h2>
                    <p>Informe seu código para liberar o painel</p>
                  </div>
                </div>

                <form onSubmit={handleCodeSubmit} style={{ display: "flex", flexDirection: "column", gap: 11 }}>
                  <input
                    ref={inputRef}
                    type="text"
                    inputMode="numeric"
                    className="k8s-code-input"
                    placeholder="Código (ex.: 101)"
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

                  <button type="submit" className="k8s-login-submit">
                    Entrar no Aponta CD <IconChevronRight size={16} />
                  </button>
                </form>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
                  <button
                    type="button"
                    className="k8s-keypad-toggle"
                    onClick={() => setShowKeypad((v) => !v)}
                  >
                    {showKeypad ? "Ocultar teclado" : "Teclado na tela"}
                  </button>
                  <span style={{ fontSize: 11.5, color: "#64748b", fontWeight: 600 }}>
                    {operators.filter((o) => o.active !== false).length} operadores ativos
                  </span>
                </div>

                {showKeypad && (
                  <div className="landing-keypad anim-fade-up">
                    {["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0"].map((k) => (
                      <button
                        key={k}
                        type="button"
                        className="k8s-keypad-btn"
                        onClick={() => (k === "C" ? setCode("") : appendDigit(k))}
                      >
                        {k}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="k8s-keypad-btn"
                      onClick={backspaceDigit}
                      aria-label="Apagar"
                    >
                      <IconDelete size={16} />
                    </button>
                  </div>
                )}

                <div className="k8s-login-foot">
                  <span><IconCheck size={13} /> Teclado numérico</span>
                  <span><IconCheck size={13} /> Acesso imediato</span>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
                <div className="k8s-floating-logo-card">
                  <img src="/logo-aponta-cd.jpg" alt="Aponta CD" className="k8s-floating-logo-img" />
                  {currentOperator && (
                    <span className="k8s-operator-chip">
                      Operador: {currentOperator.name} ({currentOperator.code})
                    </span>
                  )}
                </div>
                <HeroIsometricWarehouse />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ============ ASYMMETRIC NUMBERED ISOMETRIC BENTO (2 + 3) ============ */}
      <section id="recursos" className="landing-container k8s-bento-section">
        <div className="k8s-bento-top">
          {BENTO_CARDS.slice(0, 2).map((card, idx) => (
            <article
              key={card.num}
              className={`k8s-bento-card k8s-bento-${card.variant} reveal-on-scroll`}
              style={{ transitionDelay: `${idx * 80}ms` }}
              onMouseMove={handleCardMouseMove}
            >
              <div className="k8s-bento-content">
                <span className="k8s-bento-num">{card.num}</span>
                <h3>{card.title}</h3>
                <p>{card.desc}</p>
              </div>
              <div className="k8s-bento-art">
                <IsometricMiniGraphic kind={card.iso} />
              </div>
            </article>
          ))}
        </div>

        <div className="k8s-bento-bottom">
          {BENTO_CARDS.slice(2).map((card, idx) => (
            <article
              key={card.num}
              className={`k8s-bento-card k8s-bento-${card.variant} k8s-bento-compact reveal-on-scroll`}
              style={{ transitionDelay: `${(idx + 2) * 75}ms` }}
              onMouseMove={handleCardMouseMove}
            >
              <div className="k8s-bento-art-top">
                <IsometricMiniGraphic kind={card.iso} />
              </div>
              <div className="k8s-bento-content">
                <span className="k8s-bento-num">{card.num}</span>
                <h3>{card.title}</h3>
                <p>{card.desc}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ============ INTERACTIVE "HOW IT WORKS" SPLIT SECTION ============ */}
      <section id="como-funciona" className="landing-container k8s-how-section reveal-on-scroll">
        <div className="k8s-how-grid">
          <div className="k8s-how-left">
            <h2>Como o Aponta CD trabalha para você</h2>
            <p className="k8s-how-lead">
              Desenvolvido para a operação diária do centro de distribuição, combinando simplicidade
              no apontamento com precisão visual em 2D e 3D.
            </p>

            <div className="k8s-how-list" role="tablist" aria-label="Etapas do sistema">
              {WORKFLOW_STEPS.map((step, idx) => {
                const active = idx === activeWorkflow;
                return (
                  <button
                    key={step.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    className={`k8s-how-item ${active ? "active" : ""}`}
                    onClick={() => setActiveWorkflow(idx)}
                  >
                    <span className="k8s-how-dot" />
                    <span className="k8s-how-item-title">{step.title}</span>
                    <span className="k8s-how-arrow">→</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="k8s-how-visual">
            <div className="k8s-how-visual-head">
              <strong>{currentStep.title}</strong>
              <p>{currentStep.summary}</p>
            </div>

            <div className="k8s-iso-matrix-wrap">
              <div className="k8s-iso-matrix" aria-hidden="true">
                {Array.from({ length: 20 }, (_, i) => {
                  const isLit = currentStep.highlight.includes(i);
                  return (
                    <div
                      key={i}
                      className={`k8s-iso-node ${isLit ? "lit" : ""}`}
                      style={{ transitionDelay: `${(i % 5) * 35}ms` }}
                    />
                  );
                })}
              </div>

              <div className="k8s-how-callouts">
                <div className="k8s-callout">
                  <strong>{currentStep.metricA}</strong>
                  <span>{currentStep.labelA}</span>
                </div>
                <div className="k8s-callout">
                  <strong>{currentStep.metricB}</strong>
                  <span>{currentStep.labelB}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ XEVRION ACCORDION FAQ ============ */}
      <section id="duvidas" className="landing-container k8s-faq-section reveal-on-scroll">
        <div className="landing-section-head">
          <h2 className="landing-section-title">Perguntas frequentes</h2>
          <p className="landing-section-sub">
            Respostas rápidas sobre acesso, mapas 2D/3D e operação offline.
          </p>
        </div>

        <div className="landing-faq-box">
          <Accordion items={FAQ_ITEMS} defaultOpen={[0]} />
        </div>
      </section>

      <footer className="landing-footer">
        Aponta CD · Sistema Integrado de Gestão de Centro de Distribuição
      </footer>
    </div>
  );
}
