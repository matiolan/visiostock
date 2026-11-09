-- SCRUM-27 (HU-17): varias cámaras por almacén, agrupadas en zonas.
-- Ejecutar después de 05_movimientos_sin_sku.sql. No borra datos; las verificaciones existentes quedan sin cámara.
begin;
create table if not exists public.vs_zonas (
 id uuid primary key default gen_random_uuid(), empresa_id uuid not null references public.vs_empresas(id), almacen_id uuid not null,
 nombre text not null check(length(trim(nombre)) between 1 and 80), creado_en timestamptz not null default now(),
 unique(almacen_id,nombre), unique(id,empresa_id), foreign key(almacen_id,empresa_id) references public.vs_almacenes(id,empresa_id)
);
-- Dos tipos de cámara: la del navegador (dispositivo guarda su nombre, porque el deviceId cambia entre sitios
-- y al borrar permisos) y la cámara IP, que el servicio de visión lee por RTSP con su línea virtual de conteo.
-- La URL RTSP puede llevar usuario y clave: usa una cuenta de la cámara que solo pueda ver video.
create table if not exists public.vs_camaras (
 id uuid primary key default gen_random_uuid(), empresa_id uuid not null references public.vs_empresas(id), zona_id uuid not null,
 nombre text not null check(length(trim(nombre)) between 1 and 80), dispositivo text not null default '' check(length(dispositivo)<=200),
 tipo text not null default 'navegador' check(tipo in ('navegador','rtsp')), url text not null default '' check(length(url)<=500),
 linea real not null default 0.5 check(linea between 0.05 and 0.95),
 activa boolean not null default true, creado_en timestamptz not null default now(),
 ultima_senal timestamptz, ultimo_chequeo timestamptz, fps real,
 check(tipo<>'rtsp' or url ~ '^rtsps?://[^[:space:]]+$'),
 unique(zona_id,nombre), unique(id,empresa_id), foreign key(zona_id,empresa_id) references public.vs_zonas(id,empresa_id)
);
create index if not exists vs_zonas_empresa on public.vs_zonas(empresa_id);
create index if not exists vs_camaras_empresa on public.vs_camaras(empresa_id);
alter table public.vs_zonas enable row level security;
alter table public.vs_camaras enable row level security;
drop policy if exists leer_zonas on public.vs_zonas;
create policy leer_zonas on public.vs_zonas for select to authenticated using(public.vs_acceso(empresa_id));
drop policy if exists crear_zonas on public.vs_zonas;
create policy crear_zonas on public.vs_zonas for insert to authenticated with check(public.vs_acceso(empresa_id));
drop policy if exists leer_camaras on public.vs_camaras;
create policy leer_camaras on public.vs_camaras for select to authenticated using(public.vs_acceso(empresa_id));
drop policy if exists crear_camaras on public.vs_camaras;
create policy crear_camaras on public.vs_camaras for insert to authenticated with check(public.vs_acceso(empresa_id));
drop policy if exists editar_camaras on public.vs_camaras;
create policy editar_camaras on public.vs_camaras for update to authenticated using(public.vs_acceso(empresa_id)) with check(public.vs_acceso(empresa_id));
grant select,insert on public.vs_zonas,public.vs_camaras to authenticated;
-- La empresa de una cámara no se puede cambiar; moverla de zona solo es posible dentro de la misma empresa (llave compuesta).
grant update(nombre,dispositivo,tipo,url,linea,activa,zona_id) on public.vs_camaras to authenticated;
revoke all on public.vs_zonas,public.vs_camaras from anon;

-- El panel de monitoreo informa cada chequeo; la señal solo se guarda con esta función.
create or replace function public.vs_senal_camara(cam uuid,ok boolean,cuadros real default null) returns void
language plpgsql security definer set search_path=public as $$
begin
 if ok is null or (cuadros is not null and (cuadros<0 or cuadros>500)) then raise exception 'Chequeo inválido'; end if;
 update public.vs_camaras set ultimo_chequeo=now(),ultima_senal=case when ok then now() else ultima_senal end,fps=case when ok then cuadros else fps end
 where id=cam and public.vs_acceso(empresa_id);
 if not found then raise exception 'No autorizado'; end if;
end $$;
revoke all on function public.vs_senal_camara(uuid,boolean,real) from public, anon;
grant execute on function public.vs_senal_camara(uuid,boolean,real) to authenticated;

-- Cada verificación puede indicar con qué cámara se tomó la evidencia.
alter table public.vs_verificaciones add column if not exists camara_id uuid;
alter table public.vs_verificaciones drop constraint if exists vs_verificaciones_camara_empresa;
alter table public.vs_verificaciones add constraint vs_verificaciones_camara_empresa foreign key(camara_id,empresa_id) references public.vs_camaras(id,empresa_id);

drop function if exists public.vs_guardar_verificacion(uuid,int,text,text,text,text,text);
create or replace function public.vs_guardar_verificacion(p uuid,n int,foto text,met text,mod text default null,cl text default null,obs text default '',cam uuid default null) returns uuid
language plpgsql security definer set search_path=public as $$
declare producto public.vs_productos; nuevo uuid;
begin
 select * into producto from public.vs_productos where id=p for share;
 if not found or not public.vs_acceso(producto.empresa_id) then raise exception 'No autorizado'; end if;
 if n is null or n<0 or met is null or met not in ('manual','asistido') or length(coalesce(obs,''))>1000 then raise exception 'Verificación inválida'; end if;
 if met='asistido' and (length(coalesce(mod,'')) not between 1 and 160 or length(coalesce(cl,'')) not between 1 and 100) then raise exception 'Falta modelo o clase'; end if;
 if foto is null or split_part(foto,'/',1)<>producto.empresa_id::text or split_part(foto,'/',2)<>auth.uid()::text or not exists(select 1 from storage.objects where bucket_id='vs-evidencias' and name=foto) then raise exception 'Evidencia inválida'; end if;
 if cam is not null and not exists(select 1 from public.vs_camaras c join public.vs_zonas z on z.id=c.zona_id where c.id=cam and c.activa and c.empresa_id=producto.empresa_id and z.almacen_id=producto.almacen_id) then raise exception 'La cámara no está activa en el almacén del producto'; end if;
 insert into public.vs_verificaciones(empresa_id,producto_id,stock_registrado,conteo,metodo,modelo,clase,evidencia,nota,actor,camara_id)
 values(producto.empresa_id,p,producto.stock,n,met,case when met='asistido' then mod end,case when met='asistido' then cl end,foto,coalesce(obs,''),auth.uid(),cam) returning id into nuevo;
 return nuevo;
end $$;
revoke all on function public.vs_guardar_verificacion(uuid,int,text,text,text,text,text,uuid) from public, anon;
grant execute on function public.vs_guardar_verificacion(uuid,int,text,text,text,text,text,uuid) to authenticated;
commit;
