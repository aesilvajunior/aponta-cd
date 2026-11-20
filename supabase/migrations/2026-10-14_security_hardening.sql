-- ============================================================
-- Aponta CD: Endurecimento de Segurança (RLS + RPCs + search_path)
-- Idempotente: seguro rodar mais de uma vez.
-- Corrige todos os achados críticos/altos do Supabase Security Advisor:
--   1. Ativa RLS nas 7 tabelas públicas expostas sem RLS
--   2. Revoga EXECUTE de anon/public em todas as funções SECURITY DEFINER
--      (incluindo funções legadas destrutivas delete_all_*)
--   3. Fixa search_path = public nas funções com search_path mutável
-- ============================================================

-- ------------------------------------------------------------
-- 1) Ativar RLS nas 7 tabelas públicas que estavam desprotegidas
-- ------------------------------------------------------------
do $$
declare
  t text;
  -- Tabelas internas: apenas usuários autenticados leem/escrevem
  auth_only_tables text[] := array[
    'stock_map_areas',
    'stock_map_items',
    'fraud_alerts',
    'operator_goals',
    'scheduled_reports',
    'kiosk_preferences'
  ];
begin
  foreach t in array auth_only_tables loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "auth_select_%s" on public.%I', t, t);
    execute format('drop policy if exists "auth_write_%s" on public.%I', t, t);
    execute format('create policy "auth_select_%s" on public.%I for select to authenticated using (true)', t, t);
    execute format('create policy "auth_write_%s" on public.%I for all to authenticated using (true) with check (true)', t, t);
  end loop;

  -- conference_queue: a TV (/tv) lê sem login (anon), mas só autenticados escrevem
  if to_regclass('public.conference_queue') is not null then
    alter table public.conference_queue enable row level security;
    drop policy if exists "tv_read_conference_queue" on public.conference_queue;
    drop policy if exists "auth_write_conference_queue" on public.conference_queue;
    create policy "tv_read_conference_queue" on public.conference_queue
      for select to anon, authenticated using (true);
    create policy "auth_write_conference_queue" on public.conference_queue
      for all to authenticated using (true) with check (true);
  end if;
end $$;

-- ------------------------------------------------------------
-- 2) Revogar EXECUTE de anon/authenticated em funções SECURITY DEFINER legadas
--    (Nenhuma dessas 9 funções é chamada pelo frontend atual; eram vetores críticos
--     permitindo que anon apagasse entries/audit_log/shortages via /rest/v1/rpc/*)
-- ------------------------------------------------------------
do $$
declare
  fn text;
  legacy_fns text[] := array[
    'public.delete_all_entries()',
    'public.delete_all_audit_log()',
    'public.delete_all_separation_errors()',
    'public.delete_all_shortages()',
    'public.rename_activity_atomic(text, text)',
    'public.rename_error_type_atomic(text, text)',
    'public.check_schedule_conflict(timestamp with time zone, uuid)',
    'public.start_session_atomic(text, text, text, text, text, text, boolean, text, text, text, text, boolean, text, text)',
    'public.finish_session_atomic(text, text, text, timestamp with time zone, timestamp with time zone, integer, text, text, text, text, text, boolean, text, text, text, text, boolean, text, text)'
  ];
begin
  foreach fn in array legacy_fns loop
    if to_regprocedure(fn) is not null then
      execute format('revoke all on function %s from public, anon, authenticated', fn);
    end if;
  end loop;

  -- PIN RPCs: bloquear anon completamente (só usuários autenticados podem chamar)
  if to_regprocedure('public.verify_admin_pin(text)') is not null then
    revoke all on function public.verify_admin_pin(text) from public, anon;
    grant execute on function public.verify_admin_pin(text) to authenticated;
  end if;

  if to_regprocedure('public.set_admin_pin(text, text)') is not null then
    revoke all on function public.set_admin_pin(text, text) from public, anon;
    grant execute on function public.set_admin_pin(text, text) to authenticated;
  end if;
end $$;

-- ------------------------------------------------------------
-- 3) Fixar search_path em funções com search_path mutável
-- ------------------------------------------------------------
do $$
begin
  if to_regprocedure('public.update_delivery_schedule_timestamp()') is not null then
    alter function public.update_delivery_schedule_timestamp() set search_path = public;
  end if;
  if to_regprocedure('public.update_updated_at_column()') is not null then
    alter function public.update_updated_at_column() set search_path = public;
  end if;
  if to_regprocedure('public.get_operator_ranking(date, date)') is not null then
    alter function public.get_operator_ranking(date, date) set search_path = public;
  end if;
end $$;
