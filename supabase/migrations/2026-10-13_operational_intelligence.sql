-- ============================================================
-- Aponta CD: Inteligência Operacional (seguro de repetir)
--  - cyclic_count_tasks: tarefas de inventário cíclico automático
--    (contagem cega) disparadas por faltas, conferência ou inconsistências
--  - alert_settings: limites extras para alertas proativos de SLA
-- O app funciona antes desta migração (faz fallback local para tarefas).
-- ============================================================

create table if not exists public.cyclic_count_tasks (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  trigger_source text not null default 'manual', -- falta | conferencia | inconsistencia | manual
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
  status text not null default 'pendente', -- pendente | em_contagem | concluida | cancelada
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

-- Colunas opcionais para SLA em alert_settings
do $$
begin
  if to_regclass('public.alert_settings') is not null then
    alter table public.alert_settings add column if not exists alert_pause_sla_minutes integer default 20;
    alter table public.alert_settings add column if not exists alert_conference_stall_minutes integer default 20;
    alter table public.alert_settings add column if not exists alert_shift_productivity_min_pct integer default 80;
  end if;
end $$;
