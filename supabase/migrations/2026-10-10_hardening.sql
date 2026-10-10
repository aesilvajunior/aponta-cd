-- ============================================================
-- Aponta CD: endurecimento + desempenho (rodar no SQL Editor do Supabase)
-- É idempotente: pode rodar mais de uma vez sem problema.
-- O app continua funcionando se esta migração AINDA NÃO foi aplicada
-- (ele cai no modo legado), então dá pra aplicar com calma.
-- ============================================================

-- ------------------------------------------------------------
-- 1) PIN de admin com hash + verificação por RPC
--    O hash fica numa tabela SEPARADA, com RLS ligado e nenhuma policy:
--    ninguém lê pela API nem pelo Realtime. Só as funções abaixo acessam.
-- ------------------------------------------------------------
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.admin_secrets (
  id integer primary key,
  pin_hash text not null
);
alter table public.admin_secrets enable row level security;
revoke all on public.admin_secrets from anon, authenticated;

-- migra o PIN atual (texto puro) para hash e apaga o texto puro
insert into public.admin_secrets (id, pin_hash)
select 1, extensions.crypt(pin, extensions.gen_salt('bf'))
  from public.admin_config
 where id = 1 and coalesce(pin, '') <> ''
on conflict (id) do nothing;

update public.admin_config set pin = '' where coalesce(pin, '') <> '';

create or replace function public.verify_admin_pin(p_pin text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare ok boolean;
begin
  select (pin_hash = crypt(coalesce(p_pin, ''), pin_hash))
    into ok from admin_secrets where id = 1;
  if not coalesce(ok, false) then
    perform pg_sleep(0.7); -- freia tentativa de força bruta
  end if;
  return coalesce(ok, false);
end $$;

create or replace function public.set_admin_pin(p_current text, p_new text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if p_new is null or p_new !~ '^[0-9]{4,8}$' then
    raise exception 'PIN deve ter de 4 a 8 dígitos';
  end if;
  if not public.verify_admin_pin(p_current) then
    return false;
  end if;
  insert into admin_secrets (id, pin_hash) values (1, crypt(p_new, gen_salt('bf')))
  on conflict (id) do update set pin_hash = excluded.pin_hash;
  update admin_config set pin = '' where id = 1;
  return true;
end $$;

revoke all on function public.verify_admin_pin(text) from public;
revoke all on function public.set_admin_pin(text, text) from public;
grant execute on function public.verify_admin_pin(text) to authenticated;
grant execute on function public.set_admin_pin(text, text) to authenticated;

-- ------------------------------------------------------------
-- 2) Erros do navegador (substitui um Sentry simples)
-- ------------------------------------------------------------
create table if not exists public.client_errors (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  message text,
  stack text,
  url text,
  user_agent text,
  station text,
  context jsonb
);
alter table public.client_errors enable row level security;
drop policy if exists "insere client_errors" on public.client_errors;
create policy "insere client_errors" on public.client_errors
  for insert to anon, authenticated with check (true);
drop policy if exists "le client_errors" on public.client_errors;
create policy "le client_errors" on public.client_errors
  for select to authenticated using (true);
create index if not exists idx_client_errors_created on public.client_errors (created_at desc);

-- ------------------------------------------------------------
-- 3) Índices para as consultas por período
-- ------------------------------------------------------------
create index if not exists idx_entries_start_time on public.entries (start_time desc);
create index if not exists idx_entries_operator_start on public.entries (operator_code, start_time desc);

-- ------------------------------------------------------------
-- 4) Agregações no banco (ranking e métricas por dia/atividade)
-- ------------------------------------------------------------
create or replace view public.v_operator_daily_stats as
select
  operator_code,
  max(operator_name)                                   as operator_name,
  activity,
  (start_time at time zone 'America/Sao_Paulo')::date  as day,
  count(*)                                             as total,
  coalesce(sum(duration_seconds), 0)                   as total_seconds,
  coalesce(avg(duration_seconds), 0)::int              as avg_seconds
from public.entries
group by operator_code, activity, (start_time at time zone 'America/Sao_Paulo')::date;

alter view public.v_operator_daily_stats set (security_invoker = true);

create or replace function public.get_operator_ranking(p_from date, p_to date)
returns table (
  operator_code text,
  operator_name text,
  total bigint,
  total_seconds bigint,
  avg_seconds integer
)
language sql
stable
security invoker
as $$
  select operator_code,
         max(operator_name),
         count(*),
         coalesce(sum(duration_seconds), 0)::bigint,
         coalesce(avg(duration_seconds), 0)::int
    from public.entries
   where (start_time at time zone 'America/Sao_Paulo')::date between p_from and p_to
   group by operator_code
   order by count(*) desc;
$$;

grant execute on function public.get_operator_ranking(date, date) to authenticated;
