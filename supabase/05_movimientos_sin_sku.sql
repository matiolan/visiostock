-- SCRUM-17 (HU-07): movimientos detectados por video cuyo código no se pudo leer.
-- Quedan como "NO IDENTIFICADO" con su imagen de evidencia hasta que alguien asigne el producto;
-- recién entonces se registra el movimiento y cambia el stock. Ejecutar después de 02_verificaciones.sql.
begin;
create table if not exists public.vs_movimientos_sin_sku (
 id uuid primary key default gen_random_uuid(), empresa_id uuid not null references public.vs_empresas(id), almacen_id uuid not null,
 sentido text not null check(sentido in ('entrada','salida')), cantidad int not null default 1 check(cantidad>0),
 codigo_leido text not null default '' check(length(codigo_leido)<=200), evidencia text not null, segundo numeric(8,2) not null default 0,
 actor uuid not null references auth.users(id), creado_en timestamptz not null default now(),
 producto_id uuid references public.vs_productos(id), movimiento_id uuid references public.vs_movimientos(id),
 resuelto_en timestamptz, resuelto_por uuid references auth.users(id),
 foreign key(almacen_id,empresa_id) references public.vs_almacenes(id,empresa_id)
);
create index if not exists vs_sin_sku_empresa_fecha on public.vs_movimientos_sin_sku(empresa_id,creado_en desc);
alter table public.vs_movimientos_sin_sku enable row level security;
drop policy if exists leer_sin_sku on public.vs_movimientos_sin_sku;
create policy leer_sin_sku on public.vs_movimientos_sin_sku for select to authenticated using(public.vs_acceso(empresa_id));
grant select on public.vs_movimientos_sin_sku to authenticated;
revoke all on public.vs_movimientos_sin_sku from anon;

create or replace function public.vs_registrar_sin_sku(a uuid,s text,n int,cod text,foto text,seg numeric default 0) returns uuid
language plpgsql security definer set search_path=public as $$
declare almacen public.vs_almacenes; nuevo uuid;
begin
 select * into almacen from public.vs_almacenes where id=a;
 if not found or not public.vs_acceso(almacen.empresa_id) then raise exception 'No autorizado'; end if;
 if s is null or s not in ('entrada','salida') or n is null or n<=0 or length(coalesce(cod,''))>200 or seg is null or seg<0 or seg>3600 then raise exception 'Movimiento inválido'; end if;
 if foto is null or split_part(foto,'/',1)<>almacen.empresa_id::text or split_part(foto,'/',2)<>auth.uid()::text or not exists(select 1 from storage.objects where bucket_id='vs-evidencias' and name=foto) then raise exception 'Evidencia inválida'; end if;
 insert into public.vs_movimientos_sin_sku(empresa_id,almacen_id,sentido,cantidad,codigo_leido,evidencia,segundo,actor)
 values(almacen.empresa_id,a,s,n,coalesce(cod,''),foto,seg,auth.uid()) returning id into nuevo;
 return nuevo;
end $$;
-- Asignar el producto registra el movimiento con la misma función que el formulario (valida stock y autoría).
create or replace function public.vs_resolver_sin_sku(i uuid,p uuid) returns uuid
language plpgsql security definer set search_path=public as $$
declare pendiente public.vs_movimientos_sin_sku; producto public.vs_productos; mov uuid;
begin
 select * into pendiente from public.vs_movimientos_sin_sku where id=i for update;
 if not found or not public.vs_acceso(pendiente.empresa_id) then raise exception 'No autorizado'; end if;
 if pendiente.resuelto_en is not null then raise exception 'Ya fue resuelto'; end if;
 select * into producto from public.vs_productos where id=p;
 if not found or producto.empresa_id<>pendiente.empresa_id or producto.almacen_id<>pendiente.almacen_id then raise exception 'El producto no pertenece al almacén del movimiento'; end if;
 mov:=public.vs_registrar_movimiento(p,pendiente.sentido,pendiente.cantidad);
 update public.vs_movimientos_sin_sku set producto_id=p,movimiento_id=mov,resuelto_en=now(),resuelto_por=auth.uid() where id=i;
 return mov;
end $$;
revoke all on function public.vs_registrar_sin_sku(uuid,text,int,text,text,numeric),public.vs_resolver_sin_sku(uuid,uuid) from public, anon;
grant execute on function public.vs_registrar_sin_sku(uuid,text,int,text,text,numeric),public.vs_resolver_sin_sku(uuid,uuid) to authenticated;
commit;
