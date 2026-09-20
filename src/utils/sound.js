// Feedback sonoro no quiosque — o operador ouve se deu certo ou errado,
// sem precisar olhar a tela. Usa Web Audio API (sem arquivos externos).

let ctx = null;

function getCtx() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    ctx = new Ctx();
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function tone(freq, duration = 0.15, volume = 0.1, delay = 0) {
  const c = getCtx();
  if (!c) return;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  gain.gain.value = volume;
  osc.connect(gain);
  gain.connect(c.destination);
  const start = c.currentTime + delay;
  osc.start(start);
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.stop(start + duration);
}

export function playSuccess() {
  tone(880, 0.1, 0.12, 0);
  tone(1320, 0.12, 0.1, 0.09);
}

export function playError() {
  tone(220, 0.18, 0.12, 0);
  tone(180, 0.22, 0.12, 0.15);
}

export function playKey() {
  tone(660, 0.05, 0.06, 0);
}