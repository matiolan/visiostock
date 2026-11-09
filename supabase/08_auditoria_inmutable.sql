-- SCRUM-21 · HU-11 Registro de auditoria inmodificable. Ejecutar despues de esquema.sql.
-- vs_movimientos ya era de solo lectura para authenticated (sin grant de update/delete), lo
-- cual bloqueaba cualquier intento a nivel de permisos pero sin dejar rastro. Esta migracion
-- habilita el intento (dentro de la propia empresa) para que el trigger lo registre en una
-- bitacora y despues lo rechace, y agrega una cadena de hash para detectar alteraciones hechas
-- por fuera de la aplicacion (por ejemplo con la clave service_role).
begin;

create extension if not exists pgcrypto;

-- Escenario 1: bloqueo de edicion con bitacora -------------------------------------------------
create table if not exists public.vs_intentos_bloqueados (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.vs_empresas(id),
  movimiento_id uuid,
  operacion text not null check (operacion in ('update', 'delete')),
  actor uuid references auth.users(id),
  intentado_en timestamptz not null default now()
);
create index on public.vs_intentos_bloqueados(empresa_id, intentado_en desc);
alter table public.vs_intentos_bloqueados enable row level security;
drop policy if exists leer_intentos_bloqueados on public.vs_intentos_bloqueados;
create policy leer_intentos_bloqueados on public.vs_intentos_bloqueados for select to authenticated using (vs_acceso(empresa_id));
grant select on public.vs_intentos_bloqueados to authenticated;
revoke all on public.vs_intentos_bloqueados from anon;

-- Se habilita el intento (antes no existia ni el permiso), pero el trigger de abajo
-- siempre lo rechaza. Sin esto, Postgres corta el intento antes de llegar al trigger
-- y nunca queda registrado en la bitacora.
grant update, delete on public.vs_movimientos to authenticated;
drop policy if exists intentar_modificar_movimientos on public.vs_movimientos;
create policy intentar_modificar_movimientos on public.vs_movimientos for update to authenticated using (vs_acceso(empresa_id)) with check (vs_acceso(empresa_id));
drop policy if exists intentar_eliminar_movimientos on public.vs_movimientos;
create policy intentar_eliminar_movimientos on public.vs_movimientos for delete to authenticated using (vs_acceso(empresa_id));

create or replace function public.vs_bloquear_movimiento() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.vs_intentos_bloqueados(empresa_id, movimiento_id, operacion, actor)
  values (old.empresa_id, old.id, lower(tg_op), auth.uid());
  raise exception 'Los movimientos son append-only: no se pueden modificar ni eliminar (id=%)', old.id;
end;
$$;
revoke all on function public.vs_bloquear_movimiento() from public, anon;

drop trigger if exists vs_movimientos_bloquear_update on public.vs_movimientos;
create trigger vs_movimientos_bloquear_update
  before update on public.vs_movimientos
  for each row execute function public.vs_bloquear_movimiento();

drop trigger if exists vs_movimientos_bloquear_delete on public.vs_movimientos;
create trigger vs_movimientos_bloquear_delete
  before delete on public.vs_movimientos
  for each row execute function public.vs_bloquear_movimiento();

-- Escenario 2: ajustes trazables, sin alterar el movimiento original --------------------------
create table if not exists public.vs_ajustes_inventario (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.vs_empresas(id),
  producto_id uuid not null references public.vs_productos(id),
  movimiento_original_id uuid references public.vs_movimientos(id),
  usuario uuid not null references auth.users(id),
  motivo text not null check (length(trim(motivo)) between 5 and 500),
  cantidad_ajuste int not null check (cantidad_ajuste <> 0),
  creado_en timestamptz not null default now()
);
create index on public.vs_ajustes_inventario(empresa_id, creado_en desc);
alter table public.vs_ajustes_inventario enable row level security;
drop policy if exists leer_ajustes on public.vs_ajustes_inventario;
create policy leer_ajustes on public.vs_ajustes_inventario for select to authenticated using (vs_acceso(empresa_id));
grant select on public.vs_ajustes_inventario to authenticated;
revoke all on public.vs_ajustes_inventario from anon;

create or replace function public.vs_registrar_ajuste(p uuid, mov uuid, cant int, motivo text) returns uuid
language plpgsql security definer set search_path = public as $$
declare producto public.vs_productos; nuevo uuid;
begin
  select * into producto from public.vs_productos where id = p for update;
  if not found or not vs_acceso(producto.empresa_id) then raise exception 'No autorizado'; end if;
  if cant is null or cant = 0 then raise exception 'La cantidad del ajuste no puede ser 0.'; end if;
  if motivo is null or length(trim(motivo)) not between 5 and 500 then raise exception 'Explica el motivo del ajuste (5 a 500 caracteres).'; end if;
  if mov is not null and not exists (select 1 from public.vs_movimientos where id = mov and empresa_id = producto.empresa_id) then
    raise exception 'El movimiento de referencia no pertenece a esta empresa.';
  end if;
  if producto.stock + cant < 0 then raise exception 'El ajuste dejaria el stock en negativo.'; end if;
  update public.vs_productos set stock = stock + cant where id = p;
  insert into public.vs_ajustes_inventario(empresa_id, producto_id, movimiento_original_id, usuario, motivo, cantidad_ajuste)
  values (producto.empresa_id, p, mov, auth.uid(), trim(motivo), cant) returning id into nuevo;
  return nuevo;
end;
$$;
revoke all on function public.vs_registrar_ajuste(uuid, uuid, int, text) from public, anon;
grant execute on function public.vs_registrar_ajuste(uuid, uuid, int, text) to authenticated;

-- Escenario 3: cadena de hash para detectar alteraciones fuera de la aplicacion ----------------
-- Simplificacion deliberada: bajo inserciones concurrentes de la MISMA empresa, dos inserts
-- podrian leer el mismo "ultimo hash" antes de que el otro confirme, rompiendo el orden de la
-- cadena. Aceptable para el volumen de este proyecto; una version futura usaria un lock por
-- empresa (advisory lock) antes de encadenar.
alter table public.vs_movimientos add column if not exists hash_anterior text;
alter table public.vs_movimientos add column if not exists hash_actual text;

create or replace function public.vs_encadenar_movimiento() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare anterior text;
begin
  select hash_actual into anterior from public.vs_movimientos
    where empresa_id = new.empresa_id
    order by creado_en desc, id desc
    limit 1;
  new.hash_anterior := coalesce(anterior, repeat('0', 64));
  new.hash_actual := encode(digest(
    new.hash_anterior || new.id::text || new.producto_id::text || new.sentido || new.cantidad::text || new.creado_en::text,
    'sha256'), 'hex');
  return new;
end;
$$;
revoke all on function public.vs_encadenar_movimiento() from public, anon;

drop trigger if exists vs_movimientos_encadenar on public.vs_movimientos;
create trigger vs_movimientos_encadenar
  before insert on public.vs_movimientos
  for each row execute function public.vs_encadenar_movimiento();

create or replace function public.vs_verificar_cadena(empresa uuid) returns table(valido boolean, primer_alterado uuid)
language plpgsql security definer set search_path = public, extensions as $$
declare r record; anterior text := repeat('0', 64); calculado text;
begin
  if not vs_acceso(empresa) then raise exception 'No autorizado'; end if;
  for r in select * from public.vs_movimientos where empresa_id = empresa order by creado_en asc, id asc loop
    calculado := encode(digest(anterior || r.id::text || r.producto_id::text || r.sentido || r.cantidad::text || r.creado_en::text, 'sha256'), 'hex');
    if r.hash_anterior is distinct from anterior or r.hash_actual is distinct from calculado then
      return query select false, r.id;
      return;
    end if;
    anterior := r.hash_actual;
  end loop;
  return query select true, null::uuid;
end;
$$;
revoke all on function public.vs_verificar_cadena(uuid) from public, anon;
grant execute on function public.vs_verificar_cadena(uuid) to authenticated;

commit;
