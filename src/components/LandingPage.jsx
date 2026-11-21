import React, { useEffect, useRef, useState } from "react";
import ThemeToggle from "./ThemeToggle";
import { Accordion } from "./ui/Accordion";
import {
  IconActivity,
  IconLayers,
  IconClipboardCheck,
  IconShield,
  IconTrendingUp,
  IconPackage,
  IconTv,
  IconChevronRight,
  IconLock,
  IconDelete,
  IconCheck,
} from "./Icons";

const FEATURES = [
  {
    Icon: IconActivity,
    color: "#f27416",
    title: "Apontamento & Conferência",
    desc: "Registre atividades, erros e conferências em segundos com teclado numérico, código de barras e fila offline.",
  },
  {
    Icon: IconLayers,
    color: "#3b82f6",
    title: "Mapa 2D e 3D Editável",
    desc: "Crie, mova, redimensione e gire em 360° prateleiras, escadas, elevadores, mesas de conferência, salas e andares.",
  },
  {
    Icon: IconPackage,
    color: "#10b981",
    title: "Endereços & Etiquetas CD",
    desc: "Gere etiquetas padrão 1C1105EA (par = direito, ímpar = esquerdo) e bipe produtos direto na coleta.",
  },
  {
    Icon: IconTrendingUp,
    color: "#f59e0b",
    title: "Turnos, Carga & Slotting ABC",
    desc: "Compare turno Manhã e Tarde, acompanhe o giro em mapa de calor e visualize previsão dos próximos 7 dias.",
  },
  {
    Icon: IconClipboardCheck,
    color: "#0ea5e9",
    title: "Checklist do CD & Rotina",
    desc: "Abertura e fechamento auditados por operador, rotação de tarefas e painel do líder em tempo real.",
  },
  {
    Icon: IconShield,
    color: "#8b5cf6",
    title: "Fraude, Pausas & Auditoria",
    desc: "Detecção automática de lançamentos atípicos, controle de pausas e exportação instantânea em CSV/Excel.",
  },
];

const FAQ_ITEMS = [
  {
    question: "Como acesso as funções do Aponta CD?",
    answer:
      "Digite seu código de funcionário no campo de acesso desta página inicial (pelo teclado físico, teclado numérico ou toque) e clique em Entrar. O sistema carrega automaticamente suas permissões e libera o painel completo.",
  },
  {
    question: "O que posso editar nos Mapas 2D e 3D?",
    answer:
      "No Modo Edição você pode criar, mover, redimensionar e girar em qualquer ângulo (0° a 360°) prateleiras, escadas, elevadores, mesas de conferência (pedidos e transferência), carros de apoio, salas, corredores e múltiplos andares.",
  },
  {
    question: "Funciona com coletor de dados ou tablet no galpão?",
    answer:
      "Sim. O Aponta CD é otimizado para leitores USB/Bluetooth, câmera de celular e telas sensíveis ao toque, mantendo os lançamentos em fila offline segura caso a rede oscile.",
  },
];

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
  const inputRef = useRef(null);

  const isOperatorGate = mode === "operator";

  useEffect(() => {
    if (isOperatorGate) {
      inputRef.current?.focus();
    }
  }, [isOperatorGate]);

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

  return (
    <div className={`landing-page anim-fade-up ${isAuthenticated ? "landing-embedded" : ""}`}>
      {!isAuthenticated && (
        <header className="landing-nav">
          <div className="landing-nav-inner">
            <div className="landing-brand">
              <img src="/logo-aponta-cd.jpg" alt="Aponta CD" className="landing-nav-logo" />
            </div>

            <div className="landing-nav-actions">
              <a
                href="/tv"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-small"
                style={{ textDecoration: "none" }}
              >
                <IconTv size={14} /> Painel TV
              </a>
              <ThemeToggle compact />
              {!isOperatorGate && onEnterLogin && (
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ padding: "8px 16px", fontSize: 13.5, background: "#f27416", borderColor: "#f27416" }}
                  onClick={onEnterLogin}
                >
                  Entrar <IconChevronRight size={15} />
                </button>
              )}
            </div>
          </div>
        </header>
      )}

      <main className="landing-container">
        <section className="landing-hero">
          <div className="landing-hero-copy">
            <div className="landing-logo-showcase">
              <img
                src="/logo-aponta-cd.jpg"
                alt="Logo Aponta CD"
                className="landing-hero-logo"
              />
            </div>

            <div className="landing-pill">
              <span className="landing-pill-dot" /> Gestão de Centro de Distribuição · Tempo Real
            </div>

            <h1 className="landing-h1">
              Operação ágil, do <span>chão de fábrica</span> ao mapa 3D
            </h1>
            <p className="landing-lead">
              Apontamento por código, conferência, planta 2D/3D interativa com rotação livre em 360°,
              checklist de turnos e inteligência operacional em uma interface feita para velocidade.
            </p>

            {!isOperatorGate && (
              <div className="landing-cta-row">
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ padding: "12px 24px", fontSize: 15, background: "#f27416", borderColor: "#f27416" }}
                  onClick={onEnterLogin}
                >
                  {isAuthenticated ? "Ir para a Operação" : "Acessar com conta"} <IconChevronRight size={16} />
                </button>
                {isAuthenticated && onOpenMap2D && onOpenMap3D ? (
                  <>
                    <button type="button" className="btn btn-secondary" style={{ padding: "12px 18px", fontSize: 14 }} onClick={onOpenMap2D}>
                      Mapa 2D
                    </button>
                    <button type="button" className="btn btn-secondary" style={{ padding: "12px 18px", fontSize: 14 }} onClick={onOpenMap3D}>
                      Mapa 3D
                    </button>
                  </>
                ) : (
                  <a
                    href="#recursos"
                    className="btn btn-secondary"
                    style={{ padding: "12px 20px", fontSize: 14.5, textDecoration: "none" }}
                  >
                    Conhecer recursos
                  </a>
                )}
              </div>
            )}

            <div className="landing-stats">
              <div>
                <div className="landing-stat-val">360°</div>
                <div className="landing-stat-lbl">Mapa 2D e 3D editável</div>
              </div>
              <div>
                <div className="landing-stat-val">Curva ABC</div>
                <div className="landing-stat-lbl">Slotting & calor</div>
              </div>
              <div>
                <div className="landing-stat-val">Offline</div>
                <div className="landing-stat-lbl">Zero perda no galpão</div>
              </div>
            </div>
          </div>

          {/* Right column: Operator Code Login Card (when in operator gate) OR Blueprint Preview */}
          {isOperatorGate ? (
            <div className={`landing-login-card ${shake ? "shake" : ""}`}>
              <div className="landing-login-head">
                <div className="landing-login-icon">
                  <IconLock size={20} />
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: 19, fontWeight: 800 }}>Acesso do Funcionário</h2>
                  <p style={{ margin: "3px 0 0", fontSize: 13, color: "var(--text-muted)" }}>
                    Digite seu código para liberar o sistema
                  </p>
                </div>
              </div>

              <form onSubmit={handleCodeSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <input
                  ref={inputRef}
                  type="text"
                  inputMode="numeric"
                  className="landing-code-input"
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

                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{
                    width: "100%",
                    padding: "13px 18px",
                    fontSize: 15,
                    fontWeight: 700,
                    background: "linear-gradient(135deg, #16336e, #2451a6)",
                    borderColor: "#16336e",
                  }}
                >
                  Entrar no Aponta CD <IconChevronRight size={16} />
                </button>
              </form>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
                <button
                  type="button"
                  className="btn-small"
                  style={{ fontSize: 12 }}
                  onClick={() => setShowKeypad((v) => !v)}
                >
                  {showKeypad ? "Ocultar teclado na tela" : "Usar teclado numérico na tela"}
                </button>
                <span style={{ fontSize: 11.5, color: "var(--text-faint)" }}>
                  {operators.filter((o) => o.active !== false).length} ativos
                </span>
              </div>

              {showKeypad && (
                <div className="landing-keypad anim-fade-up">
                  {["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0"].map((k) => (
                    <button
                      key={k}
                      type="button"
                      className="landing-keypad-btn"
                      onClick={() => (k === "C" ? setCode("") : appendDigit(k))}
                    >
                      {k}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="landing-keypad-btn"
                    onClick={backspaceDigit}
                    aria-label="Apagar"
                  >
                    <IconDelete size={16} />
                  </button>
                </div>
              )}

              <div className="landing-login-hints">
                <span><IconCheck size={13} /> Teclado numérico ativo</span>
                <span><IconCheck size={13} /> Acesso personalizado</span>
              </div>
            </div>
          ) : (
            <div className="landing-blueprint-card">
              <div className="landing-blueprint-bar">
                <div style={{ display: "flex", gap: 6 }}>
                  <span className="landing-dot" style={{ background: "#ef4444" }} />
                  <span className="landing-dot" style={{ background: "#f59e0b" }} />
                  <span className="landing-dot" style={{ background: "#10b981" }} />
                </div>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.04em" }}>
                  PLANTA AO VIVO · 2D & 3D 360°
                </span>
                <span className="landing-live-badge">● LIVE</span>
              </div>

              <div className="landing-blueprint-grid">
                <div className="bp-block bp-rack" style={{ gridColumn: "1 / 3", gridRow: "1 / 3" }}>
                  <span>1A · PRATELEIRA</span>
                  <small>Curva A · 94%</small>
                </div>
                <div className="bp-block bp-rack" style={{ gridColumn: "3 / 5", gridRow: "1 / 3" }}>
                  <span>1B · PRATELEIRA</span>
                  <small>Curva B · 68%</small>
                </div>
                <div className="bp-block bp-stairs" style={{ gridColumn: "5 / 6", gridRow: "1 / 2" }}>
                  <span>ESCADA</span>
                  <small>↑ 1º Andar</small>
                </div>
                <div className="bp-block bp-elev" style={{ gridColumn: "5 / 6", gridRow: "2 / 3" }}>
                  <span>ELEVADOR</span>
                  <small>⇅ Carga</small>
                </div>
                <div className="bp-block bp-corridor" style={{ gridColumn: "1 / 6", gridRow: "3 / 4" }}>
                  <span>⟶ CORREDOR PRINCIPAL · FLUXO DE EXPEDIÇÃO ⟶</span>
                </div>
                <div className="bp-block bp-conf-ped" style={{ gridColumn: "1 / 3", gridRow: "4 / 5" }}>
                  <span>✓ MESA PEDIDOS</span>
                  <small>Conferência</small>
                </div>
                <div className="bp-block bp-conf-tr" style={{ gridColumn: "3 / 5", gridRow: "4 / 5" }}>
                  <span>⇄ TRANSFERÊNCIA</span>
                  <small>Filiais</small>
                </div>
                <div className="bp-block bp-cart" style={{ gridColumn: "5 / 6", gridRow: "4 / 5" }}>
                  <span>APOIO</span>
                  <small>Carro</small>
                </div>
              </div>

              <div className="landing-blueprint-foot">
                <span><IconCheck size={13} /> Rotação livre 360°</span>
                <span><IconCheck size={13} /> Multi-andares</span>
                <span><IconCheck size={13} /> {currentOperator ? `Logado: ${currentOperator.name}` : "Sincronizado"}</span>
              </div>
            </div>
          )}
        </section>

        <section id="recursos" className="landing-section">
          <div className="landing-section-head">
            <h2 className="landing-section-title">O que você faz no Aponta CD</h2>
            <p className="landing-section-sub">
              Funcionalidades integradas para agilizar o dia a dia de operadores, líderes e gestão.
            </p>
          </div>

          <div className="landing-bento">
            {FEATURES.map(({ Icon, color, title, desc }, idx) => (
              <div
                key={title}
                className="landing-feature-card"
                style={{ animationDelay: `${idx * 55}ms` }}
              >
                <div className="landing-feature-icon" style={{ background: `${color}1f`, color }}>
                  <Icon size={20} />
                </div>
                <div style={{ fontSize: 15.5, fontWeight: 700 }}>{title}</div>
                <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: "var(--text-muted)" }}>
                  {desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="landing-section" style={{ paddingTop: 20 }}>
          <div className="landing-section-head">
            <h2 className="landing-section-title">Dúvidas rápidas</h2>
            <p className="landing-section-sub">
              Toque em qualquer pergunta para abrir a explicação.
            </p>
          </div>

          <div className="landing-faq-box">
            <Accordion items={FAQ_ITEMS} defaultOpen={[0]} />
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        Aponta CD · Sistema Integrado de Gestão de Centro de Distribuição
      </footer>
    </div>
  );
}
