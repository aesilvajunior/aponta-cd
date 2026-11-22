import React, { useState } from "react";

/**
 * AnimatedLogoHero — Animação editorial nativa e transparente (zero caixas/formas brancas):
 *  - Galpão isométrico fixo no centro com profundidade e acabamento arquitetural
 *  - Caminhão ciano com tubos PVC chega suavemente e estaciona na doca
 *  - Caixas caem do alto com física de quique (spring) e empilham ao lado do galpão
 *  - Wordmark "aponta cd" é montado abaixo com precisão tipográfica
 *  - Clique para rever a entrada a qualquer momento (sem loop infinito incômodo)
 */
export default function AnimatedLogoHero({ className = "" }) {
  const [playKey, setPlayKey] = useState(1);

  function replay() {
    setPlayKey((k) => k + 1);
  }

  return (
    <div
      className={`aponta-logo-stage ${className}`.trim()}
      onClick={replay}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          replay();
        }
      }}
      title="Clique para rever a animação"
      aria-label="Animação editorial do logo Aponta CD — clique para reproduzir novamente"
    >
      <div className="aponta-logo-glow" aria-hidden="true" />
      <svg
        key={playKey}
        viewBox="0 0 640 360"
        className="aponta-logo-editorial-svg"
        role="img"
        aria-label="Galpão Aponta CD com caminhão chegando na doca e caixas empilhando"
      >
        <defs>
          {/* Recorte limpo da doca para o caminhão se encaixar com perfeição */}
          <linearGradient id="ed-roof" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#2e5299" />
            <stop offset="100%" stopColor="#1b356b" />
          </linearGradient>
          <linearGradient id="ed-wall" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#244382" />
            <stop offset="100%" stopColor="#142954" />
          </linearGradient>
          <linearGradient id="ed-cab-top" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#48e1f7" />
            <stop offset="100%" stopColor="#0ea5c6" />
          </linearGradient>
          <linearGradient id="ed-cab-side" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#14b2d4" />
            <stop offset="100%" stopColor="#077494" />
          </linearGradient>
          <linearGradient id="ed-box-top" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#6be6fa" />
            <stop offset="100%" stopColor="#1cb5d6" />
          </linearGradient>
          <linearGradient id="ed-pipe-brown" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#c9834e" />
            <stop offset="100%" stopColor="#854c24" />
          </linearGradient>
          <linearGradient id="ed-pipe-cyan" gradientUnits="userSpaceOnUse" x1="418" y1="255" x2="540" y2="335">
            <stop offset="0%" stopColor="#47e0f7" />
            <stop offset="55%" stopColor="#0ea5c6" />
            <stop offset="100%" stopColor="#06718f" />
          </linearGradient>
          <radialGradient id="ed-floor-shadow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#0a0e14" stopOpacity="0.32" />
            <stop offset="70%" stopColor="#0a0e14" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#0a0e14" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Sombra difusa transparente sobre o gradiente da página */}
        <ellipse cx="320" cy="232" rx="195" ry="30" fill="url(#ed-floor-shadow)" />

        {/* ============ 1. GALPÃO FIXO NO CENTRO ============ */}
        <g className="ed-warehouse-fixed">
          {/* Telhado inclinado */}
          <polygon points="246,56 352,24 424,66 346,108" fill="url(#ed-roof)" />
          <line x1="308" y1="45" x2="364" y2="78" stroke="rgba(255,255,255,0.22)" strokeWidth="4" strokeLinecap="round" />
          <line x1="333" y1="37" x2="389" y2="70" stroke="rgba(255,255,255,0.22)" strokeWidth="4" strokeLinecap="round" />
          <line x1="357" y1="30" x2="410" y2="62" stroke="rgba(255,255,255,0.22)" strokeWidth="4" strokeLinecap="round" />

          {/* Parede lateral direita */}
          <polygon points="346,108 424,66 424,174 346,216" fill="url(#ed-wall)" />

          {/* Fachada frontal com moldura limpa */}
          <polygon
            points="246,56 346,108 346,216 246,164"
            fill="#f8fafc"
            stroke="#1b356b"
            strokeWidth="8"
            strokeLinejoin="round"
          />
          {/* Placa superior da fachada */}
          <polygon points="282,83 312,98 312,107 282,92" fill="#1b356b" />
          {/* Vão interno da doca */}
          <polygon points="258,98 332,136 332,208 258,170" fill="#0b152c" />
        </g>

        {/* ============ 2. CAMINHÃO CHEGANDO E ESTACIONANDO NA DOCA ============ */}
        <g className="ed-truck-arrive">
          {/* Carroceria metálica */}
          <polygon points="218,170 326,114 326,150 218,206" fill="#cbd5e1" stroke="#1b356b" strokeWidth="4" strokeLinejoin="round" />
          <polygon points="218,185 326,129 326,150 218,206" fill="#94a3b8" />

          {/* Tubos marrons */}
          <g>
            <polygon points="202,142 288,96 300,103 214,149" fill="url(#ed-pipe-brown)" />
            <polygon points="214,149 300,103 311,110 225,156" fill="#a86434" />
            <circle cx="208" cy="146" r="8" fill="#8c4e24" stroke="#5c3114" strokeWidth="2" />
            <circle cx="221" cy="153" r="8" fill="#a86434" stroke="#5c3114" strokeWidth="2" />
          </g>

          {/* Tubos brancos */}
          <g>
            <polygon points="231,154 313,111 325,117 243,160" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.5" />
            <polygon points="241,162 323,119 331,125 249,168" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="1.5" />
            <circle cx="239" cy="160" r="8" fill="#ffffff" stroke="#94a3b8" strokeWidth="2" />
            <circle cx="251" cy="167" r="8" fill="#f1f5f9" stroke="#94a3b8" strokeWidth="2" />
            <circle cx="239" cy="160" r="3.4" fill="#94a3b8" />
            <circle cx="251" cy="167" r="3.4" fill="#94a3b8" />
          </g>

          {/* Cabine ciano */}
          <polygon points="148,172 190,151 224,168 186,189" fill="url(#ed-cab-top)" stroke="#1b356b" strokeWidth="4" strokeLinejoin="round" />
          <polygon points="148,172 186,189 186,228 148,210" fill="url(#ed-cab-side)" stroke="#1b356b" strokeWidth="4" strokeLinejoin="round" />
          <polygon points="186,189 224,168 224,207 186,228" fill="#077494" stroke="#1b356b" strokeWidth="4" strokeLinejoin="round" />

          {/* Para-brisa e janela */}
          <polygon points="155,179 180,191 180,208 155,196" fill="#162d59" />
          <polygon points="193,191 217,178 217,195 193,208" fill="#13254a" />

          {/* Faróis com brilho suave */}
          <ellipse cx="156" cy="206" rx="4.5" ry="3" fill="#fef08a" className="ed-headlight-glow" />
          <ellipse cx="177" cy="216" rx="4.5" ry="3" fill="#fef08a" className="ed-headlight-glow" />

          {/* Rodas */}
          <circle cx="209" cy="216" r="14.5" fill="#162d59" />
          <circle cx="209" cy="216" r="6" fill="#cbd5e1" />
          <circle cx="292" cy="175" r="13.5" fill="#162d59" />
          <circle cx="292" cy="175" r="5.5" fill="#cbd5e1" />
        </g>

        {/* Coluna direita da doca sobrepondo a traseira do caminhão para realismo 3D */}
        <polygon points="332,136 346,143 346,216 332,208" fill="#1b356b" />

        {/* ============ 3. CAIXAS CAINDO DO ALTO COM FÍSICA SPRING ============ */}
        <g className="ed-box-drop-1">
          <polygon points="368,176 400,159 432,176 400,193" fill="url(#ed-box-top)" />
          <polygon points="368,176 400,193 400,228 368,211" fill="#12a3c7" />
          <polygon points="400,193 432,176 432,211 400,228" fill="#087c9c" />
          <line x1="384" y1="168" x2="416" y2="185" stroke="#16336e" strokeWidth="4" />
        </g>

        <g className="ed-box-drop-2">
          <polygon points="400,158 432,141 464,158 432,175" fill="url(#ed-box-top)" />
          <polygon points="400,158 432,175 432,210 400,193" fill="#1098ba" />
          <polygon points="432,175 464,158 464,193 432,210" fill="#077494" />
          <line x1="416" y1="150" x2="448" y2="167" stroke="#16336e" strokeWidth="4" />
        </g>

        <g className="ed-box-drop-3">
          <polygon points="400,122 432,105 464,122 432,139" fill="url(#ed-box-top)" />
          <polygon points="400,122 432,139 432,174 400,157" fill="#18afd4" />
          <polygon points="432,139 464,122 464,157 432,174" fill="#0982a3" />
          <line x1="416" y1="114" x2="448" y2="131" stroke="#16336e" strokeWidth="4" />
        </g>

        {/* ============ 4. TIPOGRAFIA "aponta cd" MONTADA ABAIXO ============ */}
        <g className="ed-wordmark-reveal">
          <text x="112" y="322" className="ed-word-aponta">
            aponta
          </text>
          {/* "c" em tubulação ciano */}
          <g>
            <path
              d="M 456,282 C 422,282 422,322 456,322"
              fill="none"
              stroke="url(#ed-pipe-cyan)"
              strokeWidth="15"
              strokeLinecap="butt"
              className="ed-pipe-stroke"
            />
            <rect x="452" y="272" width="9" height="20" rx="3" fill="#0884a6" />
            <rect x="452" y="312" width="9" height="20" rx="3" fill="#0884a6" />
          </g>
          {/* "d" em tubulação ciano */}
          <g>
            <path
              d="M 518,282 C 484,282 484,322 518,322"
              fill="none"
              stroke="url(#ed-pipe-cyan)"
              strokeWidth="15"
              strokeLinecap="butt"
              className="ed-pipe-stroke"
            />
            <path
              d="M 520,256 L 520,330"
              fill="none"
              stroke="url(#ed-pipe-cyan)"
              strokeWidth="15"
              strokeLinecap="butt"
              className="ed-pipe-stroke"
            />
            <rect x="509" y="252" width="22" height="8" rx="3" fill="#0884a6" />
            <rect x="509" y="326" width="22" height="8" rx="3" fill="#0884a6" />
          </g>
        </g>
      </svg>
    </div>
  );
}
