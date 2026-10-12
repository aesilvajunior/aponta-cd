import React, { useRef } from "react";
import useKeyboardNav from "../../hooks/useKeyboardNav";
import { PAUSE_REASONS } from "../../lib/pauseReasons";

// Pergunta o motivo antes de pausar. Um toque escolhe e já pausa.
export default function PauseReasonModal({ onChoose, onCancel, busy }) {
  const ref = useRef(null);
  useKeyboardNav({ containerRef: ref, enabled: true, onEscape: onCancel });

  return (
    <div className="kiosk-modal-backdrop" onClick={onCancel}>
      <div
        className="kiosk-modal"
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="kiosk-pause-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="kiosk-modal-header">
          <div>
            <div className="kiosk-modal-title" id="kiosk-pause-title">Por que você vai pausar?</div>
            <div className="kiosk-modal-sub">Escolha o motivo. O cronômetro para enquanto estiver pausado.</div>
          </div>
          <button type="button" className="kiosk-modal-close" onClick={onCancel} aria-label="Cancelar">×</button>
        </div>
        <div className="kiosk-modal-body">
          <div className="kiosk-pause-reasons">
            {PAUSE_REASONS.map((r) => (
              <button
                key={r.key}
                type="button"
                className="kiosk-pause-reason"
                disabled={busy}
                onClick={() => onChoose(r.key)}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
