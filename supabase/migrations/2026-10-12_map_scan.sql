-- ============================================================
-- Aponta CD: coleta por código de barras no mapa do estoque (seguro de repetir)
--  - product_barcodes: catálogo "código de barras -> produto", que cresce conforme se bipa
--  - stock_map_items:  novas colunas (barcode, level, counted_at, counted_by, source)
--  - stock_map_scans:  registro de cada bip (quem, quando, onde)
-- O app funciona antes desta migração (a tela de coleta avisa que falta rodar).
-- ============================================================

-- Catálogo de códigos de barras
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

-- Novas colunas nos itens do mapa (só se a tabela existir)
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

-- Registro de cada bip (auditoria e produtividade da coleta)
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
  action text not null,            -- adicionou | ja_existia | contou | removeu
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
