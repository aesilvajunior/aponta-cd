-- ============================================================
-- Aponta CD: tabelas de novos recursos (seguro de repetir)
--  - session_pauses: motivo e duração de cada pausa
--  - system_status:  "batimento" da TV e outras marcas de saúde
--  - alert_settings: liga/desliga do alerta de erros do sistema
-- O app funciona antes desta migração (ignora o que faltar).
-- ============================================================

-- ------------------------------------------------------------
-- Pausas com motivo
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- Marcas de saúde (a TV grava de tempos em tempos)
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- Alerta de erros do sistema (WhatsApp, pela função check-alerts)
-- ------------------------------------------------------------
do $$
begin
  if to_regclass('public.alert_settings') is not null then
    alter table public.alert_settings add column if not exists alert_system_enabled boolean default true;
    alter table public.alert_settings add column if not exists alert_errors_threshold integer default 5;
  end if;
end $$;
