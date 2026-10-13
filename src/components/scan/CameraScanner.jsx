import React, { useEffect, useRef, useState } from "react";
import { startCameraScan } from "../../lib/scanner";

// Câmera de leitura contínua. Fica aberta enquanto o componente existir.
export default function CameraScanner({ onCode, onClose }) {
  const videoRef = useRef(null);
  const handleRef = useRef(null);
  const onCodeRef = useRef(onCode);
  onCodeRef.current = onCode;

  const [error, setError] = useState("");
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [engine, setEngine] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const handle = await startCameraScan({ video: videoRef.current, onCode: (t) => onCodeRef.current?.(t) });
        if (cancelled) { handle.stop(); return; }
        handleRef.current = handle;
        setTorchSupported(handle.torchSupported);
        setEngine(handle.engine);
      } catch (err) {
        setError(
          err?.name === "NotAllowedError"
            ? "A câmera foi bloqueada. Libere a permissão do navegador para este site."
            : "Não foi possível abrir a câmera neste aparelho."
        );
      }
    })();
    return () => {
      cancelled = true;
      handleRef.current?.stop();
      handleRef.current = null;
    };
  }, []);

  async function toggleTorch() {
    const next = !torchOn;
    const ok = await handleRef.current?.setTorch(next);
    if (ok) setTorchOn(next);
  }

  return (
    <div className="camera-scanner">
      {error ? (
        <p role="alert" style={{ color: "var(--danger)", margin: 0 }}>{error}</p>
      ) : (
        <div className="camera-scanner-frame">
          <video ref={videoRef} className="camera-scanner-video" playsInline muted />
          <div className="camera-scanner-aim" aria-hidden="true" />
        </div>
      )}
      <div className="camera-scanner-bar">
        <span style={{ fontSize: 12, color: "var(--text-faint)" }}>
          {engine ? `Leitor: ${engine === "nativo" ? "nativo do navegador" : "compatível (ZXing)"}` : "Abrindo câmera..."}
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          {torchSupported && (
            <button type="button" className="btn-small" onClick={toggleTorch}>{torchOn ? "Apagar lanterna" : "Lanterna"}</button>
          )}
          <button type="button" className="btn-small" onClick={onClose}>Fechar câmera</button>
        </div>
      </div>
    </div>
  );
}
