import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const missingConfig = !supabaseUrl || !supabaseAnonKey;

if (missingConfig) {
  console.warn(
    "Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (veja .env.example) " +
      "ou, se estiver hospedado (Netlify/Cloudflare Pages/Vercel), nas variáveis de ambiente do painel " +
      "de hospedagem — e refaça o deploy depois de adicionar."
  );
}

// createClient() lança uma exceção se a URL não for válida, o que travaria a
// aplicação inteira numa tela branca antes mesmo de conseguir mostrar o
// aviso de "sem conexão". Por isso, quando falta configuração, usamos uma
// URL válida (porém falsa) só para o cliente conseguir ser criado sem
// quebrar — as chamadas ao banco vão falhar normalmente depois, e a
// aplicação consegue exibir o aviso de erro de conexão em vez de tela branca.
export const supabase = createClient(
  missingConfig ? "https://placeholder.supabase.co" : supabaseUrl,
  missingConfig ? "placeholder-key" : supabaseAnonKey
);
