import { useEffect } from "react";

// ============================================================
// useKeyboardNav — navegação por setas + Esc + Enter
// ============================================================

const FOCUSABLE = [
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
  "a[href]",
].join(",");

export default function useKeyboardNav({
  containerRef,
  onEscape,
  onEnter,
  enabled = true,
  wrap = true,
} = {}) {
  useEffect(() => {
    if (!enabled) return;
    if (!containerRef || !containerRef.current) return;

    function getFocusables() {
      if (!containerRef.current) return [];
      const list = Array.from(containerRef.current.querySelectorAll(FOCUSABLE));
      return list.filter((el) => {
        if (el.offsetParent === null && el.tagName !== "BODY") return false;
        return true;
      });
    }

    function moveFocus(direction) {
      const focusables = getFocusables();
      if (focusables.length === 0) return;

      const current = document.activeElement;
      let index = focusables.indexOf(current);

      if (index === -1) {
        focusables[0].focus();
        return;
      }

      let nextIndex = index + direction;

      if (wrap) {
        if (nextIndex < 0) nextIndex = focusables.length - 1;
        if (nextIndex >= focusables.length) nextIndex = 0;
      } else {
        if (nextIndex < 0 || nextIndex >= focusables.length) return;
      }

      focusables[nextIndex].focus();
    }

    function onKeyDown(e) {
      const tag = (e.target && e.target.tagName) || "";

      if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        if (tag === "TEXTAREA") return;
        e.preventDefault();
        moveFocus(1);
        return;
      }

      if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        if (tag === "TEXTAREA") return;
        e.preventDefault();
        moveFocus(-1);
        return;
      }

      if (e.key === "Escape") {
        if (onEscape) {
          e.preventDefault();
          onEscape();
        }
        return;
      }

      if (e.key === "Enter" && onEnter) {
        if (tag === "TEXTAREA") return;
        if (tag === "INPUT" && e.target.type !== "submit") {
          e.preventDefault();
          onEnter();
        }
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [containerRef, onEscape, onEnter, enabled, wrap]);
}