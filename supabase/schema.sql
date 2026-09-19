-- ====================================================================
-- Aponta CD — Hidráulica Tropeiro
-- Rode este script inteiro no SQL Editor do Supabase (Project > SQL Editor > New query)
-- ====================================================================

-- Tabela de operadores
create table if not exists operators (
  code text primary key,
  name text not null,
  role text
);

-- Tabela de atividades (a lista que muda todo mês)
create table if not exists activities (
  name text primary key,
  active boolean default true
);

-- Tabela de sessões ativas (uma atividade em andamento por operador)
create table if not exists active_sessions (
  operator_code text primary key,
  operator_name text not null,
  activity text not null,
  start_time timestamptz not null
);

-- Tabela de registros finalizados (histórico)
create table if not exists entries (
  id uuid primary key default gen_random_uuid(),
  operator_code text not null,
  operator_name text not null,
  activity text not null,
  start_time timestamptz not null,
  end_time timestamptz not null,
  duration_seconds integer not null,
  shift text not null,
  created_at timestamptz default now()
);

-- Configuração do admin (PIN)
create table if not exists admin_config (
  id integer primary key,
  pin text not null
);

-- Migrações incrementais (seguro rodar de novo — só adiciona o que faltar) ---

-- Meta de tempo (em segundos) por atividade, definida pelo admin.
alter table activities add column if not exists target_seconds integer;

-- Marca registros lançados manualmente pelo admin (dados retroativos),
-- para diferenciar de registros batidos de verdade no quiosque.
alter table entries add column if not exists manual_entry boolean not null default false;

-- Dados iniciais -------------------------------------------------------

insert into admin_config (id, pin) values (1, '2026')
  on conflict (id) do nothing;

insert into activities (name, active) values
  ('Recebimento', true),
  ('Conferência', true),
  ('Separação', true),
  ('Embalagem', true),
  ('Expedição', true),
  ('Reposição', true),
  ('Inventário', true),
  ('Outros', true)
  on conflict (name) do nothing;

insert into operators (code, name, role) values
  ('101', 'Adeildo Junior', 'Líder'),
  ('102', 'Matheus', 'Analista'),
  ('103', 'Juliana', 'Auxiliar'),
  ('104', 'Alex Sander', 'Recebimento'),
  ('105', 'Gustavo', 'Recebimento'),
  ('106', 'César', 'Conferência'),
  ('107', 'Davi', 'Conferência'),
  ('108', 'Bryan', 'Separação/Conferência (manhã)'),
  ('109', 'Lucca', 'Separação/Conferência (tarde)'),
  ('110', 'Cauã', 'Separação (manhã)'),
  ('111', 'Felipe', 'Separação (tarde)'),
  ('112', 'Kauã', 'Separação (manhã)'),
  ('113', 'Pedro Paulo', 'Separação (tarde)'),
  ('114', 'Lucas', 'Separação'),
  ('115', 'João Victor', 'Separação'),
  ('116', 'Breno', 'Separação'),
  ('117', 'Klévio', 'Separação'),
  ('118', 'Leandro', 'Separação'),
  ('119', 'Lo-Ami', 'Híbrido')
  on conflict (code) do nothing;

-- Segurança (RLS) --------------------------------------------------------
-- Este é um sistema de uso interno do CD, acessado só pela rede da empresa.
-- Liberamos leitura/escrita para a chave "anon" (pública) nas tabelas
-- operacionais. NÃO exponha esse link publicamente na internet sem outra
-- camada de proteção (ex: senha de rede, VPN, ou domínio não divulgado).

alter table operators enable row level security;
alter table activities enable row level security;
alter table active_sessions enable row level security;
alter table entries enable row level security;
alter table admin_config enable row level security;

drop policy if exists "leitura publica operators" on operators;
create policy "leitura publica operators" on operators for select using (true);
drop policy if exists "escrita publica operators" on operators;
create policy "escrita publica operators" on operators for all using (true) with check (true);

drop policy if exists "leitura publica activities" on activities;
create policy "leitura publica activities" on activities for select using (true);
drop policy if exists "escrita publica activities" on activities;
create policy "escrita publica activities" on activities for all using (true) with check (true);

drop policy if exists "leitura publica active_sessions" on active_sessions;
create policy "leitura publica active_sessions" on active_sessions for select using (true);
drop policy if exists "escrita publica active_sessions" on active_sessions;
create policy "escrita publica active_sessions" on active_sessions for all using (true) with check (true);

drop policy if exists "leitura publica entries" on entries;
create policy "leitura publica entries" on entries for select using (true);
drop policy if exists "escrita publica entries" on entries;
create policy "escrita publica entries" on entries for all using (true) with check (true);

drop policy if exists "leitura publica admin_config" on admin_config;
create policy "leitura publica admin_config" on admin_config for select using (true);
drop policy if exists "escrita publica admin_config" on admin_config;
create policy "escrita publica admin_config" on admin_config for all using (true) with check (true);

-- Habilita realtime (para as telas atualizarem sozinhas quando algo muda,
-- em qualquer aba ou dispositivo conectado). Os blocos abaixo verificam se
-- a tabela já está no publication antes de adicionar, para que este script
-- possa ser rodado de novo no futuro (ex: depois de uma atualização do
-- projeto) sem dar erro de "já existe".
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'entries') then
    alter publication supabase_realtime add table entries;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'active_sessions') then
    alter publication supabase_realtime add table active_sessions;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'operators') then
    alter publication supabase_realtime add table operators;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'activities') then
    alter publication supabase_realtime add table activities;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'admin_config') then
    alter publication supabase_realtime add table admin_config;
  end if;
end $$;
