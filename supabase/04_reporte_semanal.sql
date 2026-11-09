-- SCRUM-71 (HU-14 · SCRUM-24, escenario 1): generación automática del reporte semanal
-- de mermas y discrepancias cada lunes a las 08:00 (America/Lima = 13:00 UTC).
-- Ejecutar después de 02_verificaciones.sql. No modifica datos existentes.
-- Calcula exactamente lo mismo que web/src/lib/reporte-semanal.ts (ver prueba_reporte_semanal.sql).
begin;

create table if not exists public.vs_reportes_semanales (
 id uuid primary key default gen_random_uuid(),
 empresa_id uuid not null references public.vs_empresas(id),
 semana_inicio date not null,            -- lunes de la semana (hora de Lima)
 generado_en timestamptz not null default now(),
 datos jsonb not null,
 unique (empresa_id, semana_inicio)
);
alter table public.vs_reportes_semanales enable row level security;
drop policy if exists leer_reportes_semanales on public.vs_reportes_semanales;
create policy leer_reportes_semanales on public.vs_reportes_semanales for select to authenticated using (public.vs_acceso(empresa_id));
revoke all on public.vs_reportes_semanales from anon, authenticated;
grant select on public.vs_reportes_semanales to authenticated;

-- Lunes (fecha de Lima) de la última semana completa respecto de un instante.
create or replace function public.vs_lunes_semana_anterior(ahora timestamptz default now()) returns date
language sql stable set search_path = public as $$
 select (date_trunc('week', (ahora at time zone 'America/Lima')) - interval '7 days')::date
$$;

-- Resumen de una semana para una empresa; misma definición que resumir() en reporte-semanal.ts.
create or replace function public.vs_resumen_semana(e uuid, lunes date) returns jsonb
language sql stable security definer set search_path = public as $$
 with r as (select (lunes::timestamp at time zone 'America/Lima') as desde,
                   ((lunes + 7)::timestamp at time zone 'America/Lima') as hasta),
 m as (select mv.* from vs_movimientos mv, r where mv.empresa_id = e and mv.creado_en >= r.desde and mv.creado_en < r.hasta),
 v as (select vf.* from vs_verificaciones vf, r where vf.empresa_id = e and vf.creado_en >= r.desde and vf.creado_en < r.hasta)
 select jsonb_build_object(
  'entradas', coalesce((select sum(cantidad) from m where sentido = 'entrada'), 0),
  'salidas', coalesce((select sum(cantidad) from m where sentido = 'salida'), 0),
  'movimientos', (select count(*) from m),
  'verificaciones', (select count(*) from v),
  'conDiferencia', (select count(*) from v where diferencia <> 0),
  'unidadesFaltantes', coalesce((select sum(-diferencia) from v where diferencia < 0), 0),
  'unidadesSobrantes', coalesce((select sum(diferencia) from v where diferencia > 0), 0))
$$;

-- Genera (o regenera) el reporte de una semana para todas las empresas. Devuelve cuántas empresas procesó.
create or replace function public.vs_generar_reporte_semanal(lunes date default public.vs_lunes_semana_anterior()) returns integer
language plpgsql security definer set search_path = public as $$
declare emp record; n integer := 0; por_sku jsonb;
begin
 if extract(isodow from lunes) <> 1 then raise exception 'La semana debe empezar en lunes: %', lunes; end if;
 for emp in select id from vs_empresas loop
  select coalesce(jsonb_agg(f order by (f->>'faltante')::int desc, f->>'sku'), '[]'::jsonb) into por_sku
  from (
   select jsonb_build_object('producto_id', v.producto_id, 'sku', coalesce(p.sku, '—'), 'nombre', coalesce(p.nombre, 'Producto eliminado'),
     'verificaciones', count(*), 'conDiferencia', count(*) filter (where v.diferencia <> 0),
     'faltante', coalesce(sum(-v.diferencia) filter (where v.diferencia < 0), 0),
     'sobrante', coalesce(sum(v.diferencia) filter (where v.diferencia > 0), 0),
     'neto', sum(v.diferencia)) as f
   from vs_verificaciones v left join vs_productos p on p.id = v.producto_id
   where v.empresa_id = emp.id
     and v.creado_en >= (lunes::timestamp at time zone 'America/Lima')
     and v.creado_en < ((lunes + 7)::timestamp at time zone 'America/Lima')
   group by v.producto_id, p.sku, p.nombre
   having count(*) filter (where v.diferencia <> 0) > 0
  ) s;
  insert into vs_reportes_semanales (empresa_id, semana_inicio, generado_en, datos)
  values (emp.id, lunes, now(), jsonb_build_object(
    'actual', vs_resumen_semana(emp.id, lunes),
    'anterior', vs_resumen_semana(emp.id, lunes - 7),
    'porSku', por_sku,
    'topMermas', coalesce((select jsonb_agg(x) from (select x from jsonb_array_elements(por_sku) x where (x->>'faltante')::int > 0 limit 5) t), '[]'::jsonb)))
  on conflict (empresa_id, semana_inicio) do update set generado_en = excluded.generado_en, datos = excluded.datos;
  n := n + 1;
 end loop;
 return n;
end $$;

-- Solo el job programado (rol postgres) ejecuta estas funciones; ni anon ni usuarios con sesión.
revoke all on function public.vs_resumen_semana(uuid, date), public.vs_generar_reporte_semanal(date) from public, anon, authenticated;
revoke all on function public.vs_lunes_semana_anterior(timestamptz) from public, anon;

-- Programación: lunes 13:00 UTC = 08:00 America/Lima (Perú no usa horario de verano).
create extension if not exists pg_cron;
select cron.unschedule('vs-reporte-semanal') where exists (select 1 from cron.job where jobname = 'vs-reporte-semanal');
select cron.schedule('vs-reporte-semanal', '0 13 * * 1', 'select public.vs_generar_reporte_semanal()');

commit;

-- Verificación: debe mostrar el job activo con horario '0 13 * * 1'.
select jobname, schedule, command, active from cron.job where jobname = 'vs-reporte-semanal';
