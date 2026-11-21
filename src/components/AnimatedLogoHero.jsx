import React from "react";

/**
 * AnimatedLogoHero — Exibe o logo oficial enviado pelo usuário em destaque
 * grande na tela inicial (compatível com PNG/APNG animado) com moldura
 * editorial limpa e animação fluida de entrada + flutuação + brilho suave.
 */
export default function AnimatedLogoHero({ className = "" }) {
  return (
    <div className={`aponta-logo-stage aponta-logo-official ${className}`.trim()} aria-label="Logo animado Aponta CD">
      <div className="aponta-logo-glow" aria-hidden="true" />
      <div className="aponta-logo-frame">
        <span className="brand-reg brand-reg-tl" aria-hidden="true">+</span>
        <span className="brand-reg brand-reg-tr" aria-hidden="true">+</span>
        <span className="brand-reg brand-reg-bl" aria-hidden="true">+</span>
        <span className="brand-reg brand-reg-br" aria-hidden="true">+</span>
        <img
          src="/logo-aponta-cd-animado.png"
          alt="Aponta CD"
          className="aponta-logo-official-img"
        />
        <div className="aponta-logo-sheen" aria-hidden="true" />
      </div>
    </div>
  );
}
