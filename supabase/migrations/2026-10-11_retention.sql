-- ============================================================
-- Aponta CD: retenção de dados (arquivar lançamentos antigos)
--
-- O app só carrega os últimos 120 dias, mas a tabela `entries` continua
-- crescendo. Esta função move lançamentos antigos para `entries_archive`
-- (mesma estrutura), mantendo tudo consultável pelo SQL Editor.
--
-- Uso manual:   select archive_old_entries(24);   -- arquiva o que tem mais de 24 meses
-- Agendado:     veja o bloco de pg_cron no final (rodar 1x por mês)
-- ============================================================

create table if not exists public.entries_archive (like public.entries including defaults);
alter table public.entries_archive enable row level security;
revoke all on public.entries_archive from anon, authenticated;

create or replace function public.archive_old_entries(p_months integer default 24)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare moved integer;
begin
  if p_months < 6 then
    raise exception 'Por segurança, o mínimo é 6 meses.';
  end if;

  with old as (
    delete from public.entries
     where start_time < now() - make_interval(months => p_months)
    returning *
  )
  insert into public.entries_archive select * from old;

  get diagnostics moved = row_count;
  return moved;
end $$;

revoke all on function public.archive_old_entries(integer) from public, anon, authenticated;

-- ------------------------------------------------------------
-- (Opcional) Agendar todo dia 1º às 03:00 (horário de Brasília = 06:00 UTC).
-- Exige a extensão pg_cron (Supabase: Database > Extensions > pg_cron).
-- Descomente para ativar:
--
-- select cron.schedule('arquivar-lancamentos', '0 6 1 * *', $$ select public.archive_old_entries(24) $$);
-- ------------------------------------------------------------
