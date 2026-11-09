-- SCRUM-18 (HU-08): incidencias de manipulación incorrecta (caídas, golpes y apilamiento indebido).
-- Ejecutar después de 06_camaras_zonas.sql. No borra datos. Cada incidencia guarda la captura del momento como evidencia.
begin;
create table if not exists public.vs_incidencias (
 id uuid primary key default gen_random_uuid(), empresa_id uuid not null references public.vs_empresas(id),
 producto_id uuid not null references public.vs_productos(id), camara_id uuid,
 tipo text not null check(tipo in ('caida','golpe','apilamiento')), origen text not null check(origen in ('video','foto')),
 segundo numeric(8,2) not null default 0 check(segundo>=0), confianza real not null check(confianza between 0 and 1),
 detalle text not null default '' check(length(detalle)<=300), evidencia text, modelo text not null check(length(modelo) between 1 and 160),
 actor uuid not null references auth.users(id), creado_en timestamptz not null default now(),
 revisado_en timestamptz, revisado_por uuid references auth.users(id), revision text not null default '',
 foreign key(camara_id,empresa_id) references public.vs_camaras(id,empresa_id)
);
create index if not exists vs_incidencias_empresa_fecha on public.vs_incidencias(empresa_id,creado_en desc);
alter table public.vs_incidencias enable row level security;
drop policy if exists leer_incidencias on public.vs_incidencias;
create policy leer_incidencias on public.vs_incidencias for select to authenticated using(public.vs_acceso(empresa_id));
grant select on public.vs_incidencias to authenticated;
revoke all on public.vs_incidencias from anon;

-- Se registran solo mediante funciones: el cliente no puede escribir ni cambiar la autoría.
create or replace function public.vs_registrar_incidencia(p uuid,t text,ori text,seg numeric,conf real,det text,mod text,cam uuid default null,foto text default null) returns uuid
language plpgsql security definer set search_path=public as $$
declare producto public.vs_productos; nuevo uuid;
begin
 select * into producto from public.vs_productos where id=p;
 if not found or not public.vs_acceso(producto.empresa_id) then raise exception 'No autorizado'; end if;
 if t is null or t not in ('caida','golpe','apilamiento') or ori is null or ori not in ('video','foto') or seg is null or seg<0 or seg>3600
  or conf is null or conf<0 or conf>1 or length(coalesce(det,''))>300 or length(coalesce(mod,'')) not between 1 and 160 then raise exception 'Incidencia inválida'; end if;
 if foto is not null and (split_part(foto,'/',1)<>producto.empresa_id::text or split_part(foto,'/',2)<>auth.uid()::text or not exists(select 1 from storage.objects where bucket_id='vs-evidencias' and name=foto)) then raise exception 'Evidencia inválida'; end if;
 if cam is not null and not exists(select 1 from public.vs_camaras c join public.vs_zonas z on z.id=c.zona_id where c.id=cam and c.activa and c.empresa_id=producto.empresa_id and z.almacen_id=producto.almacen_id) then raise exception 'La cámara no está activa en el almacén del producto'; end if;
 insert into public.vs_incidencias(empresa_id,producto_id,camara_id,tipo,origen,segundo,confianza,detalle,evidencia,modelo,actor)
 values(producto.empresa_id,p,cam,t,ori,seg,conf,coalesce(det,''),foto,mod,auth.uid()) returning id into nuevo;
 return nuevo;
end $$;
create or replace function public.vs_revisar_incidencia(i uuid,obs text) returns void language plpgsql security definer set search_path=public as $$
begin
 if obs is null or length(trim(obs)) not between 5 and 1000 then raise exception 'Explica la revisión (5 a 1000 caracteres)'; end if;
 update public.vs_incidencias set revisado_en=now(),revisado_por=auth.uid(),revision=trim(obs) where id=i and public.vs_acceso(empresa_id) and revisado_en is null;
 if not found then raise exception 'No autorizado o incidencia ya revisada'; end if;
end $$;
revoke all on function public.vs_registrar_incidencia(uuid,text,text,numeric,real,text,text,uuid,text),public.vs_revisar_incidencia(uuid,text) from public, anon;
grant execute on function public.vs_registrar_incidencia(uuid,text,text,numeric,real,text,text,uuid,text),public.vs_revisar_incidencia(uuid,text) to authenticated;
commit;
