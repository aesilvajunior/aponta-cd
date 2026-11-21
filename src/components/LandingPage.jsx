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
} from "./Icons";

const FEATURES = [
  {
    Icon: IconActivity,
    color: "#3b82f6",
    title: "Kiosk de Apontamento & Conferência",
    desc: "Registro rápido por teclado numérico, código de barras ou toque, com suporte offline automático e cálculo de SLA.",
  },
  {
    Icon: IconLayers,
    color: "#8b5cf6",
    title: "Mapa 2D e 3D Editável",
    desc: "Crie, mova e redimensione prateleiras, escadas, elevadores, salas, mesas de conferência, carros de apoio e andares.",
  },
  {
    Icon: IconPackage,
    color: "#10b981",
    title: "Coleta & Etiquetas de Endereço",
    desc: "Padrão compacto do CD (ex.: 1C1105EA) com identificação automática de lado par (direito) e ímpar (esquerdo).",
  },
  {
    Icon: IconTrendingUp,
    color: "#f59e0b",
    title: "Slotting ABC & Carga de Trabalho",
    desc: "Mapa de calor de giro, previsão de demanda para 7 dias, comparação de turnos (Manhã e Tarde) e ranking justo.",
  },
  {
    Icon: IconClipboardCheck,
    color: "#0ea5e9",
    title: "Checklist do CD & Rotina do Líder",
    desc: "Abertura e fechamento auditados por operador com progresso em tempo real e histórico completo.",
  },
  {
    Icon: IconShield,
    color: "#ef4444",
    title: "Detecção de Fraude & Auditoria",
    desc: "Monitoramento de anomalias em lançamentos, trilha de auditoria de mapa/operação e exportação instantânea em CSV/Excel.",
  },
];

const FAQ_ITEMS = [
  {
    question: "Como funciona o mapeamento 2D e 3D do galpão?",
    answer:
      "Você pode ativar o Modo Edição tanto no Mapa 2D quanto no Mapa 3D para criar e mover prateleiras, escadas, elevadores, mesas de conferência (pedidos e transferência), carros de apoio, salas, corredores e múltiplos andares. Todas as alterações ficam sincronizadas em tempo real no Supabase.",
  },
  {
    question: "O sistema funciona no chão de fábrica com tablet ou coletor?",
    answer:
      "Sim. As telas de Kiosk, Conferência, Checklist do CD e Coleta de Endereços foram projetadas para uso com luvas, leitor de código de barras USB/Bluetooth, câmera do celular e teclado numérico, mantendo fila offline caso a internet oscile.",
  },
  {
    question: "Como são organizadas as etiquetas de endereço do CD?",
    answer:
      "O gerador aceita tanto endereços por área do mapa quanto o padrão compacto do CD (ex.: 1C1105EA), aplicando automaticamente a regra de corredor par no lado direito e ímpar no lado esquerdo, prontos para impressão em QR Code.",
  },
  {
    question: "Consigo acompanhar a operação em uma TV no galpão?",
    answer:
      "Sim. O Painel TV (/tv) exibe as atividades ativas, metas do dia e andamento da equipe em tela cheia sem exigir navegação lateral.",
  },
];

export default function LandingPage({ onEnterLogin }) {
  return (
    <div className="landing-page anim-fade-up">
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
            <button type="button" className="btn btn-primary" style={{ padding: "8px 16px", fontSize: 13.5 }} onClick={onEnterLogin}>
              Entrar no sistema <IconChevronRight size={15} />
            </button>
          </div>
        </div>
      </header>

      <main className="landing-container">
        <section className="landing-hero">
          <div>
            <div className="landing-pill">
              <IconMapPin size={13} /> Gestão Operacional · Mapa 2D/3D · Tempo Real
            </div>
            <h1 className="landing-h1">
              Controle completo do seu <span>Centro de Distribuição</span>
            </h1>
            <p className="landing-lead">
              Apontamento de produtividade, conferência, mapa interativo 2D e 3D com edição de layout,
              slotting por curva ABC, checklist operacional e auditoria em uma única plataforma rápida e responsiva.
            </p>

            <div className="landing-cta-row">
              <button
                type="button"
                className="btn btn-primary"
                style={{ padding: "12px 24px", fontSize: 15 }}
                onClick={onEnterLogin}
              >
                Acessar plataforma <IconChevronRight size={16} />
              </button>
              <a
                href="#recursos"
                className="btn btn-secondary"
                style={{ padding: "12px 20px", fontSize: 14.5, textDecoration: "none" }}
              >
                Ver recursos
              </a>
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
                <div className="landing-stat-lbl">Fila segura no chão de fábrica</div>
              </div>
            </div>
          </div>

          <div className="landing-preview-stack">
            <div className="landing-preview-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--accent)" }}>
                  Mapa 2D & 3D Interativo
                </span>
                <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: "rgba(16, 185, 129, 0.14)", color: "#10b981" }}>
                  Editável
                </span>
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
                Prateleiras, Escadas, Elevadores e Mesas
              </div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>
                Diferenciação visual de mesas de Pedidos, Transferência e Carros de Apoio, com suporte a múltiplos andares.
              </div>
            </div>

            <div className="landing-preview-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#f59e0b" }}>
                  Operação em Turnos
                </span>
                <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: "rgba(245, 158, 11, 0.14)", color: "#f59e0b" }}>
                  Manhã · Tarde
                </span>
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
                Checklist, Pausas e Carga de Trabalho
              </div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>
                Acompanhamento por operador, atividade, estação e dia da semana com previsão para os próximos 7 dias.
              </div>
            </div>

            <div className="landing-preview-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#8b5cf6" }}>
                  Rastreabilidade
                </span>
                <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: "rgba(139, 92, 246, 0.14)", color: "#8b5cf6" }}>
                  QR & EAN
                </span>
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
                Endereçamento Padrão CD (ex.: 1C1105EA)
              </div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>
                Impressão de etiquetas, coleta por leitor/câmera e inventário cíclico priorizado por giro.
              </div>
            </div>
          </div>
        </section>

        <section id="recursos" className="landing-section">
          <div className="landing-section-head">
            <h2 className="landing-section-title">Tudo o que a operação do CD precisa</h2>
            <p className="landing-section-sub">
              Módulos integrados para operadores, líderes de turno e gestão logística.
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
              Entenda rapidamente como cada módulo acelera a rotina do seu centro de distribuição.
            </p>
          </div>

          <div className="landing-faq-box">
            <Accordion items={FAQ_ITEMS} defaultOpen={[0]} />
          </div>
        </section>

        <section className="landing-cta-banner">
          <h2 style={{ fontSize: "clamp(22px, 3vw, 30px)", fontWeight: 800, margin: "0 0 10px 0" }}>
            Pronto para iniciar o turno?
          </h2>
          <p style={{ margin: "0 0 22px 0", fontSize: 15, color: "var(--text-muted)" }}>
            Entre com sua conta da equipe para acessar o painel completo de operação e mapas.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            style={{ padding: "12px 28px", fontSize: 15 }}
            onClick={onEnterLogin}
          >
            Entrar agora <IconChevronRight size={16} />
          </button>
        </section>
      </main>

      <footer className="landing-footer">
        Aponta CD · Sistema Integrado de Gestão de Centro de Distribuição
      </footer>
    </div>
  );
}
