// ============================================================
// Fila offline do Aponta CD
// Guarda operações (iniciar/finalizar atividade) quando a internet cai
// e reenvia, em ordem, quando ela volta. Persiste em localStorage, então
// sobrevive a recarregar a página ou reiniciar o tablet.
// Este módulo é independente da API: quem usa informa como executar cada
// tipo de operação (veja offlineSync.js).
// ============================================================

const KEY = "aponta_offline_queue_v1";
const FAILED_KEY = "aponta_offline_failed_v1";
const MAX_ATTEMPTS = 5;

const listeners = new Set();
let memoryQueue = null; // usado se o localStorage estiver indisponível
let memoryFailed = null;
let flushing = false;

function load(key, memory) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return memory || [];
  }
}

function save(key, list, setMemory) {
  try {
    localStorage.setItem(key, JSON.stringify(list));
    setMemory(null);
  } catch {
    setMemory(list);
  }
}

export function readQueue() {
  return memoryQueue || load(KEY, null);
}
function writeQueue(list) {
  save(KEY, list, (v) => { memoryQueue = v; });
  emit();
}

export function readFailed() {
  return memoryFailed || load(FAILED_KEY, null);
}
function writeFailed(list) {
  save(FAILED_KEY, list, (v) => { memoryFailed = v; });
  emit();
}

function emit() {
  const state = getQueueState();
  listeners.forEach((fn) => {
    try { fn(state); } catch { /* ignora erro de listener */ }
  });
}

export function getQueueState() {
  return { pending: readQueue().length, failed: readFailed().length };
}

export function subscribeQueue(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function makeId() {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  } catch { /* cai no fallback */ }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// Erro de rede (sem internet / servidor inalcançável), e não erro de regra.
export function isNetworkError(error) {
  if (!error) return false;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  const msg = String(error.message || error).toLowerCase();
  return (
    error instanceof TypeError ||
    error.status === 0 ||
    /failed to fetch|networkerror|network request failed|load failed|fetch failed|network error|timeout|timed out/.test(msg)
  );
}

export function enqueue(op) {
  const item = {
    id: makeId(),
    createdAt: new Date().toISOString(),
    attempts: 0,
    ...op,
  };
  writeQueue([...readQueue(), item]);
  return item;
}

// Remove da fila tudo que se refere a esse lançamento (usado no "desfazer").
export function removeByEntryId(entryId) {
  const list = readQueue();
  const next = list.filter((op) => op.entryId !== entryId);
  if (next.length !== list.length) writeQueue(next);
  return list.length - next.length;
}

export function findPending(predicate) {
  return readQueue().find(predicate) || null;
}

export function clearFailed() {
  writeFailed([]);
}

// Devolve para a fila o que falhou (ex.: depois de corrigir um problema no servidor).
export function retryFailed() {
  const failed = readFailed();
  if (failed.length === 0) return 0;
  writeQueue([...readQueue(), ...failed.map((op) => ({ ...op, attempts: 0, lastError: undefined }))]);
  writeFailed([]);
  return failed.length;
}

// Reenvia a fila em ordem.
// executors: { [type]: async (op) => ({ error?, drop? }) }
//  - sem error  → sucesso, sai da fila
//  - drop: true → descarta (ex.: sessão já existia), sai da fila
//  - erro de rede → para e tenta de novo depois (mantém a ordem)
//  - outro erro → conta tentativa; ao passar do limite vai para "failed"
export async function flushQueue(executors) {
  if (flushing) return { sent: 0, remaining: readQueue().length };
  flushing = true;
  let sent = 0;
  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const list = readQueue();
      if (list.length === 0) break;
      const op = list[0];
      const run = executors[op.type];
      if (!run) {
        writeQueue(list.slice(1));
        writeFailed([...readFailed(), { ...op, lastError: "tipo desconhecido" }]);
        continue;
      }

      let result;
      try {
        result = (await run(op)) || {};
      } catch (err) {
        result = { error: err };
      }

      if (!result.error || result.drop) {
        writeQueue(readQueue().filter((x) => x.id !== op.id));
        sent += 1;
        continue;
      }

      if (isNetworkError(result.error)) break; // sem rede: tenta depois

      const attempts = (op.attempts || 0) + 1;
      if (attempts >= MAX_ATTEMPTS) {
        writeQueue(readQueue().filter((x) => x.id !== op.id));
        writeFailed([...readFailed(), { ...op, attempts, lastError: String(result.error.message || result.error) }]);
      } else {
        // Mantém a ordem (um "finalizar" não pode passar na frente do "iniciar"):
        // para aqui e tenta de novo no próximo ciclo.
        writeQueue(readQueue().map((x) => (x.id === op.id ? { ...x, attempts } : x)));
        break;
      }
    }
  } finally {
    flushing = false;
  }
  return { sent, remaining: readQueue().length };
}

// Só para testes
export function __resetForTests() {
  memoryQueue = null;
  memoryFailed = null;
  flushing = false;
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(FAILED_KEY);
  } catch { /* ignora */ }
  listeners.clear();
}
