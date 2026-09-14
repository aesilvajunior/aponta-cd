import { supabase } from "../supabaseClient";

// ============================================================
// Login de administrador via Supabase Auth (e-mail + senha) —
// substitui o PIN único compartilhado. Cada admin tem sua própria
// conta, criada em Equipe ou no painel do Supabase.
// ============================================================

export async function getCurrentSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

// Chama `callback(session | null)` sempre que o login muda (login,
// logout, expiração de token). Retorna uma função de limpeza.
export function onAuthStateChange(callback) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session));
  return () => data.subscription.unsubscribe();
}

export function signIn(email, password) {
  return supabase.auth.signInWithPassword({ email, password });
}

export function signOut() {
  return supabase.auth.signOut();
}

// Cria uma nova conta de administrador. Só deve ser chamado a partir
// de uma tela já protegida por login (Equipe), mesmo o Supabase
// permitindo signUp anônimo por padrão.
export function createAdminAccount(email, password) {
  return supabase.auth.signUp({ email, password });
}
