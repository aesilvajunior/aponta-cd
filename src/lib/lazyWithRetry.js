import { lazy } from "react";

// React.lazy com uma tentativa extra: se o arquivo da tela não carregar
// (por exemplo, depois de uma publicação nova, quando o nome do arquivo
// antigo deixou de existir), recarrega a página uma única vez para pegar
// a versão atual.
const FLAG = "aponta_chunk_reload";

export function lazyWithRetry(factory) {
  return lazy(async () => {
    try {
      const mod = await factory();
      try { sessionStorage.removeItem(FLAG); } catch { /* ignora */ }
      return mod;
    } catch (err) {
      let alreadyTried = false;
      try {
        alreadyTried = sessionStorage.getItem(FLAG) === "1";
        sessionStorage.setItem(FLAG, "1");
      } catch { /* ignora */ }
      if (!alreadyTried && typeof window !== "undefined") {
        window.location.reload();
        return new Promise(() => {}); // fica pendente até a página recarregar
      }
      throw err;
    }
  });
}
