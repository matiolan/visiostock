-- VisioStock nuevo. Ejecutar UNA VEZ en un proyecto Supabase NUEVO. No borra datos.
begin;
create table public.vs_empresas (id uuid primary key default gen_random_uuid(), nombre text not null check(length(trim(nombre)) between 2 and 150), creado_en timestamptz not null default now());
create table public.vs_miembros (user_id uuid primary key references auth.users(id) on delete cascade, empresa_id uuid references public.vs_empresas(id), rol text not null check(rol in ('administrador','cliente')), check(rol='administrador' or empresa_id is not null));
create table public.vs_almacenes (id uuid primary key default gen_random_uuid(), empresa_id uuid not null references public.vs_empresas(id), nombre text not null, direccion text not null default '', unique(id,empresa_id));
create table public.vs_productos (id uuid primary key default gen_random_uuid(), empresa_id uuid not null references public.vs_empresas(id), almacen_id uuid not null, sku text not null, nombre text not null, stock int not null default 0 check(stock>=0), umbral int not null default 3 check(umbral>=0), unique(empresa_id,almacen_id,sku), foreign key(almacen_id,empresa_id) references public.vs_almacenes(id,empresa_id));
create table public.vs_movimientos (id uuid primary key default gen_random_uuid(), empresa_id uuid not null references public.vs_empresas(id), producto_id uuid not null references public.vs_productos(id), sentido text not null check(sentido in ('entrada','salida')), cantidad int not null check(cantidad>0), creado_en timestamptz not null default now(), actor uuid not null references auth.users(id));
create index on public.vs_productos(empresa_id);
create index on public.vs_movimientos(empresa_id,creado_en desc);
create function public.vs_admin() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from vs_miembros where user_id=auth.uid() and rol='administrador') $$;
create function public.vs_acceso(e uuid) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from vs_miembros where user_id=auth.uid() and (rol='administrador' or empresa_id=e)) $$;
revoke all on function public.vs_admin(),public.vs_acceso(uuid) from public, anon;
grant execute on function public.vs_admin(),public.vs_acceso(uuid) to authenticated;
alter table vs_empresas enable row level security;
alter table vs_miembros enable row level security;
alter table vs_almacenes enable row level security;
alter table vs_productos enable row level security;
alter table vs_movimientos enable row level security;
create policy leer_empresas on vs_empresas for select to authenticated using(vs_acceso(id));
create policy gestionar_empresas on vs_empresas for insert to authenticated with check(vs_admin());
create policy leer_miembros on vs_miembros for select to authenticated using(user_id=auth.uid() or vs_admin());
create policy leer_almacenes on vs_almacenes for select to authenticated using(vs_acceso(empresa_id));
create policy crear_almacenes on vs_almacenes for insert to authenticated with check(vs_admin());
create policy leer_productos on vs_productos for select to authenticated using(vs_acceso(empresa_id));
create policy crear_productos on vs_productos for insert to authenticated with check(vs_acceso(empresa_id));
create policy leer_movimientos on vs_movimientos for select to authenticated using(vs_acceso(empresa_id));
-- Los clientes no pueden modificar roles, stock ni auditoría directamente.
grant select,insert on vs_empresas,vs_almacenes,vs_productos to authenticated;
grant select on vs_miembros,vs_movimientos to authenticated;
revoke all on vs_empresas,vs_almacenes,vs_productos,vs_miembros,vs_movimientos from anon;
create function public.vs_registrar_movimiento(p uuid,s text,n int) returns uuid language plpgsql security definer set search_path=public as $$
declare producto vs_productos; nuevo uuid;
begin
 select * into producto from vs_productos where id=p for update;
 if not found or not vs_acceso(producto.empresa_id) then raise exception 'No autorizado'; end if;
 if n is null or n<=0 or s is null or s not in ('entrada','salida') then raise exception 'Movimiento inválido'; end if;
 if s='salida' and producto.stock<n then raise exception 'Stock insuficiente'; end if;
 update vs_productos set stock=stock+case when s='entrada' then n else -n end where id=p;
 insert into vs_movimientos(empresa_id,producto_id,sentido,cantidad,actor) values(producto.empresa_id,p,s,n,auth.uid()) returning id into nuevo;
 return nuevo;
end $$;
revoke all on function vs_registrar_movimiento(uuid,text,int) from public, anon;
grant execute on function vs_registrar_movimiento(uuid,text,int) to authenticated;

create function public.vs_asignar_cliente(correo text,empresa uuid) returns void language plpgsql security definer set search_path=public as $$
declare usuario uuid;
begin
 if not public.vs_admin() then raise exception 'No autorizado'; end if;
 if not exists(select 1 from vs_empresas where id=empresa) then raise exception 'Empresa no válida'; end if;
 select id into usuario from auth.users where lower(email)=lower(trim(correo));
 if usuario is null then raise exception 'Primero crea la cuenta en Authentication'; end if;
 if exists(select 1 from vs_miembros where user_id=usuario and rol='administrador') then raise exception 'No se puede cambiar el administrador'; end if;
 insert into vs_miembros(user_id,empresa_id,rol) values(usuario,empresa,'cliente') on conflict(user_id) do update set empresa_id=excluded.empresa_id,rol='cliente';
end $$;
revoke all on function public.vs_asignar_cliente(text,uuid) from public, anon;
grant execute on function public.vs_asignar_cliente(text,uuid) to authenticated;
commit;
