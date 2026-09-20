// Guarda o nome da estação/terminal no navegador (localStorage), pra
// identificar de qual máquina física cada registro veio. É por
// dispositivo, não por pessoa — configura uma vez por computador/tablet.

const KEY = "aponta_station_name";

export function getStationName() {
  try {
    return localStorage.getItem(KEY) || "";
  } catch {
    return "";
  }
}

export function setStationName(name) {
  try {
    localStorage.setItem(KEY, name.trim());
  } catch {
    // localStorage indisponível (modo privado, etc.) — segue sem estação.
  }
}

export function promptForStationName() {
  const current = getStationName();
  const name = window.prompt("Nome desta estação/terminal (ex: Separação 1, Balcão Recebimento):", current);
  if (name && name.trim()) {
    setStationName(name);
    return name.trim();
  }
  return current;
}
