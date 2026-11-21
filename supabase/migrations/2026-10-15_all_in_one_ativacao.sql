-- ============================================================
-- Aponta CD: Script Único de Ativação Completa + Segurança
-- Cole este arquivo inteiro no SQL Editor do Supabase e clique em RUN.
-- É 100% idempotente (seguro rodar mais de uma vez).
-- Ativa de uma só vez:
--   1. Pausas com motivo (session_pauses) + system_status
--   2. Coleta por código de barras (product_barcodes, stock_map_scans, colunas)
--   3. Inventário Cíclico Automático (cyclic_count_tasks) + colunas SLA
--   4. Endurecimento de Segurança (RLS em 7 tabelas, revoga RPCs legadas, search_path)
-- ============================================================

-- 1) Pausas com motivo + system_status
create table if not exists public.session_pauses (
  id uuid primary key default gen_random_uuid(),
  operator_code text not null,
  operator_name text,
  activity text,
  station text,
  reason text not null,
  paused_at timestamptz not null,
  resumed_at timestamptz,
  duration_seconds integer,
  created_at timestamptz not null default now()
);
create index if not exists idx_session_pauses_paused_at on public.session_pauses (paused_at desc);
create index if not exists idx_session_pauses_open on public.session_pauses (operator_code) where resumed_at is null;
alter table public.session_pauses enable row level security;
drop policy if exists "pauses leitura" on public.session_pauses;
create policy "pauses leitura" on public.session_pauses for select to authenticated using (true);
drop policy if exists "pauses escrita" on public.session_pauses;
create policy "pauses escrita" on public.session_pauses for all to authenticated using (true) with check (true);

create table if not exists public.system_status (
  key text primary key,
  value jsonb,
  updated_at timestamptz not null default now()
);
alter table public.system_status enable row level security;
drop policy if exists "status leitura" on public.system_status;
create policy "status leitura" on public.system_status for select to anon, authenticated using (true);
drop policy if exists "status escrita" on public.system_status;
create policy "status escrita" on public.system_status for all to anon, authenticated using (true) with check (true);

-- 2) Coleta por código de barras
create table if not exists public.product_barcodes (
  barcode text primary key,
  product_code text,
  product_name text,
  category text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_product_barcodes_code on public.product_barcodes (product_code);
alter table public.product_barcodes enable row level security;
drop policy if exists "barcodes leitura" on public.product_barcodes;
create policy "barcodes leitura" on public.product_barcodes for select to authenticated using (true);
drop policy if exists "barcodes escrita" on public.product_barcodes;
create policy "barcodes escrita" on public.product_barcodes for all to authenticated using (true) with check (true);

do $$
begin
  if to_regclass('public.stock_map_items') is not null then
    alter table public.stock_map_items add column if not exists barcode text;
    alter table public.stock_map_items add column if not exists level text;
    alter table public.stock_map_items add column if not exists counted_at timestamptz;
    alter table public.stock_map_items add column if not exists counted_by text;
    alter table public.stock_map_items add column if not exists source text;
    create index if not exists idx_stock_map_items_barcode on public.stock_map_items (barcode);
    create index if not exists idx_stock_map_items_area on public.stock_map_items (area_id);
  end if;
end $$;

create table if not exists public.stock_map_scans (
  id uuid primary key default gen_random_uuid(),
  scanned_at timestamptz not null default now(),
  operator_code text,
  operator_name text,
  station text,
  area_id text,
  area_code text,
  side text,
  slot text,
  level text,
  barcode text not null,
  product_code text,
  action text not null,
  quantity_delta integer not null default 0,
  item_id text,
  undone boolean not null default false
);
create index if not exists idx_stock_map_scans_when on public.stock_map_scans (scanned_at desc);
create index if not exists idx_stock_map_scans_area on public.stock_map_scans (area_id);
alter table public.stock_map_scans enable row level security;
drop policy if exists "scans leitura" on public.stock_map_scans;
create policy "scans leitura" on public.stock_map_scans for select to authenticated using (true);
drop policy if exists "scans escrita" on public.stock_map_scans;
create policy "scans escrita" on public.stock_map_scans for all to authenticated using (true) with check (true);

-- 3) Inventário Cíclico + SLA
create table if not exists public.cyclic_count_tasks (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  trigger_source text not null default 'manual',
  trigger_ref_id text,
  area_id text,
  area_code text not null,
  side text,
  slot text,
  level text,
  item_id text,
  product_code text,
  product_name text,
  reason text,
  expected_quantity integer,
  counted_quantity integer,
  divergence integer,
  blind_mode boolean not null default true,
  status text not null default 'pendente',
  counted_by_code text,
  counted_by_name text,
  counted_at timestamptz
);
create index if not exists idx_cyclic_count_status on public.cyclic_count_tasks (status, created_at desc);
create unique index if not exists idx_cyclic_count_trigger_ref on public.cyclic_count_tasks (trigger_ref_id) where trigger_ref_id is not null;
alter table public.cyclic_count_tasks enable row level security;
drop policy if exists "cyclic leitura" on public.cyclic_count_tasks;
create policy "cyclic leitura" on public.cyclic_count_tasks for select to authenticated using (true);
drop policy if exists "cyclic escrita" on public.cyclic_count_tasks;
create policy "cyclic escrita" on public.cyclic_count_tasks for all to authenticated using (true) with check (true);

do $$
begin
  if to_regclass('public.alert_settings') is not null then
    alter table public.alert_settings add column if not exists alert_system_enabled boolean default true;
    alter table public.alert_settings add column if not exists alert_errors_threshold integer default 5;
    alter table public.alert_settings add column if not exists alert_pause_sla_minutes integer default 20;
    alter table public.alert_settings add column if not exists alert_conference_stall_minutes integer default 20;
    alter table public.alert_settings add column if not exists alert_shift_productivity_min_pct integer default 80;
  end if;
end $$;

-- 4) Segurança: RLS + revogar RPCs SECURITY DEFINER legadas + search_path
do $$
declare
  t text;
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

  if to_regprocedure('public.verify_admin_pin(text)') is not null then
    revoke all on function public.verify_admin_pin(text) from public, anon;
    grant execute on function public.verify_admin_pin(text) to authenticated;
  end if;
  if to_regprocedure('public.set_admin_pin(text, text)') is not null then
    revoke all on function public.set_admin_pin(text, text) from public, anon;
    grant execute on function public.set_admin_pin(text, text) to authenticated;
  end if;
end $$;

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
