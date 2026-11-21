import React from "react";
import ThemeToggle from "./ThemeToggle";
import { Accordion } from "./ui/Accordion";
import {
  IconActivity,
  IconLayers,
  IconMapPin,
  IconClipboardCheck,
  IconShield,
  IconTrendingUp,
  IconPackage,
  IconTv,
  IconChevronRight,
  IconCheck,
} from "./Icons";

const FEATURES = [
  {
    Icon: IconActivity,
    color: "#3b82f6",
    title: "Kiosk de Apontamento & Conferência",
    desc: "Registro ágil por teclado numérico, código de barras ou toque, com fila offline automática e monitoramento de SLA.",
  },
  {
    Icon: IconLayers,
    color: "#8b5cf6",
    title: "Editor de Mapa 2D e 3D",
    desc: "Crie, mova e redimensione prateleiras, escadas, elevadores, salas, mesas de conferência (pedidos/transferência), carros de apoio e andares.",
  },
  {
    Icon: IconPackage,
    color: "#10b981",
    title: "Coleta & Etiquetas de Endereço",
    desc: "Padrão compacto do CD (ex.: 1C1105EA) com regra automática de corredor par (direito) e ímpar (esquerdo).",
  },
  {
    Icon: IconTrendingUp,
    color: "#f59e0b",
    title: "Slotting ABC & Carga de Trabalho",
    desc: "Mapa de calor de giro, previsão para 7 dias, comparação de turnos (Manhã e Tarde) e ranking justo da equipe.",
  },
  {
    Icon: IconClipboardCheck,
    color: "#0ea5e9",
    title: "Checklist do CD & Rotina do Líder",
    desc: "Abertura e fechamento auditados por operador com suporte total ao teclado numérico e histórico salvo no banco.",
  },
  {
    Icon: IconShield,
    color: "#ef4444",
    title: "Detecção de Fraude & Relatórios",
    desc: "Varredura inteligente de anomalias em lançamentos, trilha de auditoria e exportação instantânea em CSV/Excel.",
  },
];

const FAQ_ITEMS = [
  {
    question: "Como funciona a edição nos Mapas 2D e 3D?",
    answer:
      "Ative o Modo Edição tanto no Mapa 2D quanto no Mapa 3D para criar novos objetos (prateleiras, escadas, elevadores, salas, mesas de conferência de pedidos ou transferência, carros de apoio e corredores), escolher ou criar andares e arrastar os objetos diretamente pelo piso — tudo salvo em tempo real no Supabase.",
  },
  {
    question: "O sistema funciona no chão de fábrica com tablet ou coletor?",
    answer:
      "Sim. As telas de Kiosk, Conferência, Checklist do CD e Coleta de Endereços foram projetadas para uso com luvas, leitor de código de barras USB/Bluetooth, câmera do celular e teclado numérico, com fila offline segura.",
  },
  {
    question: "Como são geradas as etiquetas de endereço do CD?",
    answer:
      "O módulo aceita endereçamento por área do mapa ou no padrão compacto do CD (ex.: 1C1105EA), aplicando automaticamente lado par = direito e lado ímpar = esquerdo, com QR Codes prontos para impressão.",
  },
  {
    question: "Consigo exibir o andamento do turno em uma TV no galpão?",
    answer:
      "Sim. O Painel TV (/tv) mostra as atividades em andamento e produtividade do dia em tela cheia, sem precisar de login ou navegação lateral.",
  },
];

export default function LandingPage({
  onEnterLogin,
  isAuthenticated = false,
  onOpenMap2D,
  onOpenMap3D,
}) {
  return (
    <div className={`landing-page anim-fade-up ${isAuthenticated ? "landing-embedded" : ""}`}>
      {!isAuthenticated && (
        <header className="landing-nav">
          <div className="landing-nav-inner">
            <div className="landing-brand">
              <div className="sidebar-brand-mark">AC</div>
              <span>Aponta CD</span>
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
              <button
                type="button"
                className="btn btn-primary"
                style={{ padding: "8px 16px", fontSize: 13.5 }}
                onClick={onEnterLogin}
              >
                Entrar no sistema <IconChevronRight size={15} />
              </button>
            </div>
          </div>
        </header>
      )}

      <main className="landing-container">
        <section className="landing-hero">
          <div>
            <div className="landing-pill">
              <IconMapPin size={13} /> Gestão Operacional · Mapa 2D/3D Editável · Tempo Real
            </div>
            <h1 className="landing-h1">
              Seu Centro de Distribuição sob <span>controle total</span>
            </h1>
            <p className="landing-lead">
              Apontamento de produtividade, conferência, planta interativa 2D e 3D com edição ao vivo de
              prateleiras, escadas, elevadores, salas e andares, slotting por Curva ABC e auditoria completa.
            </p>

            <div className="landing-cta-row">
              <button
                type="button"
                className="btn btn-primary"
                style={{ padding: "12px 24px", fontSize: 15 }}
                onClick={onEnterLogin}
              >
                {isAuthenticated ? "Ir para o Kiosk" : "Acessar plataforma"} <IconChevronRight size={16} />
              </button>
              {isAuthenticated && onOpenMap2D && onOpenMap3D ? (
                <>
                  <button type="button" className="btn btn-secondary" style={{ padding: "12px 18px", fontSize: 14 }} onClick={onOpenMap2D}>
                    Abrir Mapa 2D
                  </button>
                  <button type="button" className="btn btn-secondary" style={{ padding: "12px 18px", fontSize: 14 }} onClick={onOpenMap3D}>
                    Abrir Mapa 3D
                  </button>
                </>
              ) : (
                <a
                  href="#recursos"
                  className="btn btn-secondary"
                  style={{ padding: "12px 20px", fontSize: 14.5, textDecoration: "none" }}
                >
                  Explorar módulos
                </a>
              )}
            </div>

            <div className="landing-stats">
              <div>
                <div className="landing-stat-val">2D + 3D</div>
                <div className="landing-stat-lbl">Editor interativo de layout</div>
              </div>
              <div>
                <div className="landing-stat-val">Curva ABC</div>
                <div className="landing-stat-lbl">Mapa de calor e slotting</div>
              </div>
              <div>
                <div className="landing-stat-val">Offline-first</div>
                <div className="landing-stat-lbl">Fila segura no galpão</div>
              </div>
            </div>
          </div>

          {/* Visual interactive warehouse blueprint preview */}
          <div className="landing-blueprint-card">
            <div className="landing-blueprint-bar">
              <div style={{ display: "flex", gap: 6 }}>
                <span className="landing-dot" style={{ background: "#ef4444" }} />
                <span className="landing-dot" style={{ background: "#f59e0b" }} />
                <span className="landing-dot" style={{ background: "#10b981" }} />
              </div>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.04em" }}>
                PLANTA AO VIVO · TÉRREO & 1º ANDAR
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
              <span><IconCheck size={13} /> Arraste para mover</span>
              <span><IconCheck size={13} /> Multi-andares</span>
              <span><IconCheck size={13} /> Sincronizado 2D/3D</span>
            </div>
          </div>
        </section>

        <section id="recursos" className="landing-section">
          <div className="landing-section-head">
            <h2 className="landing-section-title">Projetado para a rotina real do CD</h2>
            <p className="landing-section-sub">
              Cada módulo foi pensado para velocidade no chão de fábrica e clareza na tomada de decisão.
            </p>
          </div>

          <div className="landing-bento">
            {FEATURES.map(({ Icon, color, title, desc }) => (
              <div key={title} className="landing-feature-card">
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

        <section className="landing-section">
          <div className="landing-section-head">
            <h2 className="landing-section-title">Perguntas frequentes</h2>
            <p className="landing-section-sub">
              Clique nos itens abaixo para abrir os detalhes com transição em aba dobrável.
            </p>
          </div>

          <div className="landing-faq-box">
            <Accordion items={FAQ_ITEMS} defaultOpen={[0]} />
          </div>
        </section>

        <section className="landing-cta-banner">
          <h2 style={{ fontSize: "clamp(22px, 3vw, 30px)", fontWeight: 800, margin: "0 0 10px 0" }}>
            {isAuthenticated ? "Tudo pronto para gerenciar seu turno" : "Pronto para iniciar o turno?"}
          </h2>
          <p style={{ margin: "0 0 22px 0", fontSize: 15, color: "var(--text-muted)" }}>
            {isAuthenticated
              ? "Use o menu lateral organizado por categorias ou acesse diretamente a operação."
              : "Entre com sua conta da equipe para acessar o painel completo de operação e mapas."}
          </p>
          <button
            type="button"
            className="btn btn-primary"
            style={{ padding: "12px 28px", fontSize: 15 }}
            onClick={onEnterLogin}
          >
            {isAuthenticated ? "Abrir Operação" : "Entrar agora"} <IconChevronRight size={16} />
          </button>
        </section>
      </main>

      <footer className="landing-footer">
        Aponta CD · Sistema Integrado de Gestão de Centro de Distribuição
      </footer>
    </div>
  );
}
