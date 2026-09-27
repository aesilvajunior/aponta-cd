import React, { useEffect, useRef } from "react";

// Gera partículas de confete em CSS puro. Não usa biblioteca.
// Props:
// - active: boolean, dispara a animação quando true
// - count: quantidade de partículas (padrão 60)
// - duration: duração em ms (padrão 2200)
// - colors: array de cores
// - origin: { x, y } em % da tela (padrão centro)

export default function ConfettiBurst({
  active,
  count = 60,
  duration = 2200,
  colors = ["#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#3b82f6", "#fbbf24"],
  origin = { x: 50, y: 45 },
}) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!active || !containerRef.current) return;
    const container = containerRef.current;
    container.innerHTML = "";

    for (let i = 0; i < count; i++) {
      const particle = document.createElement("div");
      const color = colors[i % colors.length];
      const size = 6 + Math.random() * 8;
      const shape = Math.random() < 0.5 ? "circle" : "square";

      // Ângulo e distância
      const angle = Math.random() * Math.PI * 2;
      const distance = 120 + Math.random() * 220;
      const tx = Math.cos(angle) * distance;
      const ty = Math.sin(angle) * distance - 80;
      const rotEnd = Math.random() * 720 - 360;
      const delay = Math.random() * 180;
      const dur = duration - delay - 200;

      particle.style.position = "absolute";
      particle.style.left = `${origin.x}%`;
      particle.style.top = `${origin.y}%`;
      particle.style.width = `${size}px`;
      particle.style.height = `${size}px`;
      particle.style.background = color;
      particle.style.borderRadius = shape === "circle" ? "50%" : "2px";
      particle.style.opacity = "1";
      particle.style.transform = "translate(-50%, -50%)";
      particle.style.pointerEvents = "none";
      particle.style.willChange = "transform, opacity";

      const keyframes = [
        {
          transform: `translate(-50%, -50%) translate(0, 0) rotate(0deg)`,
          opacity: 1,
        },
        {
          transform: `translate(-50%, -50%) translate(${tx * 0.6}px, ${ty * 0.7}px) rotate(${rotEnd * 0.6}deg)`,
          opacity: 1,
          offset: 0.6,
        },
        {
          transform: `translate(-50%, -50%) translate(${tx}px, ${ty + 60}px) rotate(${rotEnd}deg)`,
          opacity: 0,
        },
      ];

      const anim = particle.animate(keyframes, {
        duration: dur,
        delay,
        easing: "cubic-bezier(0.15, 0.7, 0.3, 1)",
        fill: "forwards",
      });

      container.appendChild(particle);
      anim.onfinish = () => particle.remove();
    }

    // Limpa qualquer resto após a duração
    const cleanup = setTimeout(() => {
      if (containerRef.current) containerRef.current.innerHTML = "";
    }, duration + 300);

    return () => clearTimeout(cleanup);
  }, [active, count, duration, origin.x, origin.y, colors]);

  if (!active) return null;

  return (
    <div
      ref={containerRef}
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 9999,
        overflow: "hidden",
      }}
    />
  );
}