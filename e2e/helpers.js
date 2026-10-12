// Prepara uma "sessão logada" falsa e responde às chamadas do Supabase com dados vazios,
// para o app abrir sem depender de internet nem de banco real.
const REF = "placeholder"; // primeiro trecho de https://placeholder.supabase.co
const FAR_FUTURE = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365;

function fakeJwt() {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: "u1", role: "authenticated", exp: FAR_FUTURE })}.assinatura`;
}

export async function loginFake(page, { localStorage = {} } = {}) {
  const session = {
    access_token: fakeJwt(),
    refresh_token: "refresh-falso",
    token_type: "bearer",
    expires_in: 31536000,
    expires_at: FAR_FUTURE,
    user: { id: "u1", aud: "authenticated", role: "authenticated", email: "teste@tropeiro.com" },
  };

  await page.addInitScript(
    ([key, value, extra]) => {
      window.localStorage.setItem(key, value);
      Object.entries(extra).forEach(([k, v]) => window.localStorage.setItem(k, v));
    },
    [`sb-${REF}-auth-token`, JSON.stringify(session), localStorage]
  );

  await page.route("**/auth/v1/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(session.user) })
  );
  await page.route("**/rest/v1/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
  );
  await page.route("**/rpc/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "false" })
  );
}
