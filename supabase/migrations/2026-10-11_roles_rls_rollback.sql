-- Desfaz 2026-10-11_roles_rls.sql: volta as políticas abertas (como antes).
do $$
declare
  t text;
  pol record;
  tabelas text[] := array['operators','activities','error_types','vehicles','admin_config',
                          'alert_settings','scheduled_reports','entries','separation_errors',
                          'entry_shortages','audit_log'];
begin
  foreach t in array tabelas loop
    if to_regclass('public.' || t) is null then continue; end if;
    for pol in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on public.%I', pol.policyname, t);
    end loop;
    execute format('create policy "leitura publica" on public.%I for select using (true)', t);
    execute format('create policy "escrita publica" on public.%I for all using (true) with check (true)', t);
  end loop;
end $$;
