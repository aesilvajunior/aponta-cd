// Versão publicada (injetada pelo Vite). Em testes/dev usa um valor padrão.
export const BUILD_INFO =
  typeof __APP_BUILD__ !== "undefined" ? __APP_BUILD__ : { builtAt: null, commit: "dev" };
