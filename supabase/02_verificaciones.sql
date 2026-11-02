-- Ejecutar después de esquema.sql. No borra ni reemplaza inventario.
begin;
create table if not exists public.vs_verificaciones (
 id uuid primary key default gen_random_uuid(), empresa_id uuid not null references public.vs_empresas(id),
 producto_id uuid not null references public.vs_productos(id), stock_registrado int not null check(stock_registrado>=0),
 conteo int not null check(conteo>=0), diferencia int generated always as (conteo-stock_registrado) stored,
 metodo text not null check(metodo in ('manual','asistido')), modelo text, clase text,
 evidencia text not null, nota text not null default '', actor uuid not null references auth.users(id),
 creado_en timestamptz not null default now(), revisado_en timestamptz, revisado_por uuid references auth.users(id),
 revision text not null default ''
);
create index if not exists vs_verificaciones_empresa_fecha on public.vs_verificaciones(empresa_id,creado_en desc);
alter table public.vs_verificaciones enable row level security;
drop policy if exists leer_verificaciones on public.vs_verificaciones;
create policy leer_verificaciones on public.vs_verificaciones for select to authenticated using(public.vs_acceso(empresa_id));
grant select on public.vs_verificaciones to authenticated;
revoke all on public.vs_verificaciones from anon;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('vs-evidencias','vs-evidencias',false,5242880,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
-- Los archivos son privados y su ruta siempre incluye empresa/usuario/archivo.
create or replace function public.vs_ruta_evidencia(ruta text) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.vs_empresas e where e.id::text=split_part(ruta,'/',1) and public.vs_acceso(e.id))
$$;
revoke all on function public.vs_ruta_evidencia(text) from public, anon;
grant execute on function public.vs_ruta_evidencia(text) to authenticated;
drop policy if exists vs_foto_leer on storage.objects;
create policy vs_foto_leer on storage.objects for select to authenticated using(bucket_id='vs-evidencias' and public.vs_ruta_evidencia(name));
drop policy if exists vs_foto_crear on storage.objects;
create policy vs_foto_crear on storage.objects for insert to authenticated with check(bucket_id='vs-evidencias' and public.vs_ruta_evidencia(name) and split_part(name,'/',2)=auth.uid()::text);
-- Permite limpiar una subida propia si no llegó a vincularse a una verificación.
drop policy if exists vs_foto_limpiar on storage.objects;
create policy vs_foto_limpiar on storage.objects for delete to authenticated using(bucket_id='vs-evidencias' and split_part(name,'/',2)=auth.uid()::text and public.vs_ruta_evidencia(name) and not exists(select 1 from public.vs_verificaciones v where v.evidencia=name));

create or replace function public.vs_guardar_verificacion(p uuid,n int,foto text,met text,mod text default null,cl text default null,obs text default '') returns uuid
language plpgsql security definer set search_path=public as $$
declare producto public.vs_productos; nuevo uuid;
begin
 select * into producto from public.vs_productos where id=p for share;
 if not found or not public.vs_acceso(producto.empresa_id) then raise exception 'No autorizado'; end if;
 if n is null or n<0 or met is null or met not in ('manual','asistido') or length(coalesce(obs,''))>1000 then raise exception 'Verificación inválida'; end if;
 if met='asistido' and (length(coalesce(mod,'')) not between 1 and 160 or length(coalesce(cl,'')) not between 1 and 100) then raise exception 'Falta modelo o clase'; end if;
 if foto is null or split_part(foto,'/',1)<>producto.empresa_id::text or split_part(foto,'/',2)<>auth.uid()::text or not exists(select 1 from storage.objects where bucket_id='vs-evidencias' and name=foto) then raise exception 'Evidencia inválida'; end if;
 insert into public.vs_verificaciones(empresa_id,producto_id,stock_registrado,conteo,metodo,modelo,clase,evidencia,nota,actor)
 values(producto.empresa_id,p,producto.stock,n,met,case when met='asistido' then mod end,case when met='asistido' then cl end,foto,coalesce(obs,''),auth.uid()) returning id into nuevo;
 return nuevo;
end $$;
create or replace function public.vs_revisar_verificacion(v uuid,obs text) returns void language plpgsql security definer set search_path=public as $$
begin
 if obs is null or length(trim(obs)) not between 5 and 1000 then raise exception 'Explica la revisión (5 a 1000 caracteres)'; end if;
 update public.vs_verificaciones set revisado_en=now(),revisado_por=auth.uid(),revision=trim(obs) where id=v and public.vs_acceso(empresa_id) and diferencia<>0 and revisado_en is null;
 if not found then raise exception 'No autorizado o alerta ya revisada'; end if;
end $$;
revoke all on function public.vs_guardar_verificacion(uuid,int,text,text,text,text,text),public.vs_revisar_verificacion(uuid,text) from public, anon;
grant execute on function public.vs_guardar_verificacion(uuid,int,text,text,text,text,text),public.vs_revisar_verificacion(uuid,text) to authenticated;
commit;

