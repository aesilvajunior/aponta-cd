import React, { useMemo } from "react";
import { fmtDuration, localISODate, todayLocalISODate } from "../lib/format";
import {
  IconActivity,
  IconAlertTriangle,
  IconClipboardCheck,
  IconCheckSquare,
  IconCalendar,
  IconMapPin,
  IconPackage,
  IconRotateCcw,
  IconStar,
  IconLayoutDashboard,
  IconChevronRight,
  IconUsers,
  IconTruck,
} from "./Icons";

function getGreeting(hour) {
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

function LogisticsGreetingBadge() {
  return (
    <span className="emp-logistics-anim" aria-hidden="true">
      <svg viewBox="0 0 44 36" width="38" height="32">
        {/* Esteira logística + caixa isométrica em movimento */}
        <line x1="4" y1="29" x2="40" y2="29" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="4 4" className="iso-flow-path" />
        <g className="iso-float-slow">
          <polygon points="22,6 10,12 22,18 34,12" fill="var(--accent-2, #38bdf8)" />
          <polygon points="22,18 10,12 10,23 22,29" fill="var(--accent, #4a7ba7)" />
          <polygon points="22,18 34,12 34,23 22,29" fill="#1d356b" />
        </g>
      </svg>
    </span>
  );
}

export default function EmployeeHome({
  currentOperator,
  isLeader = false,
  isAdmin = false,
  entries = [],
  activeSessions = [],
  onSelectTab,
}) {
  const now = new Date();
  const greeting = getGreeting(now.getHours());
  const firstName = (currentOperator?.name || "Operador").trim().split(/\s+/)[0];

  const myActive = useMemo(() => {
    if (!currentOperator) return null;
    return (activeSessions || []).find(
      (s) => String(s.operator_code) === String(currentOperator.code)
    ) || null;
  }, [activeSessions, currentOperator]);

  const myToday = useMemo(() => {
    if (!currentOperator) return { count: 0, totalSec: 0 };
    const today = todayLocalISODate();
    const list = (entries || []).filter(
      (e) =>
        String(e.operator_code) === String(currentOperator.code) &&
        localISODate(e.start_time) === today
    );
    return {
      count: list.length,
      totalSec: list.reduce((s, e) => s + (e.duration_seconds || 0), 0),
    };
  }, [entries, currentOperator]);

  const primaryActions = [
    {
      key: "kiosk",
      label: "Apontar atividade",
      desc: myActive ? `Em andamento: ${myActive.activity}` : "Iniciar ou finalizar tarefa do turno",
      Icon: IconActivity,
      highlight: true,
    },
    {
      key: "errors-kiosk",
      label: "Apontar erro",
      desc: "Registrar ocorrência ou divergência de separação",
      Icon: IconAlertTriangle,
    },
    {
      key: "conference",
      label: "Conferência",
      desc: "Conferir pedidos, transferências e fila da mesa",
      Icon: IconClipboardCheck,
    },
    {
      key: "stock-map",
      label: "Mapa do estoque (2D & 3D)",
      desc: "Consultar ruas, produtos e visualizar o galpão",
      Icon: IconMapPin,
    },
    {
      key: "stock-scan",
      label: "Coletar endereços",
      desc: "Bipar produtos e atualizar posições no estoque",
      Icon: IconPackage,
    },
    {
      key: "schedules",
      label: "Agenda",
      desc: "Recebimentos programados e janelas do dia",
      Icon: IconCalendar,
    },
    {
      key: "sales-query",
      label: "Líder da equipe comercial",
      desc: "Consultar carteiras, líderes e representantes",
      Icon: IconUsers,
    },
    {
      key: "badges",
      label: "Meu crachá",
      desc: "Visualizar, imprimir ou exportar seu crachá em PDF",
      Icon: IconStar,
    },
    {
      key: "equipment",
      label: "Equipamentos",
      desc: "Consultar coletores, notebooks e responsáveis",
      Icon: IconTruck,
    },
  ];

  // Tarefas restritas apenas a Gestor/Líder ou Admin
  if (isLeader || isAdmin) {
    primaryActions.push(
      {
        key: "checklist",
        label: "Checklist do CD",
        desc: "Abertura e fechamento operacional do galpão",
        Icon: IconCheckSquare,
      },
      {
        key: "rotation",
        label: "Rotação de tarefas",
        desc: "Escala de organização e limpeza do setor",
        Icon: IconRotateCcw,
      },
      {
        key: "daily-routine",
        label: "Rotina do Líder",
        desc: "Acompanhamento de metas e inventário cíclico",
        Icon: IconStar,
      }
    );
  }

  if (isAdmin) {
    primaryActions.push({
      key: "panel",
      label: "Indicadores",
      desc: "Painel completo de métricas, filtros e exportações",
      Icon: IconLayoutDashboard,
    });
  }

  return (
    <div className="emp-home anim-fade-up">
      <div className="emp-home-hero">
        <h1 className="emp-home-greeting">
          <LogisticsGreetingBadge />
          <span>
            {greeting}, {firstName}.
          </span>
        </h1>

        <p className="emp-home-sub">
          O que você gostaria de fazer hoje?
        </p>

        <div className="emp-home-status-row">
          <span className="emp-home-chip">
            <strong>{myToday.count}</strong> {myToday.count === 1 ? "atividade hoje" : "atividades hoje"}
          </span>
          <span className="emp-home-chip">
            <strong>{fmtDuration(myToday.totalSec)}</strong> no turno
          </span>
          {myActive ? (
            <button
              type="button"
              className="emp-home-chip emp-home-chip-live"
              onClick={() => onSelectTab?.("kiosk")}
            >
              <span className="emp-live-dot" />
              Em andamento: <strong>{myActive.activity}</strong> →
            </button>
          ) : (
            <span className="emp-home-chip">Pronto para iniciar</span>
          )}
        </div>
      </div>

      <div className="emp-home-grid">
        {primaryActions.map(({ key, label, desc, Icon, highlight }, idx) => (
          <button
            key={key}
            type="button"
            className={`emp-action-card ${highlight ? "emp-action-primary" : ""}`}
            style={{ animationDelay: `${idx * 35}ms` }}
            onClick={() => onSelectTab?.(key)}
          >
            <div className="emp-action-top">
              <span className="emp-action-icon">
                <Icon size={20} />
              </span>
              <span className="emp-action-arrow">
                <IconChevronRight size={15} />
              </span>
            </div>
            <div className="emp-action-title">{label}</div>
            <div className="emp-action-desc">{desc}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
