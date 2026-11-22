import React, { useEffect, useRef, useState } from "react";

const ANIM_DURATION_MS = 2950; // 30 quadros a 100ms (~3s) — para exatamente no frame final construído

/**
 * AnimatedLogoHero — Integra a animação do logo Aponta CD como elemento nativo de UI/UX:
 *  - Reproduz 1 única vez ao entrar na página (2.95s) e pousa no estado final nítido (sem loop infinito)
 *  - Interativo: clique ou passe o mouse + clique em "Rever animação" para disparar novamente sob demanda
 *  - Fundo integrado com efeito suave de profundidade e suporte a prefers-reduced-motion
 */
export default function AnimatedLogoHero({ className = "" }) {
  const [phase, setPhase] = useState("playing"); // "playing" | "settled"
  const [playCount, setPlayCount] = useState(1);
  const [gifFailed, setGifFailed] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setPhase("settled");
      return undefined;
    }
    setPhase("playing");
    timerRef.current = setTimeout(() => {
      setPhase("settled");
    }, ANIM_DURATION_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [playCount]);

  function replayAnimation() {
    if (gifFailed) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    setPlayCount((c) => c + 1);
  }

  const showGif = phase === "playing" && !gifFailed;

  return (
    <div className={`aponta-logo-stage ${className}`.trim()} aria-label="Identidade animada Aponta CD">
      <div className="aponta-logo-glow" aria-hidden="true" />
      <div
        className={`aponta-logo-ui-frame ${phase === "settled" ? "is-settled" : "is-playing"}`}
        onClick={replayAnimation}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            replayAnimation();
          }
        }}
        title={phase === "settled" ? "Clique para reproduzir a animação do logo" : "Reproduzindo animação..."}
        aria-label="Logo Aponta CD — clique para reproduzir a animação novamente"
      >
        {/* Frame final nítido (sempre montado por baixo para transição sem piscar) */}
        <img
          src="/logo-aponta-cd-animado.png"
          alt="Aponta CD"
          className="aponta-logo-layer aponta-logo-still"
          draggable={false}
        />

        {/* Camada animada reproduzida uma única vez sob demanda */}
        {showGif && (
          <img
            key={playCount}
            src={`/logo-aponta-cd-animado.gif?play=${playCount}`}
            alt=""
            aria-hidden="true"
            className="aponta-logo-layer aponta-logo-gif"
            draggable={false}
            onError={() => {
              setGifFailed(true);
              setPhase("settled");
            }}
          />
        )}

        {/* Micro-indicador discreto de replay no canto (só aparece quando pousado) */}
        {phase === "settled" && !gifFailed && (
          <span className="aponta-logo-replay-hint" aria-hidden="true">
            ↻
          </span>
        )}
      </div>
    </div>
  );
}
