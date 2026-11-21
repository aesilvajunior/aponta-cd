import React from "react";

/**
 * BrandMark — Identidade visual adaptada do Aponta CD
 * Combina o símbolo oficial (galpão + caminhão + tubos) com wordmark
 * neo-grotesco limpo de estúdio minimalista.
 */
export default function BrandMark({ variant = "lockup", className = "" }) {
  if (variant === "icon") {
    return (
      <span className={`brand-emblem brand-emblem-only ${className}`.trim()} aria-label="Aponta CD">
        <img src="/logo-aponta-cd.jpg" alt="Aponta CD" className="brand-emblem-img" />
      </span>
    );
  }

  if (variant === "full") {
    return (
      <div className={`brand-editorial-frame ${className}`.trim()}>
        <span className="brand-reg brand-reg-tl" aria-hidden="true">+</span>
        <span className="brand-reg brand-reg-tr" aria-hidden="true">+</span>
        <span className="brand-reg brand-reg-bl" aria-hidden="true">+</span>
        <span className="brand-reg brand-reg-br" aria-hidden="true">+</span>
        <img src="/logo-aponta-cd.jpg" alt="Aponta CD" className="brand-full-img" />
      </div>
    );
  }

  return (
    <span className={`brand-lockup ${className}`.trim()}>
      <span className="brand-emblem">
        <img src="/logo-aponta-cd.jpg" alt="" aria-hidden="true" className="brand-emblem-img" />
      </span>
      <span className="brand-wordmark">
        <span className="brand-word-aponta">aponta</span>
        <span className="brand-word-cd">cd</span>
        <span className="brand-word-slash" aria-hidden="true">/</span>
      </span>
    </span>
  );
}
