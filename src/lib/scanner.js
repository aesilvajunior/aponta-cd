// ============================================================
// Leitor por câmera. Usa o leitor nativo do navegador (BarcodeDetector, rápido) e,
// onde ele não existe (iPhone/Safari e alguns Androids), cai para o ZXing, que é
// carregado só nesse caso.
// ============================================================

const WANTED_FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "itf", "qr_code", "data_matrix"];

export function cameraSupported() {
  return typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
}

export function nativeDetectorSupported() {
  return typeof window !== "undefined" && "BarcodeDetector" in window;
}

// Inicia a leitura contínua em <video>. Retorna { stop, setTorch, torchSupported, engine }.
// onCode(texto) é chamado a cada leitura; o mesmo código só repete depois de `repeatMs`.
export async function startCameraScan({ video, onCode, repeatMs = 1800 }) {
  if (!cameraSupported()) throw new Error("camera-indisponivel");

  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: false,
  });
  video.srcObject = stream;
  video.setAttribute("playsinline", "true");
  video.muted = true;
  await video.play();

  const track = stream.getVideoTracks()[0];
  const torchSupported = !!track?.getCapabilities?.().torch;

  const lastSeen = new Map(); // texto -> instante
  const emit = (text) => {
    if (!text) return;
    const now = Date.now();
    if (now - (lastSeen.get(text) || 0) < repeatMs) return;
    lastSeen.set(text, now);
    onCode(text);
  };

  let stopped = false;
  let zxingControls = null;
  let timer = null;
  let engine = "nativo";

  if (nativeDetectorSupported()) {
    let formats = WANTED_FORMATS;
    try {
      const supported = await window.BarcodeDetector.getSupportedFormats();
      formats = WANTED_FORMATS.filter((f) => supported.includes(f));
    } catch { /* usa a lista completa */ }
    const detector = new window.BarcodeDetector({ formats });
    const loop = async () => {
      if (stopped) return;
      try {
        const found = await detector.detect(video);
        found.forEach((f) => emit(f.rawValue));
      } catch { /* quadro vazio: tenta de novo */ }
      timer = setTimeout(loop, 150);
    };
    loop();
  } else {
    engine = "zxing";
    const { BrowserMultiFormatReader } = await import("@zxing/browser");
    const reader = new BrowserMultiFormatReader(undefined, { delayBetweenScanAttempts: 120 });
    zxingControls = await reader.decodeFromStream(stream, video, (result) => {
      if (result && !stopped) emit(result.getText());
    });
  }

  return {
    engine,
    torchSupported,
    async setTorch(on) {
      if (!torchSupported) return false;
      try {
        await track.applyConstraints({ advanced: [{ torch: !!on }] });
        return true;
      } catch {
        return false;
      }
    },
    stop() {
      stopped = true;
      clearTimeout(timer);
      try { zxingControls?.stop(); } catch { /* ignora */ }
      stream.getTracks().forEach((t) => t.stop());
      video.srcObject = null;
    },
  };
}
