// Fuso do CD: os testes de data precisam rodar sempre em horário de Brasília,
// não importa onde a máquina/CI esteja.
process.env.TZ = "America/Sao_Paulo";

// Garante localStorage/sessionStorage em memória quando o runner (jsdom/node) não expõe Web Storage completo
function createMemoryStorage() {
  const store = new Map();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key) {
      const k = String(key);
      return store.has(k) ? store.get(k) : null;
    },
    key(index) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key) {
      store.delete(String(key));
    },
    setItem(key, value) {
      store.set(String(key), String(value));
    },
  };
}

if (typeof globalThis.localStorage === "undefined" || typeof globalThis.localStorage?.clear !== "function") {
  const mem = createMemoryStorage();
  Object.defineProperty(globalThis, "localStorage", { value: mem, writable: true, configurable: true });
  if (typeof window !== "undefined") {
    Object.defineProperty(window, "localStorage", { value: mem, writable: true, configurable: true });
  }
}

if (typeof globalThis.sessionStorage === "undefined" || typeof globalThis.sessionStorage?.clear !== "function") {
  const mem = createMemoryStorage();
  Object.defineProperty(globalThis, "sessionStorage", { value: mem, writable: true, configurable: true });
  if (typeof window !== "undefined") {
    Object.defineProperty(window, "sessionStorage", { value: mem, writable: true, configurable: true });
  }
}
