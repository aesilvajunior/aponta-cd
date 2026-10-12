import React, { useEffect, useRef, useState } from "react";
import { parseBadge } from "../../lib/badge";

// O navegador precisa oferecer BarcodeDetector (Chrome/Edge no Android e desktop).
// Onde não houver, o botão simplesmente não aparece; o leitor USB de código de
// barras e o teclado continuam funcionando.
export function badgeScannerSupported() {
  return (
    typeof window !== "undefined" &&
    "BarcodeDetector" in window &&
    !!navigator.mediaDevices?.getUserMedia
  );
}

export default function BadgeScanner({ onCode, onClose, codeLength = 3 }) {
  const videoRef = useRef(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let stopped = false;
    let stream = null;
    let timer = null;

    async function start() {
      try {
        const detector = new window.BarcodeDetector({ formats: ["qr_code", "code_128", "code_39", "ean_13"] });
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (stopped) { stream.getTracks().forEach((t) => t.stop()); return; }
        const video = videoRef.current;
        video.srcObject = stream;
        await video.play();

        const loop = async () => {
          if (stopped) return;
          try {
            const found = await detector.detect(video);
            for (const f of found) {
              const code = parseBadge(f.rawValue, codeLength);
              if (code) { onCode(code); return; }
            }
          } catch { /* quadro sem imagem: tenta de novo */ }
          timer = setTimeout(loop, 250);
        };
        loop();
      } catch {
        setError("Não foi possível abrir a câmera. Verifique a permissão do navegador.");
      }
    }
    start();

    return () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="kiosk-modal-backdrop" onClick={onClose}>
      <div className="kiosk-modal" role="dialog" aria-modal="true" aria-labelledby="badge-scan-title" onClick={(e) => e.stopPropagation()}>
        <div className="kiosk-modal-header">
          <div>
            <div className="kiosk-modal-title" id="badge-scan-title">Aproxime o crachá da câmera</div>
            <div className="kiosk-modal-sub">O login acontece sozinho ao ler o código.</div>
          </div>
          <button type="button" className="kiosk-modal-close" onClick={onClose} aria-label="Fechar">×</button>
        </div>
        <div className="kiosk-modal-body">
          {error ? (
            <p role="alert" style={{ color: "var(--danger)" }}>{error}</p>
          ) : (
            <video ref={videoRef} className="badge-scan-video" playsInline muted />
          )}
        </div>
      </div>
    </div>
  );
}
