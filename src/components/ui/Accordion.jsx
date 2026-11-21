import React, { useId, useRef, useState } from "react";

/**
 * Accordion (ported from https://lab.xevrion.dev/r/accordion.json)
 * Answers/panels unfold from under their header like a folded flap,
 * and the clicked header never shifts position.
 */
export function Accordion({ items = [], defaultOpen = [], className = "" }) {
  const [open, setOpen] = useState(() => new Set(defaultOpen));
  const headers = useRef([]);
  const baseId = useId();

  const toggle = (index) =>
    setOpen((current) => {
      const next = new Set(current);
      if (!next.delete(index)) next.add(index);
      return next;
    });

  const focusHeader = (index) => {
    const count = items.length;
    if (!count) return;
    headers.current[(index + count) % count]?.focus();
  };

  return (
    <div className={`xev-acc ${className}`.trim()}>
      {items.map((item, i) => {
        const isOpen = open.has(i);
        const headerId = `${baseId}-header-${i}`;
        const panelId = `${baseId}-panel-${i}`;
        const key = item.id || item.question || item.title || i;
        const label = item.question || item.title;

        return (
          <div key={key} className="xev-acc-item">
            <h3 className="xev-acc-heading">
              <button
                ref={(el) => {
                  headers.current[i] = el;
                }}
                id={headerId}
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => toggle(i)}
                onKeyDown={(e) => {
                  const target = {
                    ArrowDown: i + 1,
                    ArrowUp: i - 1,
                    Home: 0,
                    End: items.length - 1,
                  }[e.key];
                  if (target === undefined) return;
                  e.preventDefault();
                  focusHeader(target);
                }}
                className="xev-acc-trigger"
              >
                <span className="xev-acc-trigger-label">
                  {item.icon && <span className="xev-acc-trigger-icon">{item.icon}</span>}
                  <span>{label}</span>
                  {item.badge !== undefined && item.badge !== null && (
                    <span className="xev-acc-badge">{item.badge}</span>
                  )}
                </span>
                <svg
                  viewBox="0 0 16 16"
                  aria-hidden="true"
                  className={`xev-acc-chevron ${isOpen ? "open" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.6}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m4 6 4 4 4-4" />
                </svg>
              </button>
            </h3>

            <div
              id={panelId}
              role="region"
              aria-labelledby={headerId}
              inert={!isOpen ? "" : undefined}
              className={`xev-acc-grid ${isOpen ? "open" : ""}`}
            >
              <div className="xev-acc-clip">
                <div className={`xev-acc-flap ${isOpen ? "open" : ""}`}>
                  {item.content ? (
                    <div className="xev-acc-body">{item.content}</div>
                  ) : (
                    <p className="xev-acc-answer">{item.answer}</p>
                  )}
                  <span aria-hidden="true" className={`xev-acc-crease ${isOpen ? "open" : ""}`} />
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Controlled single-panel variant with the exact same xevrion folded-flap
 * animation — ideal for collapsible sidebar sections and tool drawers.
 */
export function AccordionSection({
  title,
  isOpen,
  onToggle,
  accentColor,
  count,
  compact = false,
  className = "",
  children,
}) {
  const baseId = useId();
  const headerId = `${baseId}-h`;
  const panelId = `${baseId}-p`;

  return (
    <div className={`xev-acc-section ${compact ? "xev-acc-compact" : ""} ${className}`.trim()}>
      <button
        id={headerId}
        type="button"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={onToggle}
        className="xev-acc-section-trigger"
      >
        <span className="xev-acc-section-left">
          {accentColor && (
            <span className="xev-acc-dot" style={{ background: accentColor }} aria-hidden="true" />
          )}
          <span>{title}</span>
          {typeof count === "number" && <span className="xev-acc-count">{count}</span>}
        </span>
        <svg
          viewBox="0 0 16 16"
          aria-hidden="true"
          className={`xev-acc-chevron ${isOpen ? "open" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m4 6 4 4 4-4" />
        </svg>
      </button>

      <div
        id={panelId}
        role="region"
        aria-labelledby={headerId}
        inert={!isOpen ? "" : undefined}
        className={`xev-acc-grid ${isOpen ? "open" : ""}`}
      >
        <div className="xev-acc-clip">
          <div className={`xev-acc-flap ${isOpen ? "open" : ""}`}>
            {children}
            <span aria-hidden="true" className={`xev-acc-crease ${isOpen ? "open" : ""}`} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default Accordion;
