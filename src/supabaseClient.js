import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const missingConfig = !supabaseUrl || !supabaseAnonKey;

if (missingConfig) {
  console.warn(
    "Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (veja .env.example) " +
      "ou, se estiver hospedado (Cloudflare Pages/Netlify/Vercel), nas variáveis de ambiente do painel " +
      "de hospedagem — e refaça o deploy depois de adicionar."
  );
}

export const supabase = createClient(
  missingConfig ? "https://placeholder.supabase.co" : supabaseUrl,
  missingConfig ? "placeholder-key" : supabaseAnonKey
);