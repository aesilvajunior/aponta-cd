import React, { useMemo } from "react";
import { fmtDate, fmtDuration, localISODate, shiftFor, todayLocalISODate } from "../lib/format";
import {
  IconActivity,
  IconAlertTriangle,
  IconClipboardCheck,
  IconCheckSquare,
  IconCalendar,
  IconMapPin,
  IconLayers,
  IconPackage,
  IconRotateCcw,
  IconStar,
  IconLayoutDashboard,
  IconCloudSun,
  IconSun,
  IconMoon,
  IconChevronRight,
} from "./Icons";

function getGreeting(hour) {
  if (hour < 12) return { text: "Bom dia", Icon: IconCloudSun };
  if (hour < 18) return { text: "Boa tarde", Icon: IconSun };
  return { text: "Boa noite", Icon: IconMoon };
}

/**
 * EmployeeHome — Tela inicial acolhedora estilo Claude após o login do funcionário:
 * dá bom dia / boa tarde / boa noite, mostra um resumo rápido do turno e pergunta
 * o que o colaborador deseja fazer hoje com cartões de ação em 1 clique.
 */
export default function EmployeeHome({
  currentOperator,
  isLeader = false,
  isAdmin = false,
  entries = [],
  activeSessions = [],
  onSelectTab,
}) {
  const now = new Date();
  const { text: greeting, Icon: GreetingIcon } = getGreeting(now.getHours());
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
      key: "checklist",
      label: "Checklist do CD",
      desc: "Abertura e fechamento operacional do galpão",
      Icon: IconCheckSquare,
    },
    {
      key: "stock-map",
      label: "Mapa 2D do estoque",
      desc: "Consultar ruas, produtos e editar layout",
      Icon: IconMapPin,
    },
    {
      key: "stock-map-3d",
      label: "Mapa 3D",
      desc: "Explorar galpão, andares e rotação em 3D",
      Icon: IconLayers,
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
      key: "rotation",
      label: "Rotação de tarefas",
      desc: "Escala de organização e limpeza do setor",
      Icon: IconRotateCcw,
    },
  ];

  if (isLeader) {
    primaryActions.push({
      key: "daily-routine",
      label: "Rotina do Líder",
      desc: "Acompanhamento de metas e inventário cíclico",
      Icon: IconStar,
    });
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
        <div className="emp-home-date-pill">
          <GreetingIcon size={14} />
          <span>
            Turno {shiftFor(now)} · {fmtDate(now)}
          </span>
        </div>

        <h1 className="emp-home-greeting">
          <span className="emp-home-spark" aria-hidden="true">✳</span>
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
