// ============================================================
// Aponta CD — Perfil personalizado do operador (foto, cores, bio)
// Salva em localStorage com chave por código do operador e
// aplica redimensionamento automático + limite de tamanho.
// ============================================================

const STORAGE_PREFIX = "aponta_op_profile_v1_";
export const MAX_AVATAR_BYTES = 500 * 1024; // 500 KB máximo por arquivo enviado
export const MAX_AVATAR_DIM = 320; // redimensiona p/ no máximo 320x320 px

export const PROFILE_THEMES = [
  { id: "default", label: "Padrão", accent: "#4a7ba7", banner: "linear-gradient(135deg, rgba(74,123,167,0.22) 0%, var(--surface) 100%)" },
  { id: "ocean", label: "Oceano", accent: "#0ea5c6", banner: "linear-gradient(135deg, rgba(14,165,198,0.26) 0%, rgba(15,26,46,0.08) 100%)" },
  { id: "emerald", label: "Esmeralda", accent: "#10b981", banner: "linear-gradient(135deg, rgba(16,185,129,0.24) 0%, var(--surface) 100%)" },
  { id: "violet", label: "Violeta", accent: "#8b5cf6", banner: "linear-gradient(135deg, rgba(139,92,246,0.24) 0%, var(--surface) 100%)" },
  { id: "amber", label: "Âmbar", accent: "#f59e0b", banner: "linear-gradient(135deg, rgba(245,158,11,0.24) 0%, var(--surface) 100%)" },
  { id: "crimson", label: "Rubi", accent: "#ef4444", banner: "linear-gradient(135deg, rgba(239,68,68,0.22) 0%, var(--surface) 100%)" },
  { id: "slate", label: "Grafite", accent: "#334155", banner: "linear-gradient(135deg, rgba(51,65,85,0.28) 0%, var(--surface) 100%)" },
];

export function getOperatorProfileCustom(operatorCode) {
  if (!operatorCode) return { avatarDataUrl: "", themeId: "default", bio: "", nickname: "" };
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${operatorCode}`);
    if (!raw) return { avatarDataUrl: "", themeId: "default", bio: "", nickname: "" };
    const parsed = JSON.parse(raw);
    return {
      avatarDataUrl: parsed.avatarDataUrl || "",
      themeId: parsed.themeId || "default",
      bio: parsed.bio || "",
      nickname: parsed.nickname || "",
    };
  } catch {
    return { avatarDataUrl: "", themeId: "default", bio: "", nickname: "" };
  }
}

export function saveOperatorProfileCustom(operatorCode, data) {
  if (!operatorCode) return;
  try {
    const prev = getOperatorProfileCustom(operatorCode);
    const next = {
      avatarDataUrl: data.avatarDataUrl !== undefined ? data.avatarDataUrl : prev.avatarDataUrl,
      themeId: data.themeId || prev.themeId || "default",
      bio: data.bio !== undefined ? data.bio : prev.bio,
      nickname: data.nickname !== undefined ? data.nickname : prev.nickname,
    };
    localStorage.setItem(`${STORAGE_PREFIX}${operatorCode}`, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent("aponta:profile-updated", { detail: { code: String(operatorCode), profile: next } }));
  } catch {
    /* localStorage indisponível ou cheio */
  }
}

export function getProfileTheme(themeId) {
  return PROFILE_THEMES.find((t) => t.id === themeId) || PROFILE_THEMES[0];
}

/**
 * Lê um arquivo de imagem, valida tipo e tamanho (<= 500 KB) e comprime para
 * um quadrado suave (<= 320px) em JPEG/WebP para manter o armazenamento leve.
 */
export function processAvatarFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error("Nenhum arquivo selecionado."));
    if (!file.type || !file.type.startsWith("image/")) {
      return reject(new Error("Envie uma imagem válida (JPG, PNG ou WebP)."));
    }
    if (file.size > MAX_AVATAR_BYTES) {
      return reject(new Error("Imagem muito grande! O limite máximo é 500 KB."));
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não foi possível ler a imagem."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Arquivo de imagem inválido."));
      img.onload = () => {
        const size = Math.min(MAX_AVATAR_DIM, Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        const minSide = Math.min(img.width, img.height);
        const sx = (img.width - minSide) / 2;
        const sy = (img.height - minSide) / 2;
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
        try {
          const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
          resolve(dataUrl);
        } catch {
          reject(new Error("Erro ao processar a imagem."));
        }
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
