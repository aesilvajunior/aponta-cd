import React from "react";

/**
 * AnimatedLogoHero — Renderiza o arquivo de logo do Aponta CD sem redesenhar ou alterar a arte original.
 * Se você enviar o arquivo .gif / .mp4 / .webp animado original para public/, basta manter o src abaixo.
 */
export default function AnimatedLogoHero({ className = "" }) {
  return (
    <div className={`aponta-logo-stage ${className}`.trim()} aria-label="Logo Aponta CD">
      <div className="aponta-logo-glow" aria-hidden="true" />
      <img
        src="/logo-aponta-cd-animado.png"
        alt="Aponta CD"
        className="aponta-logo-original-img"
      />
    </div>
  );
}
