import React from "react";

// Kerning óptico calibrado para "aponta"
const WORD_LETTERS = [
  { ch: "a", x: 78 },
  { ch: "p", x: 128 },
  { ch: "o", x: 180 },
  { ch: "n", x: 232 },
  { ch: "t", x: 282 },
  { ch: "a", x: 316 },
];

/**
 * AnimatedLogoHero — Logo animado do Aponta CD sem bordas ou caixas pesadas:
 *  - Caminhão ciano com tubos PVC entra e sai do galpão ao longo do eixo isométrico
 *  - Caixas ciano acompanham o movimento
 *  - "aponta" é construído letra a letra + "cd" desenhado em tubulação ciano
 */
export default function AnimatedLogoHero({ className = "" }) {
  return (
    <div className={`aponta-logo-stage ${className}`.trim()} aria-label="Logo animado Aponta CD">
      <div className="aponta-logo-glow" aria-hidden="true" />
      <svg
        viewBox="0 0 560 385"
        className="aponta-logo-svg"
        role="img"
        aria-label="Aponta CD — caminhão entrando e saindo do galpão"
      >
        <defs>
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

          {/* userSpaceOnUse garante que a haste vertical do "d" sempre renderize sólida */}
          <linearGradient id="pipe-cyan" gradientUnits="userSpaceOnUse" x1="370" y1="-12" x2="495" y2="68">
            <stop offset="0%" stopColor="#3ad8f2" />
            <stop offset="52%" stopColor="#0ea5c6" />
            <stop offset="100%" stopColor="#067291" />
          </linearGradient>

          <linearGradient id="pipe-brown" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#c07c4a" />
            <stop offset="100%" stopColor="#854d27" />
          </linearGradient>
        </defs>

        {/* Sombra suave no piso */}
        <ellipse cx="275" cy="242" rx="158" ry="24" fill="currentColor" opacity="0.07" />

        {/* ============ GALPÃO ISOMÉTRICO ============ */}
        <g className="logo-warehouse">
          <polygon points="212,72 316,42 384,82 310,122" fill="url(#roof-grad)" />
          <line x1="274" y1="62" x2="328" y2="94" stroke="rgba(255,255,255,0.22)" strokeWidth="4" strokeLinecap="round" />
          <line x1="298" y1="54" x2="352" y2="86" stroke="rgba(255,255,255,0.22)" strokeWidth="4" strokeLinecap="round" />
          <line x1="320" y1="47" x2="372" y2="78" stroke="rgba(255,255,255,0.22)" strokeWidth="4" strokeLinecap="round" />

          <polygon points="310,122 384,82 384,186 310,226" fill="url(#wall-grad)" />

          <polygon
            points="212,72 310,122 310,226 212,176"
            fill="#ffffff"
            stroke="#1d356b"
            strokeWidth="8"
            strokeLinejoin="round"
          />

          <polygon points="247,98 275,112 275,120 247,106" fill="#1d356b" />
          <polygon points="224,112 296,148 296,218 224,182" fill="#0d1833" />
        </g>

        {/* ============ CAMINHÃO ENTRANDO E SAINDO DO GALPÃO ============ */}
        <g clipPath="url(#bay-exit-clip)">
          <g className="logo-truck-motion">
            <polygon points="184,182 288,128 288,162 184,216" fill="#cbd5e1" stroke="#1d356b" strokeWidth="4" strokeLinejoin="round" />
            <polygon points="184,196 288,142 288,162 184,216" fill="#94a3b8" />

            {/* Tubos PVC marrons */}
            <g>
              <polygon points="168,154 252,110 264,116 180,160" fill="url(#pipe-brown)" />
              <polygon points="180,160 264,116 274,122 190,166" fill="#a86434" />
              <circle cx="174" cy="158" r="8" fill="#8c4e24" stroke="#5c3114" strokeWidth="2" />
              <circle cx="187" cy="164" r="8" fill="#a86434" stroke="#5c3114" strokeWidth="2" />
            </g>

            {/* Tubos PVC brancos */}
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

            <polygon points="122,190 148,202 148,218 122,206" fill="#1d356b" />
            <polygon points="160,202 183,190 183,206 160,218" fill="#162d59" />

            <ellipse cx="123" cy="216" rx="4.5" ry="3" fill="#fef08a" className="logo-headlight" />
            <ellipse cx="145" cy="226" rx="4.5" ry="3" fill="#fef08a" className="logo-headlight" />

            <circle cx="176" cy="226" r="14" fill="#1d356b" />
            <circle cx="176" cy="226" r="6" fill="#cbd5e1" />
            <circle cx="256" cy="186" r="13" fill="#1d356b" />
            <circle cx="256" cy="186" r="5.5" fill="#cbd5e1" />
          </g>
        </g>

        <polygon points="296,148 310,155 310,226 296,218" fill="#1d356b" />

        {/* ============ CAIXAS CIANO EMPILHADAS ============ */}
        <g className="logo-boxes">
          <g className="logo-box-top">
            <polygon points="366,146 396,130 426,146 396,162" fill="url(#box-top)" />
            <polygon points="366,146 396,162 396,196 366,180" fill="#119ec0" />
            <polygon points="396,162 426,146 426,180 396,196" fill="#097a99" />
            <line x1="381" y1="138" x2="411" y2="154" stroke="#16336e" strokeWidth="4" />
          </g>
          <g className="logo-box-front">
            <polygon points="334,186 364,170 394,186 364,202" fill="url(#box-top)" />
            <polygon points="334,186 364,202 364,236 334,220" fill="#13a6c9" />
            <polygon points="364,202 394,186 394,220 364,236" fill="#0a7e9e" />
            <line x1="349" y1="178" x2="379" y2="194" stroke="#16336e" strokeWidth="4" />
          </g>
        </g>

        {/* ============ CONSTRUÇÃO DE "aponta cd" EMBAIXO ============ */}
        <g transform="translate(0, 290)">
          {WORD_LETTERS.map(({ ch, x }, idx) => (
            <text
              key={idx}
              x={x}
              y="56"
              className="logo-word-letter"
              style={{ animationDelay: `${0.16 + idx * 0.09}s` }}
            >
              {ch}
            </text>
          ))}

          {/* "c" em tubulação ciano */}
          <g>
            <path
              d="M 412,18 C 380,18 380,56 412,56"
              fill="none"
              stroke="url(#pipe-cyan)"
              strokeWidth="15"
              strokeLinecap="butt"
              className="logo-pipe-draw"
            />
            <rect x="408" y="8" width="9" height="20" rx="3" fill="#0884a6" className="logo-pipe-cap" />
            <rect x="408" y="46" width="9" height="20" rx="3" fill="#0884a6" className="logo-pipe-cap" />
          </g>

          {/* "d" em tubulação ciano com haste vertical sólida */}
          <g>
            <path
              d="M 472,18 C 440,18 440,56 472,56"
              fill="none"
              stroke="url(#pipe-cyan)"
              strokeWidth="15"
              strokeLinecap="butt"
              className="logo-pipe-draw logo-pipe-draw-d"
            />
            <path
              d="M 474,-8 L 474,64"
              fill="none"
              stroke="url(#pipe-cyan)"
              strokeWidth="15"
              strokeLinecap="butt"
              className="logo-pipe-stem"
            />
            <rect x="463" y="-12" width="22" height="8" rx="3" fill="#0884a6" className="logo-pipe-cap-d" />
            <rect x="463" y="60" width="22" height="8" rx="3" fill="#0884a6" className="logo-pipe-cap-d" />
          </g>
        </g>
      </svg>
    </div>
  );
}
