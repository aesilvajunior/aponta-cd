import React from "react";

const WORD_LETTERS = ["a", "p", "o", "n", "t", "a"];

/**
 * AnimatedLogoHero — Animação grande e fluida do novo logo Aponta CD:
 *  - Caminhão com tubos PVC entra e sai do galpão ao longo do eixo isométrico
 *  - Caixas ciano acompanham o movimento
 *  - Nome "aponta" é construído letra por letra embaixo + "cd" em tubulação ciano
 */
export default function AnimatedLogoHero({ className = "" }) {
  return (
    <div className={`aponta-logo-stage ${className}`.trim()} aria-label="Animação do logo Aponta CD">
      <svg
        viewBox="0 0 560 390"
        className="aponta-logo-svg"
        role="img"
        aria-label="Aponta CD — caminhão entrando e saindo do galpão"
      >
        <defs>
          {/* Máscara para o caminhão entrar dentro do galpão sem vazar pelas costas */}
          <clipPath id="bay-exit-clip">
            <polygon points="36,112 278,112 278,195 292,202 292,280 36,280" />
          </clipPath>

          <linearGradient id="roof-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#2a4c8f" />
            <stop offset="100%" stopColor="#1a3469" />
          </linearGradient>

          <linearGradient id="wall-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#254380" />
            <stop offset="100%" stopColor="#162c58" />
          </linearGradient>

          <linearGradient id="cab-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#2ad4ee" />
            <stop offset="100%" stopColor="#0884a6" />
          </linearGradient>

          <linearGradient id="box-top" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#5ce1f6" />
            <stop offset="100%" stopColor="#1fb6d8" />
          </linearGradient>

          <linearGradient id="pipe-cyan" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3ad8f2" />
            <stop offset="50%" stopColor="#0ea5c6" />
            <stop offset="100%" stopColor="#067291" />
          </linearGradient>

          <linearGradient id="pipe-brown" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#c07c4a" />
            <stop offset="100%" stopColor="#854d27" />
          </linearGradient>
        </defs>

        {/* Sombra suave no piso */}
        <ellipse cx="275" cy="242" rx="160" ry="26" fill="currentColor" opacity="0.06" />

        {/* ============ GALPÃO ISOMÉTRICO (FUNDO + TETO) ============ */}
        <g className="logo-warehouse">
          {/* Telhado lateral direito */}
          <polygon points="212,72 316,42 384,82 310,122" fill="url(#roof-grad)" />
          {/* Frisos do telhado */}
          <line x1="274" y1="62" x2="328" y2="94" stroke="rgba(255,255,255,0.22)" strokeWidth="4" strokeLinecap="round" />
          <line x1="298" y1="54" x2="352" y2="86" stroke="rgba(255,255,255,0.22)" strokeWidth="4" strokeLinecap="round" />
          <line x1="320" y1="47" x2="372" y2="78" stroke="rgba(255,255,255,0.22)" strokeWidth="4" strokeLinecap="round" />

          {/* Parede lateral direita do galpão */}
          <polygon points="310,122 384,82 384,186 310,226" fill="url(#wall-grad)" />

          {/* Fachada frontal branca com moldura marinho */}
          <polygon
            points="212,72 310,122 310,226 212,176"
            fill="#ffffff"
            stroke="#1d356b"
            strokeWidth="8"
            strokeLinejoin="round"
          />

          {/* Detalhe de placa acima da porta */}
          <polygon points="247,98 275,112 275,120 247,106" fill="#1d356b" />

          {/* Interior escuro da garagem/doca */}
          <polygon points="224,112 296,148 296,218 224,182" fill="#0d1833" />
        </g>

        {/* ============ CAMINHÃO ENTRANDO E SAINDO DO GALPÃO ============ */}
        <g clipPath="url(#bay-exit-clip)">
          <g className="logo-truck-motion">
            {/* Carroceria lateral */}
            <polygon points="184,182 288,128 288,162 184,216" fill="#cbd5e1" stroke="#1d356b" strokeWidth="4" strokeLinejoin="round" />
            <polygon points="184,196 288,142 288,162 184,216" fill="#94a3b8" />

            {/* Tubos PVC marrons (fundo) */}
            <g>
              <polygon points="168,154 252,110 264,116 180,160" fill="url(#pipe-brown)" />
              <polygon points="180,160 264,116 274,122 190,166" fill="#a86434" />
              <circle cx="174" cy="158" r="8" fill="#8c4e24" stroke="#5c3114" strokeWidth="2" />
              <circle cx="187" cy="164" r="8" fill="#a86434" stroke="#5c3114" strokeWidth="2" />
            </g>

            {/* Tubos PVC brancos (frente) */}
            <g>
              <polygon points="196,166 276,124 288,130 208,172" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.5" />
              <polygon points="206,174 286,132 294,138 214,180" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="1.5" />
              <circle cx="204" cy="172" r="8" fill="#ffffff" stroke="#94a3b8" strokeWidth="2" />
              <circle cx="216" cy="178" r="8" fill="#f1f5f9" stroke="#94a3b8" strokeWidth="2" />
              <circle cx="204" cy="172" r="3.5" fill="#94a3b8" />
              <circle cx="216" cy="178" r="3.5" fill="#94a3b8" />
            </g>

            {/* Cabine ciano */}
            <polygon points="116,184 156,164 190,180 154,200" fill="url(#cab-grad)" stroke="#1d356b" strokeWidth="4" strokeLinejoin="round" />
            <polygon points="116,184 154,200 154,238 116,220" fill="#0b96b8" stroke="#1d356b" strokeWidth="4" strokeLinejoin="round" />
            <polygon points="154,200 190,180 190,218 154,238" fill="#087896" stroke="#1d356b" strokeWidth="4" strokeLinejoin="round" />

            {/* Para-brisa e janela lateral */}
            <polygon points="122,190 148,202 148,218 122,206" fill="#1d356b" />
            <polygon points="160,202 183,190 183,206 160,218" fill="#162d59" />

            {/* Faróis com brilho suave */}
            <ellipse cx="123" cy="216" rx="4.5" ry="3" fill="#fef08a" className="logo-headlight" />
            <ellipse cx="145" cy="226" rx="4.5" ry="3" fill="#fef08a" className="logo-headlight" />

            {/* Rodas */}
            <g className="logo-wheel">
              <circle cx="176" cy="226" r="14" fill="#1d356b" />
              <circle cx="176" cy="226" r="6" fill="#cbd5e1" />
            </g>
            <g className="logo-wheel">
              <circle cx="256" cy="186" r="13" fill="#1d356b" />
              <circle cx="256" cy="186" r="5.5" fill="#cbd5e1" />
            </g>
          </g>
        </g>

        {/* Pórtico frontal direito sobreposto para dar profundidade real de entrada */}
        <polygon points="296,148 310,155 310,226 296,218" fill="#1d356b" />

        {/* ============ CAIXAS CIANO EMPILHADAS AO LADO ============ */}
        <g className="logo-boxes">
          {/* Caixa traseira superior */}
          <g className="logo-box-top">
            <polygon points="366,146 396,130 426,146 396,162" fill="url(#box-top)" />
            <polygon points="366,146 396,162 396,196 366,180" fill="#119ec0" />
            <polygon points="396,162 426,146 426,180 396,196" fill="#097a99" />
            <line x1="381" y1="138" x2="411" y2="154" stroke="#16336e" strokeWidth="4" />
          </g>
          {/* Caixa frontal esquerda */}
          <g className="logo-box-front">
            <polygon points="334,186 364,170 394,186 364,202" fill="url(#box-top)" />
            <polygon points="334,186 364,202 364,236 334,220" fill="#13a6c9" />
            <polygon points="364,202 394,186 394,220 364,236" fill="#0a7e9e" />
            <line x1="349" y1="178" x2="379" y2="194" stroke="#16336e" strokeWidth="4" />
          </g>
        </g>

        {/* ============ CONSTRUÇÃO DO NOME "aponta cd" EMBAIXO ============ */}
        <g transform="translate(0, 290)">
          {/* Letras de "aponta" sendo construídas sequencialmente */}
          {WORD_LETTERS.map((ch, idx) => (
            <text
              key={idx}
              x={68 + idx * 50}
              y="56"
              className="logo-word-letter"
              style={{ animationDelay: `${0.18 + idx * 0.1}s` }}
            >
              {ch}
            </text>
          ))}

          {/* "c" construído em tubulação ciano */}
          <g className="logo-pipe-c">
            <path
              d="M 412,18 C 384,18 378,56 412,56"
              fill="none"
              stroke="url(#pipe-cyan)"
              strokeWidth="16"
              strokeLinecap="butt"
              className="logo-pipe-draw"
            />
            <rect x="408" y="8" width="9" height="20" rx="3" fill="#0884a6" className="logo-pipe-cap" />
            <rect x="408" y="46" width="9" height="20" rx="3" fill="#0884a6" className="logo-pipe-cap" />
          </g>

          {/* "d" construído em tubulação ciano com haste vertical */}
          <g className="logo-pipe-d">
            <path
              d="M 476,18 C 446,18 442,56 476,56"
              fill="none"
              stroke="url(#pipe-cyan)"
              strokeWidth="16"
              strokeLinecap="butt"
              className="logo-pipe-draw logo-pipe-draw-d"
            />
            <line
              x1="480"
              y1="-8"
              x2="480"
              y2="64"
              stroke="url(#pipe-cyan)"
              strokeWidth="16"
              className="logo-pipe-stem"
            />
            <rect x="469" y="-12" width="22" height="8" rx="3" fill="#0884a6" className="logo-pipe-cap-d" />
            <rect x="469" y="60" width="22" height="8" rx="3" fill="#0884a6" className="logo-pipe-cap-d" />
          </g>
        </g>
      </svg>
    </div>
  );
}
