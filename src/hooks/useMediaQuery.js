import { useEffect, useState } from "react";

// Retorna true enquanto a media query casar (ex.: "(max-width: 720px)").
// Atualiza sozinho ao girar a tela ou redimensionar a janela.
export function useMediaQuery(query) {
  const get = () => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia(query).matches : false);
  const [matches, setMatches] = useState(get);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener ? mql.addEventListener("change", onChange) : mql.addListener(onChange);
    return () => {
      mql.removeEventListener ? mql.removeEventListener("change", onChange) : mql.removeListener(onChange);
    };
  }, [query]);

  return matches;
}

// Mesmo ponto de corte do CSS (src/styles/10-responsive.css): abaixo disso o menu vira gaveta.
export const MOBILE_QUERY = "(max-width: 720px)";
