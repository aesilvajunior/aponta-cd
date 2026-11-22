import React, { useEffect, useMemo, useState } from "react";
import { fmtDuration, localISODate, todayLocalISODate } from "../lib/format";
import { getOperatorProfileCustom } from "../lib/operatorProfileCustom";
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
  IconUser,
  IconTruck,
  IconTv,
  IconSearch,
} from "./Icons";

function getGreeting(hour) {
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

function getShiftLabel(hour) {
  if (hour >= 5 && hour < 14) return "Turno Manhã (06:00 – 14:00)";
  if (hour >= 14 && hour < 22) return "Turno Tarde (14:00 – 22:00)";
  return "Turno Noite (22:00 – 06:00)";
}

function getInitials(name = "OP") {
  const parts = String(name || "OP").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "OP";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function fmtTimeShort(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export default function EmployeeHome({
  currentOperator,
  isLeader = false,
  isAdmin = false,
  entries = [],
  activeSessions = [],
  onSelectTab,
}) {
  const [cockpitView, setCockpitView] = useState("overview"); // "overview" | "today" | "modules"
  const [moduleSearch, setModuleSearch] = useState("");
  const [tableFilter, setTableFilter] = useState("all"); // "all" | "active" | "done"
  const [tableSearch, setTableSearch] = useState("");
  const [nowTs, setNowTs] = useState(() => Date.now());
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== "undefined" ? navigator.onLine : true));
  const [profileCustom, setProfileCustom] = useState(() =>
    getOperatorProfileCustom(currentOperator?.code)
  );

  // Atualiza relógio, cronômetro da atividade ativa e status online/offline
  useEffect(() => {
    const interval = setInterval(() => setNowTs(Date.now()), 1000);
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    const onProfile = (ev) => {
      if (!ev?.detail?.code || String(ev.detail.code) === String(currentOperator?.code)) {
        setProfileCustom(getOperatorProfileCustom(currentOperator?.code));
      }
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("aponta:profile-updated", onProfile);
    return () => {
      clearInterval(interval);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("aponta:profile-updated", onProfile);
    };
  }, [currentOperator?.code]);

  useEffect(() => {
    setProfileCustom(getOperatorProfileCustom(currentOperator?.code));
  }, [currentOperator?.code]);

  const nowDate = new Date(nowTs);
  const greeting = getGreeting(nowDate.getHours());
  const shiftLabel = getShiftLabel(nowDate.getHours());
  const clockStr = nowDate.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const displayName = profileCustom.nickname || currentOperator?.name || "Operador";
  const firstName = displayName.trim().split(/\s+/)[0];
  const roleLabel = isAdmin ? "Administrador" : isLeader ? "Líder de Turno" : "Operador CD";

  const myActive = useMemo(() => {
    if (!currentOperator) return null;
    return (
      (activeSessions || []).find(
        (s) => String(s.operator_code) === String(currentOperator.code)
      ) || null
    );
  }, [activeSessions, currentOperator]);

  const activeElapsedSec = useMemo(() => {
    if (!myActive?.start_time) return 0;
    const diff = Math.floor((nowTs - new Date(myActive.start_time).getTime()) / 1000);
    return Math.max(0, diff);
  }, [myActive, nowTs]);

  const myToday = useMemo(() => {
    if (!currentOperator) return { count: 0, totalSec: 0, avgSec: 0, list: [] };
    const today = todayLocalISODate();
    const list = (entries || [])
      .filter(
        (e) =>
          String(e.operator_code) === String(currentOperator.code) &&
          localISODate(e.start_time) === today
      )
      .sort((a, b) => new Date(b.start_time || 0) - new Date(a.start_time || 0));
    const totalSec = list.reduce((s, e) => s + (e.duration_seconds || 0), 0);
    return {
      count: list.length,
      totalSec,
      avgSec: list.length > 0 ? Math.round(totalSec / list.length) : 0,
      list,
    };
  }, [entries, currentOperator]);

  const allModules = useMemo(() => {
    const list = [
      {
        key: "kiosk",
        label: "Apontar atividade",
        desc: myActive ? `Em andamento: ${myActive.activity}` : "Iniciar ou finalizar tarefa do turno",
        Icon: IconActivity,
        category: "Operação",
        highlight: true,
      },
      {
        key: "errors-kiosk",
        label: "Apontar erro",
        desc: "Registrar ocorrência ou divergência de separação",
        Icon: IconAlertTriangle,
        category: "Qualidade",
      },
      {
        key: "conference",
        label: "Conferência",
        desc: "Conferir pedidos, transferências e fila da mesa",
        Icon: IconClipboardCheck,
        category: "Operação",
      },
      {
        key: "stock-map",
        label: "Mapa do estoque (2D & 3D)",
        desc: "Consultar ruas, produtos e visualizar o galpão",
        Icon: IconMapPin,
        category: "Espacial",
      },
      {
        key: "stock-scan",
        label: "Coletar endereços",
        desc: "Bipar produtos e atualizar posições no estoque",
        Icon: IconPackage,
        category: "Espacial",
      },
      {
        key: "schedules",
        label: "Agenda",
        desc: "Recebimentos programados e janelas do dia",
        Icon: IconCalendar,
        category: "Operação",
      },
      {
        key: "sales-query",
        label: "Líder da equipe comercial",
        desc: "Consultar carteiras, líderes e representantes",
        Icon: IconUsers,
        category: "Consulta",
      },
      {
        key: "my-profile",
        label: "Meu perfil",
        desc: "Sua produtividade, ranking, foto e personalização",
        Icon: IconUser,
        category: "Pessoal",
      },
      {
        key: "badges",
        label: isAdmin ? "Crachás da equipe" : "Meu crachá",
        desc: isAdmin
          ? "Visualizar, editar, imprimir ou exportar crachás"
          : "Visualizar, imprimir ou exportar seu crachá em PDF",
        Icon: IconStar,
        category: "Pessoal",
      },
      {
        key: "equipment",
        label: "Equipamentos",
        desc: "Consultar coletores, notebooks e responsáveis",
        Icon: IconTruck,
        category: "Recursos",
      },
    ];

    if (isLeader || isAdmin) {
      list.push(
        {
          key: "checklist",
          label: "Checklist do CD",
          desc: "Abertura e fechamento operacional do galpão",
          Icon: IconCheckSquare,
          category: "Liderança",
        },
        {
          key: "rotation",
          label: "Rotação de tarefas",
          desc: "Escala de organização e limpeza do setor",
          Icon: IconRotateCcw,
          category: "Liderança",
        },
        {
          key: "daily-routine",
          label: "Rotina do Líder",
          desc: "Acompanhamento de metas e inventário cíclico",
          Icon: IconStar,
          category: "Liderança",
        }
      );
    }

    if (isAdmin) {
      list.push({
        key: "panel",
        label: "Indicadores",
        desc: "Painel completo de métricas, filtros e exportações",
        Icon: IconLayoutDashboard,
        category: "Gestão",
      });
    }

    return list;
  }, [myActive, isLeader, isAdmin]);

  const filteredModules = useMemo(() => {
    const q = moduleSearch.trim().toLowerCase();
    if (!q) return allModules;
    return allModules.filter(
      (m) =>
        m.label.toLowerCase().includes(q) ||
        m.desc.toLowerCase().includes(q) ||
        m.category.toLowerCase().includes(q)
    );
  }, [allModules, moduleSearch]);

  const todayTableRows = useMemo(() => {
    const rows = [];
    if (myActive) {
      rows.push({
        id: `active-${myActive.id || "now"}`,
        activity: myActive.activity || "Atividade em andamento",
        detail: myActive.vehicle || myActive.notes || "Sessão ativa no terminal",
        startTime: fmtTimeShort(myActive.start_time),
        endTime: "Agora",
        duration: fmtDuration(activeElapsedSec),
        status: "active",
      });
    }
    myToday.list.forEach((e, idx) => {
      rows.push({
        id: e.id || `entry-${idx}`,
        activity: e.activity || "Atividade",
        detail: e.vehicle || e.notes || "Apontamento registrado",
        startTime: fmtTimeShort(e.start_time),
        endTime: fmtTimeShort(e.end_time),
        duration: fmtDuration(e.duration_seconds || 0),
        status: "done",
      });
    });

    const q = tableSearch.trim().toLowerCase();
    return rows.filter((r) => {
      if (tableFilter === "active" && r.status !== "active") return false;
      if (tableFilter === "done" && r.status !== "done") return false;
      if (!q) return true;
      return (
        r.activity.toLowerCase().includes(q) ||
        r.detail.toLowerCase().includes(q)
      );
    });
  }, [myActive, activeElapsedSec, myToday.list, tableFilter, tableSearch]);

  const progressPct = Math.min(100, Math.round((myToday.count / 12) * 100));

  return (
    <div className="cp-cockpit anim-fade-up">
      {/* ============ SUB-HEADER COMMAND STRIP ============ */}
      <section className="cp-command-bar">
        <div className="cp-command-left">
          <div className="cp-warehouse-icon" aria-hidden="true">
            <IconPackage size={24} />
          </div>
          <div>
            <div className="cp-title-row">
              <h1>Área do Funcionário &amp; Cockpit Operacional</h1>
              <span className="cp-shift-pill">
                <span className="cp-pulse-dot" aria-hidden="true" />
                <span>{greeting}, {firstName} • {shiftLabel}</span>
              </span>
            </div>
            <p className="cp-command-sub">
              Centro Logístico Especializado • Apontamento, Conferência, Planta 2D/3D e Rastreabilidade
            </p>
          </div>
        </div>

        <button
          type="button"
          className="cp-operator-badge"
          onClick={() => onSelectTab?.("my-profile")}
          title="Abrir Meu Perfil"
        >
          <div className="cp-avatar-wrap">
            {profileCustom.avatarDataUrl ? (
              <img src={profileCustom.avatarDataUrl} alt={displayName} className="cp-avatar-img" />
            ) : (
              <div className="cp-avatar-initials">{getInitials(displayName)}</div>
            )}
            <span className={`cp-avatar-dot ${myActive ? "is-live" : ""}`} />
          </div>
          <div className="cp-operator-meta">
            <span className="cp-operator-name">{displayName}</span>
            <span className="cp-operator-role">
              {roleLabel} • #{currentOperator?.code || "—"}
            </span>
          </div>
          <span className={`cp-rf-tag ${isOnline ? "is-online" : "is-offline"}`}>
            {isOnline ? "Online" : "Offline"}
          </span>
        </button>
      </section>

      {/* ============ INTERACTIVE SEGMENT NAVIGATION ============ */}
      <section className="cp-tabs-bar">
        <div className="cp-tabs-group">
          <button
            type="button"
            className={`cp-tab-pill ${cockpitView === "overview" ? "active" : ""}`}
            onClick={() => setCockpitView("overview")}
          >
            <IconLayoutDashboard size={15} />
            <span>Visão Geral</span>
          </button>
          <button
            type="button"
            className={`cp-tab-pill ${cockpitView === "today" ? "active" : ""}`}
            onClick={() => setCockpitView("today")}
          >
            <IconActivity size={15} />
            <span>Minhas Atividades de Hoje</span>
            <span className="cp-tab-count">{myToday.count + (myActive ? 1 : 0)}</span>
          </button>
          <button
            type="button"
            className={`cp-tab-pill ${cockpitView === "modules" ? "active" : ""}`}
            onClick={() => setCockpitView("modules")}
          >
            <IconPackage size={15} />
            <span>Módulos do CD</span>
            <span className="cp-tab-count">{allModules.length}</span>
          </button>
          <button
            type="button"
            className="cp-tab-pill"
            onClick={() => onSelectTab?.("stock-map")}
          >
            <IconMapPin size={15} />
            <span>Mapa 2D / 3D</span>
          </button>
          <a
            href="/tv"
            target="_blank"
            rel="noopener noreferrer"
            className="cp-tab-pill"
            style={{ textDecoration: "none" }}
          >
            <IconTv size={15} />
            <span>Painel TV ↗</span>
          </a>
        </div>

        <div className="cp-telemetry-strip">
          <span className="cp-tel-item">
            <span className={`cp-net-dot ${isOnline ? "ok" : "warn"}`} />
            {isOnline ? "Sincronizado" : "Modo Offline"}
          </span>
          <span className="cp-tel-sep">/</span>
          <span className="cp-tel-clock">{clockStr}</span>
        </div>
      </section>

      {/* ============ ROW 1: TACTICAL KPI BAR (8 COLS) + QUICK TERMINAL (4 COLS) ============ */}
      {cockpitView !== "today" && (
        <div className="cp-row-12">
          <div className="cp-kpi-grid">
            <div className="cp-kpi-card">
              <div className="cp-kpi-head">
                <span>Atividades Hoje</span>
                <IconActivity size={17} />
              </div>
              <div className="cp-kpi-val">{myToday.count}</div>
              <div className="cp-kpi-sub">
                {myActive ? "+1 em execução agora" : "Concluídas no turno"}
              </div>
              <div className="cp-kpi-bar">
                <div className="cp-kpi-fill cp-fill-primary" style={{ width: `${Math.max(10, progressPct)}%` }} />
              </div>
            </div>

            <div className="cp-kpi-card">
              <div className="cp-kpi-head">
                <span>Tempo no Turno</span>
                <IconCalendar size={17} />
              </div>
              <div className="cp-kpi-val cp-val-cyan">
                {fmtDuration(myToday.totalSec + activeElapsedSec)}
              </div>
              <div className="cp-kpi-sub">
                {myActive ? "Cronômetro ativo ao vivo" : "Tempo produtivo registrado"}
              </div>
              <div className="cp-kpi-bar">
                <div className="cp-kpi-fill cp-fill-cyan" style={{ width: myToday.totalSec > 0 ? "82%" : "12%" }} />
              </div>
            </div>

            <div className="cp-kpi-card">
              <div className="cp-kpi-head">
                <span>Média / Atividade</span>
                <IconClipboardCheck size={17} />
              </div>
              <div className="cp-kpi-val">
                {myToday.avgSec > 0 ? fmtDuration(myToday.avgSec) : "—"}
              </div>
              <div className="cp-kpi-sub">Ritmo médio do colaborador</div>
              <div className="cp-kpi-bar">
                <div className="cp-kpi-fill cp-fill-emerald" style={{ width: myToday.avgSec > 0 ? "74%" : "8%" }} />
              </div>
            </div>

            <button
              type="button"
              className={`cp-kpi-card cp-kpi-btn ${myActive ? "is-active" : ""}`}
              onClick={() => onSelectTab?.("kiosk")}
            >
              <div className="cp-kpi-head">
                <span>Status Atual</span>
                <IconChevronRight size={16} />
              </div>
              <div className="cp-kpi-status-text">
                {myActive ? myActive.activity : "Pronto p/ iniciar"}
              </div>
              <div className="cp-kpi-sub">
                {myActive ? `Em curso há ${fmtDuration(activeElapsedSec)}` : "Clique para apontar →"}
              </div>
              <div className="cp-kpi-bar">
                <div className={`cp-kpi-fill ${myActive ? "cp-fill-emerald" : "cp-fill-primary"}`} style={{ width: myActive ? "100%" : "25%" }} />
              </div>
            </button>
          </div>

          {/* Quick Action Collector Terminal (4 cols) */}
          <div className="cp-terminal-card">
            <div className="cp-terminal-head">
              <span>Ações Rápidas de Chão</span>
              <span className="cp-terminal-tag">Modo Coletor</span>
            </div>

            <div className="cp-terminal-grid">
              <button
                type="button"
                className="cp-term-btn cp-term-primary"
                onClick={() => onSelectTab?.("kiosk")}
              >
                <IconActivity size={19} />
                <strong>{myActive ? "Ver Atividade" : "Apontar Tarefa"}</strong>
                <span>{myActive ? "Em andamento" : "Iniciar turno"}</span>
              </button>

              <button
                type="button"
                className="cp-term-btn"
                onClick={() => onSelectTab?.("stock-scan")}
              >
                <IconPackage size={19} />
                <strong>Coletar Endereço</strong>
                <span>Bipar / Atualizar</span>
              </button>

              <button
                type="button"
                className="cp-term-btn cp-term-danger"
                onClick={() => onSelectTab?.("errors-kiosk")}
              >
                <IconAlertTriangle size={19} />
                <strong>Apontar Erro</strong>
                <span>Divergência / Avaria</span>
              </button>

              <button
                type="button"
                className="cp-term-btn cp-term-cyan"
                onClick={() => onSelectTab?.("stock-map")}
              >
                <IconMapPin size={19} />
                <strong>Mapa 2D &amp; 3D</strong>
                <span>Consultar galpão</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============ ROW 2: MODULES GRID (8 COLS) + SHIFT FOCUS CARD (4 COLS) ============ */}
      {cockpitView !== "today" && (
        <div className="cp-row-12">
          <div className="cp-modules-panel">
            <div className="cp-panel-head">
              <div>
                <h2>Módulos Operacionais</h2>
                <p>Selecione qualquer função liberada para o seu perfil</p>
              </div>
              <div className="cp-search-box">
                <IconSearch size={15} />
                <input
                  type="text"
                  placeholder="Buscar módulo..."
                  value={moduleSearch}
                  onChange={(e) => setModuleSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="cp-modules-grid">
              {filteredModules.map(({ key, label, desc, Icon, category, highlight }) => (
                <button
                  key={key}
                  type="button"
                  className={`cp-module-card ${highlight ? "is-highlight" : ""}`}
                  onClick={() => onSelectTab?.(key)}
                >
                  <div className="cp-module-top">
                    <span className="cp-module-icon">
                      <Icon size={19} />
                    </span>
                    <span className="cp-module-cat">{category}</span>
                  </div>
                  <div className="cp-module-title">{label}</div>
                  <div className="cp-module-desc">{desc}</div>
                  <div className="cp-module-foot">
                    <span>Abrir</span>
                    <IconChevronRight size={14} />
                  </div>
                </button>
              ))}
              {filteredModules.length === 0 && (
                <div className="cp-empty-inline">
                  Nenhum módulo encontrado para &quot;{moduleSearch}&quot;.
                </div>
              )}
            </div>
          </div>

          {/* Turno em Foco (Stitch Live Focus Card + Rack Photo) */}
          <aside className="cp-focus-card">
            <div>
              <div className="cp-focus-top">
                <span className="cp-focus-kicker">
                  {myActive ? "Executando Agora" : "Resumo do Turno"}
                </span>
                <span className="cp-focus-badge">#{currentOperator?.code || "CD"}</span>
              </div>

              <h3 className="cp-focus-title">
                {myActive ? myActive.activity : `Turno de ${firstName}`}
              </h3>
              <p className="cp-focus-desc">
                {myActive
                  ? "Sessão ativa em tempo real. Finalize no terminal de apontamento assim que concluir."
                  : "Nenhuma atividade em aberto neste momento. Use os atalhos ao lado ou inicie um novo apontamento."}
              </p>

              <div className="cp-focus-specs">
                <div>
                  <span>Perfil:</span>
                  <strong>{roleLabel}</strong>
                </div>
                <div>
                  <span>Atividades hoje:</span>
                  <strong>{myToday.count} concluídas</strong>
                </div>
                <div>
                  <span>Tempo acumulado:</span>
                  <strong className="cp-val-cyan">{fmtDuration(myToday.totalSec + activeElapsedSec)}</strong>
                </div>
                <div>
                  <span>Sessão ativa:</span>
                  <strong>{myActive ? fmtTimeShort(myActive.start_time) : "Nenhuma"}</strong>
                </div>
              </div>
            </div>

            <div className="cp-focus-photo">
              <img
                src="/images/stitch-cockpit-racks.jpg"
                alt="Racks e estoque hidráulico organizado no Aponta CD"
                loading="lazy"
              />
              <div className="cp-focus-photo-overlay">
                <span>Conferência e rastreabilidade em tempo real</span>
              </div>
            </div>

            <div className="cp-focus-actions">
              <button
                type="button"
                className="cp-focus-btn-main"
                onClick={() => onSelectTab?.("kiosk")}
              >
                {myActive ? "Gerenciar Atividade Ativa" : "Iniciar Novo Apontamento"}
              </button>
              <button
                type="button"
                className="cp-focus-btn-icon"
                onClick={() => onSelectTab?.("badges")}
                title={isAdmin ? "Crachás da equipe" : "Meu crachá"}
                aria-label={isAdmin ? "Crachás da equipe" : "Meu crachá"}
              >
                <IconStar size={17} />
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* ============ ROW 3: LISTA DE ATIVIDADES DE HOJE (LIVE TABLE) ============ */}
      {cockpitView !== "modules" && (
        <section className="cp-table-panel">
          <div className="cp-table-head">
            <div>
              <div className="cp-table-title-row">
                <h2>Minhas Atividades de Hoje</h2>
                <span className="cp-table-count-pill">
                  {todayTableRows.length} {todayTableRows.length === 1 ? "registro" : "registros"}
                </span>
              </div>
              <p>Histórico ao vivo dos apontamentos realizados no seu turno atual.</p>
            </div>

            <div className="cp-table-controls">
              <div className="cp-filter-group">
                <button
                  type="button"
                  className={tableFilter === "all" ? "active" : ""}
                  onClick={() => setTableFilter("all")}
                >
                  Todos
                </button>
                <button
                  type="button"
                  className={tableFilter === "active" ? "active" : ""}
                  onClick={() => setTableFilter("active")}
                >
                  Em andamento ({myActive ? 1 : 0})
                </button>
                <button
                  type="button"
                  className={tableFilter === "done" ? "active" : ""}
                  onClick={() => setTableFilter("done")}
                >
                  Concluídas ({myToday.count})
                </button>
              </div>

              <div className="cp-search-box">
                <IconSearch size={15} />
                <input
                  type="text"
                  placeholder="Filtrar atividade..."
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                />
              </div>
            </div>
          </div>

          {todayTableRows.length === 0 ? (
            <div className="cp-empty-table">
              <p>Nenhuma atividade registrada neste filtro hoje.</p>
              <button
                type="button"
                className="cp-focus-btn-main"
                style={{ width: "auto", padding: "10px 18px" }}
                onClick={() => onSelectTab?.("kiosk")}
              >
                Apontar primeira atividade →
              </button>
            </div>
          ) : (
            <div className="cp-table-wrap">
              <table className="cp-table">
                <thead>
                  <tr>
                    <th>Atividade</th>
                    <th>Detalhe / Veículo</th>
                    <th>Início</th>
                    <th>Término</th>
                    <th>Duração</th>
                    <th style={{ textAlign: "right" }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {todayTableRows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <strong className="cp-row-act">{row.activity}</strong>
                      </td>
                      <td className="cp-row-muted">{row.detail}</td>
                      <td className="cp-row-mono">{row.startTime}</td>
                      <td className="cp-row-mono">{row.endTime}</td>
                      <td className="cp-row-mono cp-val-cyan">{row.duration}</td>
                      <td style={{ textAlign: "right" }}>
                        {row.status === "active" ? (
                          <button
                            type="button"
                            className="cp-status-badge is-live"
                            onClick={() => onSelectTab?.("kiosk")}
                          >
                            Em andamento →
                          </button>
                        ) : (
                          <span className="cp-status-badge is-done">Concluída</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
