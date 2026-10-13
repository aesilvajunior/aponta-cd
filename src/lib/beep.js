// Retorno sonoro e vibração para a coleta: "bip" curto no acerto, grave no erro.
// O áudio só liga depois de um toque do usuário (regra do navegador), o que
// já acontece ao abrir a câmera ou tocar em qualquer botão da tela.
let ctx = null;

function tone(freq, ms, type = "sine", volume = 0.15) {
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = volume;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + ms / 1000);
  } catch {
    /* sem áudio: tudo bem */
  }
}

const vibrate = (pattern) => {
  try { navigator.vibrate?.(pattern); } catch { /* ignora */ }
};

export function beepOk() { tone(1100, 90); vibrate(40); }
export function beepNew() { tone(900, 70); setTimeout(() => tone(1300, 90), 90); vibrate([40, 40, 40]); }
export function beepError() { tone(220, 260, "square", 0.12); vibrate([120, 60, 120]); }
