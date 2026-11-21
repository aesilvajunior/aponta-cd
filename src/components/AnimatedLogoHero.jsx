import React, { useState } from "react";

/**
 * AnimatedLogoHero — Renderiza o logo oficial do Aponta CD sem distorções.
 * Se existir `public/logo-aponta-cd-animado.gif` (GIF animado original), ele é carregado automaticamente;
 * caso contrário, usa o PNG oficial com animação suave de entrada/respiração (motion) e sem bordas pesadas.
 */
export default function AnimatedLogoHero({ className = "" }) {
  const [src, setSrc] = useState("/logo-aponta-cd-animado.gif");

  return (
    <div className={`aponta-logo-stage ${className}`.trim()} aria-label="Logo animado Aponta CD">
      <div className="aponta-logo-glow" aria-hidden="true" />
      <div className="aponta-logo-motion-wrap">
        <img
          src={src}
          alt="Aponta CD"
          className="aponta-logo-original-img"
          onError={() => {
            if (src !== "/logo-aponta-cd-animado.png") {
              setSrc("/logo-aponta-cd-animado.png");
            }
          }}
        />
      </div>
    </div>
  );
}
