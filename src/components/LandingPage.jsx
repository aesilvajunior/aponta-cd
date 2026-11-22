import React, { useEffect, useRef, useState } from "react";
import ThemeToggle from "./ThemeToggle";
import BrandMark from "./BrandMark";
import { Accordion } from "./ui/Accordion";
import {
  IconTv,
  IconChevronRight,
  IconLock,
  IconCheck,
} from "./Icons";

const MAP_RACKS = [
  {
    id: "1A0402EA",
    aisle: "Rua 1A",
    building: "04",
    level: "02",
    side: "Esquerdo (Ímpar)",
    curve: "A",
    turnover: "96% giro",
    occupancy: "92%",
    distance: "14m da doca",
    x: 24,
    y: 26,
    w: 94,
    h: 26,
  },
  {
    id: "1A0801DA",
    aisle: "Rua 1A",
    building: "08",
    level: "01",
    side: "Direito (Par)",
    curve: "A",
    turnover: "91% giro",
    occupancy: "88%",
    distance: "19m da doca",
    x: 130,
    y: 26,
    w: 94,
    h: 26,
  },
  {
    id: "1B0603EA",
    aisle: "Rua 1B",
    building: "06",
    level: "03",
    side: "Esquerdo (Ímpar)",
    curve: "B",
    turnover: "68% giro",
    occupancy: "76%",
    distance: "27m da doca",
    x: 24,
    y: 74,
    w: 94,
    h: 26,
  },
  {
    id: "1B1002DA",
    aisle: "Rua 1B",
    building: "10",
    level: "02",
    side: "Direito (Par)",
    curve: "A",
    turnover: "89% giro",
    occupancy: "94%",
    distance: "24m da doca",
    x: 130,
    y: 74,
    w: 94,
    h: 26,
  },
  {
    id: "1C1105EA",
    aisle: "Rua 1C",
    building: "11",
    level: "05",
    side: "Esquerdo (Ímpar)",
    curve: "A",
    turnover: "94% giro",
    occupancy: "90%",
    distance: "18m da doca",
    x: 24,
    y: 122,
    w: 94,
    h: 26,
  },
  {
    id: "1C1204DA",
    aisle: "Rua 1C",
    building: "12",
    level: "04",
    side: "Direito (Par)",
    curve: "B",
    turnover: "62% giro",
    occupancy: "71%",
    distance: "31m da doca",
    x: 130,
    y: 122,
    w: 94,
    h: 26,
  },
  {
    id: "1D0301EA",
    aisle: "Rua 1D",
    building: "03",
    level: "01",
    side: "Esquerdo (Ímpar)",
    curve: "C",
    turnover: "28% giro",
    occupancy: "54%",
    distance: "42m da doca",
    x: 24,
    y: 170,
    w: 94,
    h: 26,
  },
  {
    id: "1D0902DA",
    aisle: "Rua 1D",
    building: "09",
    level: "02",
    side: "Direito (Par)",
    curve: "C",
    turnover: "31% giro",
    occupancy: "60%",
    distance: "46m da doca",
    x: 130,
    y: 170,
    w: 94,
    h: 26,
  },
];

const SHIFT_LOGS = [
  { time: "08:42", task: "Separação · Pedido #4812", ref: "1C1105EA", dur: "11m 20s", status: "Concluído" },
  { time: "08:55", task: "Conferência · Carga Sul", ref: "DOCA 02", dur: "08m 05s", status: "Concluído" },
  { time: "09:08", task: "Reposição · Tubos PVC 100mm", ref: "1A0402EA", dur: "14m 32s", status: "Em andamento" },
  { time: "09:24", task: "Inventário Cíclico · Rua 1B", ref: "1B1002DA", dur: "Na fila", status: "Agendado" },
];

const SAMPLE_LABELS = [
  { code: "1C1105EA", floor: "1º Andar", aisle: "Rua C", building: "Prédio 11", level: "Nível 05", parity: "ÍMPAR · LADO ESQUERDO", zone: "Curva A" },
  { code: "1C1202DA", floor: "1º Andar", aisle: "Rua C", building: "Prédio 12", level: "Nível 02", parity: "PAR · LADO DIREITO", zone: "Curva A" },
  { code: "2A0501EA", floor: "2º Andar", aisle: "Rua A", building: "Prédio 05", level: "Nível 01", parity: "ÍMPAR · LADO ESQUERDO", zone: "Curva B" },
  { code: "2B0804DA", floor: "2º Andar", aisle: "Rua B", building: "Prédio 08", level: "Nível 04", parity: "PAR · LADO DIREITO", zone: "Curva C" },
];

const CAPABILITIES = [
  {
    code: "01",
    title: "Apontamento & Conferência",
    desc: "Registro de atividades em segundos por código numérico ou leitor de código de barras, com fila de conferência e operação contínua mesmo sem internet.",
    meta: "Offline-first · Teclado numérico",
  },
  {
    code: "02",
    title: "Endereçamento & Etiquetas CD",
    desc: "Geração em lote no padrão compacto 1C1105EA, classificação automática de lado par e ímpar e QR Codes prontos para impressão térmica ou folha A4.",
    meta: "Térmica & A4 · Paridade automática",
  },
  {
    code: "03",
    title: "Curva ABC, Slotting & Turnos",
    desc: "Mapa de calor para aproximar itens de alto giro da expedição, comparativo direto entre os turnos Manhã e Tarde e projeção de demanda para 7 dias.",
    meta: "Heatmap · Manhã vs. Tarde",
  },
  {
    code: "04",
    title: "Checklist, Pausas & Auditoria",
    desc: "Conformidade na abertura e fechamento do galpão, controle de pausas operacionais, detecção de anomalias e exportação em Excel, CSV, JSON ou PDF.",
    meta: "Auditoria · Relatórios executivos",
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
    desc: "Reorganize prateleiras, corredores, docas e múltiplos andares com rotação livre de 0° a 360° e reflexo imediato no mapa 3D.",
    detail: "Histórico completo de alterações",
  },
  {
    num: "04",
    title: "Visibilidade para líderes e TV",
    desc: "Acompanhe metas, faltas, turnos e produtividade ao vivo no painel de gestão ou em modo TV dedicado no galpão.",
    detail: "Atualização em tempo real",
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
  {
    question: "O sistema continua funcionando se a internet cair no galpão?",
    answer:
      "Sim. Os apontamentos e pausas são armazenados localmente em uma fila segura e sincronizados automaticamente com o servidor assim que a conexão for restabelecida.",
  },
];

function ProductStagePreview({ isAuthenticated, onOpenMap2D, onOpenMap3D }) {
  const [activeTab, setActiveTab] = useState("map");
  const [selectedRackId, setSelectedRackId] = useState("1C1105EA");
  const [heatmapOn, setHeatmapOn] = useState(true);
  const [selectedLabelIdx, setSelectedLabelIdx] = useState(0);

  const selectedRack = MAP_RACKS.find((r) => r.id === selectedRackId) || MAP_RACKS[4];
  const selectedLabel = SAMPLE_LABELS[selectedLabelIdx] || SAMPLE_LABELS[0];

  return (
    <div className="lp-stage" aria-label="Demonstração interativa da interface do Aponta CD">
      <div className="lp-stage-bar">
        <div className="lp-stage-tabs" role="tablist" aria-label="Visualizações do sistema">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "map"}
            className={`lp-stage-tab ${activeTab === "map" ? "is-active" : ""}`}
            onClick={() => setActiveTab("map")}
          >
            Mapa do Galpão
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "shift"}
            className={`lp-stage-tab ${activeTab === "shift" ? "is-active" : ""}`}
            onClick={() => setActiveTab("shift")}
          >
            Apontamento & Turno
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "labels"}
            className={`lp-stage-tab ${activeTab === "labels" ? "is-active" : ""}`}
            onClick={() => setActiveTab("labels")}
          >
            Etiquetas 1C1105EA
          </button>
        </div>

        <div className="lp-stage-context">
          {activeTab === "map" && (
            <button
              type="button"
              className={`lp-stage-chip ${heatmapOn ? "is-on" : ""}`}
              onClick={() => setHeatmapOn((v) => !v)}
            >
              Curva ABC: {heatmapOn ? "Ativa" : "Oculta"}
            </button>
          )}
          {activeTab === "shift" && (
            <span className="lp-stage-meta">Turno Manhã · Fila offline: 0</span>
          )}
          {activeTab === "labels" && (
            <span className="lp-stage-meta">Padrão CD · Térmica / A4</span>
          )}
        </div>
      </div>

      <div className="lp-stage-body">
        {activeTab === "map" && (
          <div className="lp-preview-map">
            <div className="lp-map-canvas-wrap">
              <div className="lp-map-canvas-head">
                <span className="lp-mono-sm">PLANTA BAIXA · PAVIMENTO 01</span>
                <span className="lp-mono-sm">CLIQUE EM UM ENDEREÇO PARA INSPECIONAR</span>
              </div>

              <svg
                viewBox="0 0 360 220"
                className="lp-map-svg"
                role="img"
                aria-label="Planta interativa de corredores e prateleiras do centro de distribuição"
              >
                {/* Dock bays on the right */}
                <rect x="252" y="26" width="84" height="52" rx="4" className="lp-map-zone" />
                <text x="294" y="49" textAnchor="middle" className="lp-map-zone-lbl">DOCA 01</text>
                <text x="294" y="63" textAnchor="middle" className="lp-map-zone-sub">Expedição</text>

                <rect x="252" y="90" width="84" height="52" rx="4" className="lp-map-zone" />
                <text x="294" y="113" textAnchor="middle" className="lp-map-zone-lbl">DOCA 02</text>
                <text x="294" y="127" textAnchor="middle" className="lp-map-zone-sub">Recebimento</text>

                <rect x="252" y="154" width="84" height="42" rx="4" className="lp-map-zone lp-map-zone-conf" />
                <text x="294" y="179" textAnchor="middle" className="lp-map-zone-lbl">CONFERÊNCIA</text>

                {/* Aisle labels */}
                <text x="24" y="18" className="lp-map-aisle-lbl">RUA 1A</text>
                <text x="24" y="66" className="lp-map-aisle-lbl">RUA 1B</text>
                <text x="24" y="114" className="lp-map-aisle-lbl">RUA 1C</text>
                <text x="24" y="162" className="lp-map-aisle-lbl">RUA 1D</text>

                {/* Interactive racks */}
                {MAP_RACKS.map((rack) => {
                  const isSelected = rack.id === selectedRack.id;
                  const curveClass = heatmapOn ? `lp-rack-curve-${rack.curve.toLowerCase()}` : "lp-rack-neutral";
                  return (
                    <g
                      key={rack.id}
                      className={`lp-map-rack ${curveClass} ${isSelected ? "is-selected" : ""}`}
                      onClick={() => setSelectedRackId(rack.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelectedRackId(rack.id);
                        }
                      }}
                      aria-label={`Selecionar endereço ${rack.id}`}
                    >
                      <rect x={rack.x} y={rack.y} width={rack.w} height={rack.h} rx="4" />
                      <text x={rack.x + 8} y={rack.y + 16.5} className="lp-rack-code">
                        {rack.id}
                      </text>
                      <text x={rack.x + rack.w - 8} y={rack.y + 16.5} textAnchor="end" className="lp-rack-curve">
                        {rack.curve}
                      </text>
                    </g>
                  );
                })}
              </svg>

              <div className="lp-map-legend">
                <span><i className="lp-swatch lp-swatch-a" /> Curva A (alto giro)</span>
                <span><i className="lp-swatch lp-swatch-b" /> Curva B (médio)</span>
                <span><i className="lp-swatch lp-swatch-c" /> Curva C (baixo)</span>
              </div>
            </div>

            <aside className="lp-map-inspector">
              <div className="lp-inspector-head">
                <span className="lp-mono-sm">ENDEREÇO SELECIONADO</span>
                <strong className="lp-inspector-code">{selectedRack.id}</strong>
              </div>

              <dl className="lp-spec-list">
                <div>
                  <dt>Localização</dt>
                  <dd>{selectedRack.aisle} · Prédio {selectedRack.building} · Nível {selectedRack.level}</dd>
                </div>
                <div>
                  <dt>Lado do corredor</dt>
                  <dd>{selectedRack.side}</dd>
                </div>
                <div>
                  <dt>Classificação ABC</dt>
                  <dd>Curva {selectedRack.curve} ({selectedRack.turnover})</dd>
                </div>
                <div>
                  <dt>Ocupação atual</dt>
                  <dd>{selectedRack.occupancy} · {selectedRack.distance}</dd>
                </div>
              </dl>

              {isAuthenticated && onOpenMap2D && onOpenMap3D && (
                <div className="lp-inspector-actions">
                  <button type="button" className="lp-btn-secondary lp-btn-sm" onClick={onOpenMap2D}>
                    Abrir Mapa 2D
                  </button>
                  <button type="button" className="lp-btn-secondary lp-btn-sm" onClick={onOpenMap3D}>
                    Abrir Mapa 3D
                  </button>
                </div>
              )}
            </aside>
          </div>
        )}

        {activeTab === "shift" && (
          <div className="lp-preview-shift">
            <div className="lp-shift-operator">
              <span className="lp-mono-sm">OPERADOR EM ATIVIDADE</span>
              <div className="lp-shift-op-row">
                <div className="lp-shift-badge">1042</div>
                <div>
                  <strong>Carlos Silva</strong>
                  <span>Separação · Turno Manhã</span>
                </div>
              </div>

              <div className="lp-shift-timer">
                <span className="lp-mono-sm">ATIVIDADE ATUAL</span>
                <strong>00:14:32</strong>
                <span>Reposição · Tubos PVC 100mm (1A0402EA)</span>
              </div>

              <div className="lp-shift-sync">
                <IconCheck size={14} />
                <span>Sincronizado em tempo real · 0 itens na fila offline</span>
              </div>
            </div>

            <div className="lp-shift-table-wrap">
              <div className="lp-shift-table-head">
                <span className="lp-mono-sm">HISTÓRICO RECENTE DO TURNO</span>
                <span className="lp-mono-sm">4 REGISTROS</span>
              </div>
              <div className="lp-shift-rows">
                {SHIFT_LOGS.map((row) => (
                  <div key={row.time} className="lp-shift-row">
                    <span className="lp-mono-sm lp-shift-time">{row.time}</span>
                    <span className="lp-shift-task">{row.task}</span>
                    <span className="lp-mono-sm lp-shift-ref">{row.ref}</span>
                    <span className="lp-mono-sm lp-shift-dur">{row.dur}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "labels" && (
          <div className="lp-preview-labels">
            <div className="lp-label-selector">
              <span className="lp-mono-sm">SELECIONE UM ENDEREÇO DO LOTE</span>
              <div className="lp-label-list">
                {SAMPLE_LABELS.map((item, idx) => (
                  <button
                    key={item.code}
                    type="button"
                    className={`lp-label-option ${idx === selectedLabelIdx ? "is-active" : ""}`}
                    onClick={() => setSelectedLabelIdx(idx)}
                  >
                    <strong>{item.code}</strong>
                    <span>{item.floor} · {item.aisle} · {item.zone}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="lp-label-sheet-wrap">
              <div className="lp-thermal-label">
                <div className="lp-thermal-top">
                  <span>APONTA CD · ENDEREÇAMENTO</span>
                  <span>{selectedLabel.zone.toUpperCase()}</span>
                </div>
                <div className="lp-thermal-code">{selectedLabel.code}</div>
                <div className="lp-thermal-parity">{selectedLabel.parity}</div>
                <div className="lp-thermal-meta">
                  <span>{selectedLabel.floor}</span>
                  <span>{selectedLabel.aisle}</span>
                  <span>{selectedLabel.building}</span>
                  <span>{selectedLabel.level}</span>
                </div>
                <div className="lp-thermal-codes">
                  <svg viewBox="0 0 180 38" className="lp-barcode-svg" aria-hidden="true">
                    {[2, 6, 9, 14, 17, 22, 27, 30, 36, 40, 44, 49, 53, 58, 63, 67, 72, 77, 81, 86, 91, 95, 100, 106, 110, 114, 120, 124, 130, 134, 139, 145, 149, 154, 160, 165, 170].map((x, idx) => (
                      <rect key={idx} x={x} y="2" width={idx % 3 === 0 ? 3 : 1.5} height="34" fill="#0f172a" />
                    ))}
                  </svg>
                  <svg viewBox="0 0 38 38" className="lp-qr-svg" aria-hidden="true">
                    <rect width="38" height="38" fill="#0f172a" rx="2" />
                    <rect x="4" y="4" width="11" height="11" fill="#ffffff" />
                    <rect x="7" y="7" width="5" height="5" fill="#0f172a" />
                    <rect x="23" y="4" width="11" height="11" fill="#ffffff" />
                    <rect x="26" y="7" width="5" height="5" fill="#0f172a" />
                    <rect x="4" y="23" width="11" height="11" fill="#ffffff" />
                    <rect x="7" y="26" width="5" height="5" fill="#0f172a" />
                    <rect x="21" y="21" width="5" height="5" fill="#ffffff" />
                    <rect x="29" y="21" width="5" height="5" fill="#ffffff" />
                    <rect x="25" y="29" width="9" height="5" fill="#ffffff" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

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
    <div className={`lp-page ${isAuthenticated ? "lp-embedded" : ""}`}>
      {/* ============ NAVIGATION ============ */}
      {!isAuthenticated && (
        <header className="lp-nav">
          <div className="lp-container lp-nav-inner">
            <a href="/" className="lp-nav-brand">
              <BrandMark variant="lockup" />
            </a>

            <nav className="lp-nav-links" aria-label="Navegação principal">
              <a href="#operacao">Operação</a>
              <a href="#modulos">Módulos</a>
              <a href="#fluxo">Fluxo</a>
              <a href="#duvidas">Dúvidas</a>
            </nav>

            <div className="lp-nav-actions">
              <a
                href="/tv"
                target="_blank"
                rel="noopener noreferrer"
                className="lp-nav-tv"
              >
                <IconTv size={14} />
                <span>Painel TV</span>
              </a>
              <ThemeToggle compact showColors={false} />
              <a
                href="/funcionario"
                className="lp-btn-primary lp-btn-nav"
                onClick={openEmployeeArea}
              >
                <span>Área do Funcionário</span>
                <IconChevronRight size={15} />
              </a>
            </div>
          </div>
        </header>
      )}

      {/* ============ HERO + INTERACTIVE PRODUCT STAGE ============ */}
      <section id="topo" className="lp-container lp-hero">
        <div className="lp-hero-grid">
          <div className="lp-hero-title-col">
            <h1 className="lp-h1">
              Controle preciso do centro de distribuição.
            </h1>
          </div>

          <div className="lp-hero-copy-col">
            <p className="lp-lead">
              Apontamento por código, conferência, planta 2D e 3D sincronizada, etiquetas de endereço e indicadores de turno em uma única plataforma operacional.
            </p>

            <div className="lp-hero-actions">
              <a
                href="/funcionario"
                className="lp-btn-primary"
                onClick={openEmployeeArea}
              >
                <span>Área do Funcionário</span>
                <IconChevronRight size={16} />
              </a>

              {isAuthenticated && onOpenMap2D && onOpenMap3D ? (
                <>
                  <button type="button" className="lp-btn-secondary" onClick={onOpenMap2D}>
                    Abrir Mapa 2D
                  </button>
                  <button type="button" className="lp-btn-secondary" onClick={onOpenMap3D}>
                    Abrir Mapa 3D
                  </button>
                </>
              ) : (
                <a
                  href="/tv"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="lp-btn-secondary"
                >
                  <IconTv size={15} />
                  <span>Abrir Painel TV</span>
                </a>
              )}
            </div>

            <div className="lp-hero-footnote">
              {activeOperatorsCount > 0
                ? `${activeOperatorsCount} operadores ativos · Operação offline-first · Planta 2D & 3D`
                : "Operação offline-first · Planta 2D & 3D · Painel TV ao vivo"}
            </div>
          </div>
        </div>

        <div id="operacao">
          <ProductStagePreview
            isAuthenticated={isAuthenticated}
            onOpenMap2D={onOpenMap2D}
            onOpenMap3D={onOpenMap3D}
          />
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

      {/* ============ MODULES & SPATIAL ARCHITECTURE ============ */}
      <section id="modulos" className="lp-container lp-section">
        <div className="lp-section-head">
          <div>
            <span className="lp-kicker">Plataforma</span>
            <h2 className="lp-h2">Construído para o ritmo real do galpão.</h2>
          </div>
          <p className="lp-section-sub">
            Cada módulo foi desenhado para reduzir atrito na operação diária — da bipagem no corredor à leitura executiva do turno.
          </p>
        </div>

        {/* Featured Spatial 2D/3D Showcase */}
        <article className="lp-feature-band">
          <div className="lp-feature-media">
            <img
              src="/images/showcase-map3d.jpg"
              alt="Visualização isométrica 3D do centro de distribuição no Aponta CD"
              loading="lazy"
            />
          </div>

          <div className="lp-feature-content">
            <span className="lp-kicker">Espacial · 2D & 3D</span>
            <h3>Gêmeo digital do galpão em 360°</h3>
            <p>
              Modele e reorganize toda a planta do centro de distribuição em tempo real. Posicione, redimensione e rotacione prateleiras, escadas, elevadores, mesas de conferência e múltiplos pavimentos com sincronia imediata entre 2D e 3D.
            </p>

            <dl className="lp-feature-specs">
              <div>
                <dt>Rotação</dt>
                <dd>0° a 360°</dd>
              </div>
              <div>
                <dt>Pavimentos</dt>
                <dd>Múltiplos andares</dd>
              </div>
              <div>
                <dt>Sincronia</dt>
                <dd>2D ↔ 3D instantânea</dd>
              </div>
            </dl>
          </div>
        </article>

        {/* 2x2 Architectural Capability Grid */}
        <div className="lp-cap-grid">
          {CAPABILITIES.map((cap) => (
            <article key={cap.code} className="lp-cap-card">
              <div className="lp-cap-top">
                <span className="lp-mono-sm">{cap.code}</span>
                <span className="lp-cap-meta">{cap.meta}</span>
              </div>
              <h3>{cap.title}</h3>
              <p>{cap.desc}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ============ OPERATIONAL WORKFLOW ============ */}
      <section id="fluxo" className="lp-container lp-section">
        <div className="lp-section-head">
          <div>
            <span className="lp-kicker">Fluxo operacional</span>
            <h2 className="lp-h2">Da entrada do operador ao painel da gestão.</h2>
          </div>
          <p className="lp-section-sub">
            Quatro etapas integradas mantêm piso, conferência, estoque e liderança olhando para os mesmos dados em tempo real.
          </p>
        </div>

        <div className="lp-flow-grid">
          {WORKFLOW_STEPS.map((step) => (
            <div key={step.num} className="lp-flow-step">
              <div className="lp-flow-num">{step.num}</div>
              <h3>{step.title}</h3>
              <p>{step.desc}</p>
              <span className="lp-flow-detail">{step.detail}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ============ FAQ ============ */}
      <section id="duvidas" className="lp-container lp-section">
        <div className="lp-faq-grid">
          <div className="lp-faq-side">
            <span className="lp-kicker">Suporte</span>
            <h2 className="lp-h2">Dúvidas frequentes.</h2>
            <p className="lp-section-sub">
              Primeiro acesso? Utilize os números do seu próprio código de funcionário como senha inicial.
            </p>
          </div>

          <div className="lp-faq-list">
            <Accordion items={FAQ_ITEMS} defaultOpen={[0]} />
          </div>
        </div>
      </section>

      {/* ============ CLOSING BAND ============ */}
      <section className="lp-container lp-closing-wrap">
        <div className="lp-closing-band">
          <div>
            <h2>Pronto para iniciar o turno?</h2>
            <p>Acesse com seu código de operador ou abra o painel ao vivo para o monitor do galpão.</p>
          </div>
          <div className="lp-closing-actions">
            <a href="/funcionario" className="lp-btn-primary" onClick={openEmployeeArea}>
              <span>Área do Funcionário</span>
              <IconChevronRight size={16} />
            </a>
            <a href="/tv" target="_blank" rel="noopener noreferrer" className="lp-btn-secondary">
              <IconTv size={15} />
              <span>Painel TV</span>
            </a>
          </div>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="lp-footer">
        <div className="lp-container">
          <div className="lp-footer-grid">
            <div className="lp-footer-brand">
              <BrandMark variant="lockup" />
              <p>
                Plataforma de apontamento operacional, mapeamento 2D/3D e inteligência logística para centros de distribuição.
              </p>
            </div>

            <div className="lp-footer-col">
              <div className="lp-footer-title">Navegação</div>
              <a href="#operacao">Operação</a>
              <a href="#modulos">Módulos</a>
              <a href="#fluxo">Fluxo</a>
              <a href="#duvidas">Dúvidas</a>
            </div>

            <div className="lp-footer-col">
              <div className="lp-footer-title">Acesso</div>
              <a href="/funcionario" onClick={openEmployeeArea}>
                Área do Funcionário
              </a>
              <a href="/tv" target="_blank" rel="noopener noreferrer">
                Painel TV ao vivo
              </a>
              <a href="#topo">Voltar ao topo</a>
            </div>
          </div>

          <div className="lp-footer-bottom">
            <span>© {new Date().getFullYear()} Aponta CD</span>
            <span className="lp-mono-sm">2D & 3D · OFFLINE-FIRST · TEMPO REAL</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
