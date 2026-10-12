-- ============================================================
-- Aponta CD: permissões reais no banco (elevação por PIN)  -- OPCIONAL
--
-- Problema: hoje qualquer pessoa logada grava em qualquer tabela; o PIN só
-- esconde a tela. Como o kiosk usa uma conta compartilhada, não dá para
-- separar admin de operador pelo login. Solução: o PIN, conferido no servidor,
-- abre uma "sessão de admin" (12 h) ligada ao usuário logado. As tabelas de
-- configuração só aceitam escrita enquanto essa sessão existir.
--
-- ORDEM: aplique primeiro 2026-10-10_hardening.sql e 2026-10-11_features.sql.
-- RECOMENDADO: teste num projeto Supabase de teste antes (docs/AMBIENTES.md).
-- Para voltar atrás: 2026-10-11_roles_rls_rollback.sql
-- ============================================================

create table if not exists public.admin_sessions (
  user_id uuid primary key,
  expires_at timestamptz not null
);
alter table public.admin_sessions enable row level security;
revoke all on public.admin_sessions from anon, authenticated;

create or replace function public.is_admin_session()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_sessions
     where user_id = auth.uid() and expires_at > now()
  );
$$;

create or replace function public.lock_admin()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.admin_sessions where user_id = auth.uid();
$$;

-- verify_admin_pin passa a abrir a sessão de admin quando o PIN confere
-- (mantém o bloqueio por tentativas erradas da migração 2026-10-10)
create or replace function public.verify_admin_pin(p_pin text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  ok boolean;
  uid uuid := coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid);
  lock_until timestamptz;
begin
  select locked_until into lock_until from admin_pin_attempts where user_id = uid;
  if lock_until is not null and lock_until > now() then
    raise exception 'Muitas tentativas erradas. Aguarde alguns minutos.' using errcode = 'P0001';
  end if;

  select (pin_hash = crypt(coalesce(p_pin, ''), pin_hash))
    into ok from admin_secrets where id = 1;

  if coalesce(ok, false) then
    delete from admin_pin_attempts where user_id = uid;
    if auth.uid() is not null then
      insert into admin_sessions (user_id, expires_at)
      values (auth.uid(), now() + interval '12 hours')
      on conflict (user_id) do update set expires_at = excluded.expires_at;
    end if;
    return true;
  end if;

  insert into admin_pin_attempts (user_id, fails, locked_until)
  values (uid, 1, null)
  on conflict (user_id) do update
    set fails = admin_pin_attempts.fails + 1,
        locked_until = case when admin_pin_attempts.fails + 1 >= 5
                            then now() + interval '5 minutes' else null end;
  perform pg_sleep(0.7);
  return false;
end $$;

-- Só quem está logado executa (o Supabase dá EXECUTE a anon por padrão: revogar explicitamente)
revoke all on function public.verify_admin_pin(text) from public, anon, authenticated;
revoke all on function public.is_admin_session() from public, anon;
revoke all on function public.lock_admin() from public, anon;
grant execute on function public.verify_admin_pin(text) to authenticated;

grant execute on function public.is_admin_session() to authenticated;
grant execute on function public.lock_admin() to authenticated;

-- ------------------------------------------------------------
-- Políticas. Remove as políticas abertas das tabelas abaixo e cria as novas.
-- (só mexe em tabelas que existem)
-- ------------------------------------------------------------
do $$
declare
  t text;
  pol record;
  -- leitura livre (a TV precisa ler sem login) e escrita só com sessão de admin
  admin_write_public_read text[] := array['operators','activities','error_types','vehicles','admin_config'];
  -- leitura só logado e escrita só com sessão de admin
  admin_write_auth_read text[] := array['alert_settings','scheduled_reports'];
  -- inserir livre (kiosk); alterar/apagar só admin
  admin_change text[] := array['entries'];
  -- inserir/alterar livres; apagar só admin
  admin_delete text[] := array['separation_errors','entry_shortages'];
begin
  foreach t in array admin_write_public_read || admin_write_auth_read || admin_change || admin_delete loop
    if to_regclass('public.' || t) is null then continue; end if;
    for pol in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on public.%I', pol.policyname, t);
    end loop;
    execute format('alter table public.%I enable row level security', t);
  end loop;

  foreach t in array admin_write_public_read loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('create policy "ler" on public.%I for select to anon, authenticated using (true)', t);
    execute format('create policy "escrever admin" on public.%I for all to authenticated using (public.is_admin_session()) with check (public.is_admin_session())', t);
  end loop;

  foreach t in array admin_write_auth_read loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('create policy "ler" on public.%I for select to authenticated using (true)', t);
    execute format('create policy "escrever admin" on public.%I for all to authenticated using (public.is_admin_session()) with check (public.is_admin_session())', t);
  end loop;

  foreach t in array admin_change loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('create policy "ler" on public.%I for select to anon, authenticated using (true)', t);
    execute format('create policy "inserir" on public.%I for insert to authenticated with check (true)', t);
    execute format('create policy "alterar admin" on public.%I for update to authenticated using (public.is_admin_session()) with check (public.is_admin_session())', t);
    execute format('create policy "apagar admin" on public.%I for delete to authenticated using (public.is_admin_session())', t);
  end loop;

  foreach t in array admin_delete loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('create policy "ler" on public.%I for select to anon, authenticated using (true)', t);
    execute format('create policy "inserir" on public.%I for insert to authenticated with check (true)', t);
    execute format('create policy "alterar" on public.%I for update to authenticated using (true) with check (true)', t);
    execute format('create policy "apagar admin" on public.%I for delete to authenticated using (public.is_admin_session())', t);
  end loop;
end $$;

-- Auditoria: todos inserem, ninguém altera; só admin apaga (o app tem "limpar auditoria")
do $$
declare pol record;
begin
  if to_regclass('public.audit_log') is not null then
    for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'audit_log' loop
      execute format('drop policy %I on public.audit_log', pol.policyname);
    end loop;
    alter table public.audit_log enable row level security;
    create policy "ler" on public.audit_log for select to authenticated using (true);
    create policy "inserir" on public.audit_log for insert to authenticated with check (true);
    create policy "apagar admin" on public.audit_log for delete to authenticated using (public.is_admin_session());
  end if;
end $$;
