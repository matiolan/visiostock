-- VisioStock · esquema inicial (HU-09 registro de movimientos, HU-10 importador de inventario)

create extension if not exists pgcrypto;

create table if not exists productos (
  id uuid primary key default gen_random_uuid(),
  sku text unique not null,
  nombre text not null,
  zona text not null default 'A',
  stock_registrado int not null default 0,
  stock_inicial int not null default 0,
  creado_en timestamptz not null default now()
);

create table if not exists movimientos (
  id uuid primary key default gen_random_uuid(),
  zona text not null default 'A',
  sentido text not null check (sentido in ('entrada', 'salida')),
  cantidad int not null default 1,
  confianza real,
  foto_url text,
  detectado_en timestamptz not null default now()
);

create or replace view resumen_zona as
select
  p.zona,
  sum(p.stock_registrado) as stock_registrado,
  sum(p.stock_inicial) as stock_inicial,
  coalesce(m_entradas.total, 0) as entradas,
  coalesce(m_salidas.total, 0) as salidas,
  sum(p.stock_inicial) + coalesce(m_entradas.total, 0) - coalesce(m_salidas.total, 0) as stock_detectado,
  (sum(p.stock_inicial) + coalesce(m_entradas.total, 0) - coalesce(m_salidas.total, 0)) - sum(p.stock_registrado) as diferencia
from productos p
left join (
  select zona, sum(cantidad) as total
  from movimientos
  where sentido = 'entrada'
  group by zona
) m_entradas on m_entradas.zona = p.zona
left join (
  select zona, sum(cantidad) as total
  from movimientos
  where sentido = 'salida'
  group by zona
) m_salidas on m_salidas.zona = p.zona
group by p.zona, m_entradas.total, m_salidas.total;

alter table productos enable row level security;
alter table movimientos enable row level security;

drop policy if exists "productos_select_anon" on productos;
create policy "productos_select_anon"
  on productos for select
  to anon
  using (true);

drop policy if exists "movimientos_select_anon" on movimientos;
create policy "movimientos_select_anon"
  on movimientos for select
  to anon
  using (true);

insert into storage.buckets (id, name, public)
values ('evidencias', 'evidencias', true)
on conflict (id) do nothing;

drop policy if exists "evidencias_select_publico" on storage.objects;
create policy "evidencias_select_publico"
  on storage.objects for select
  to public
  using (bucket_id = 'evidencias');
