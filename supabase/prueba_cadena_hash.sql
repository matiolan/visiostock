-- SCRUM-21 · Prueba de 09_corregir_cadena_hash.sql: reproduce los 3 casos que fallaban en la
-- revision del PR (movimientos previos sin sellar, varios inserts en una misma transaccion,
-- verificar desde otra zona horaria) y confirma que el bloqueo (HU-11 escenario 1) sigue
-- intacto. Ejecutar como postgres, despues de 09_corregir_cadena_hash.sql. Revierte todo.
begin;

insert into auth.users(id, email) values ('00000000-0000-0000-0000-0000000000c1', 'cadena@example.test');
insert into public.vs_empresas(id, nombre) values ('40000000-0000-0000-0000-000000000001', 'Prueba cadena');
insert into public.vs_miembros(user_id, empresa_id, rol) values ('00000000-0000-0000-0000-0000000000c1', '40000000-0000-0000-0000-000000000001', 'cliente');
insert into public.vs_almacenes(id, empresa_id, nombre) values ('41000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'Central');
insert into public.vs_productos(id, empresa_id, almacen_id, sku, nombre, stock)
  values ('42000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000001', 'CAD-1', 'Producto cadena', 100);

-- Caso 1: movimientos "viejos" (como si existieran desde antes de 08/09), sin hash.
alter table public.vs_movimientos disable trigger vs_movimientos_encadenar;
insert into public.vs_movimientos(id, empresa_id, producto_id, sentido, cantidad, actor)
  values ('43000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '42000000-0000-0000-0000-000000000001', 'entrada', 5, '00000000-0000-0000-0000-0000000000c1');
insert into public.vs_movimientos(id, empresa_id, producto_id, sentido, cantidad, actor)
  values ('43000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000001', '42000000-0000-0000-0000-000000000001', 'salida', 2, '00000000-0000-0000-0000-0000000000c1');
alter table public.vs_movimientos enable trigger vs_movimientos_encadenar;

do $$
declare v boolean; alt uuid;
begin
  -- Sin sellar, la cadena deberia marcar "alterado" el primer movimiento viejo (hash NULL).
  select valido, primer_alterado into v, alt from public.vs_verificar_cadena('40000000-0000-0000-0000-000000000001');
  if v then raise exception 'Se esperaba que la cadena sin sellar fallara (son movimientos sin hash)'; end if;
end $$;

-- Sella los movimientos viejos (mismo procedimiento que 09_corregir_cadena_hash.sql).
alter table public.vs_movimientos disable trigger vs_movimientos_bloquear_update;
do $$
declare mov_rec record; anterior text := repeat('0', 64); nuevo_hash text;
begin
  for mov_rec in select * from public.vs_movimientos where empresa_id = '40000000-0000-0000-0000-000000000001' order by secuencia asc loop
    nuevo_hash := encode(digest(
      anterior || mov_rec.id::text || mov_rec.producto_id::text || mov_rec.sentido || mov_rec.cantidad::text
        || extract(epoch from mov_rec.creado_en)::text,
      'sha256'), 'hex');
    update public.vs_movimientos set hash_anterior = anterior, hash_actual = nuevo_hash where id = mov_rec.id;
    anterior := nuevo_hash;
  end loop;
end $$;
alter table public.vs_movimientos enable trigger vs_movimientos_bloquear_update;

do $$
declare v boolean; alt uuid;
begin
  select valido, primer_alterado into v, alt from public.vs_verificar_cadena('40000000-0000-0000-0000-000000000001');
  if not v or alt is not null then raise exception 'Caso 1 (movimientos viejos sellados) deberia ser valido'; end if;
  raise notice 'Caso 1 OK: movimientos previos a la migracion, sellados, ya no marcan alterado';
end $$;

-- Caso 2: varios movimientos en la MISMA transaccion (now() es fijo por transaccion).
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', true);
do $$
declare i int; v boolean; alt uuid;
begin
  for i in 1..20 loop
    perform public.vs_registrar_movimiento('42000000-0000-0000-0000-000000000001', 'entrada', 1);
  end loop;
  select valido, primer_alterado into v, alt from public.vs_verificar_cadena('40000000-0000-0000-0000-000000000001');
  if not v or alt is not null then raise exception 'Caso 2 (20 movimientos en la misma transaccion) deberia ser valido, fallo en %', alt; end if;
  raise notice 'Caso 2 OK: 20 movimientos en la misma transaccion, cadena valida';
end $$;
reset role;

-- Caso 3: verificar desde una sesion con otra zona horaria.
set local timezone = 'America/Lima';
do $$
declare v boolean; alt uuid;
begin
  select valido, primer_alterado into v, alt from public.vs_verificar_cadena('40000000-0000-0000-0000-000000000001');
  if not v or alt is not null then raise exception 'Caso 3 (verificar desde America/Lima) deberia ser valido'; end if;
  raise notice 'Caso 3 OK: verificar desde otra zona horaria no cambia el resultado';
end $$;
set local timezone = 'UTC';

-- Confirma que el bloqueo (HU-11 escenario 1) sigue intacto despues de estos cambios.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', true);
do $$
declare antes int; despues int;
begin
  select count(*) into antes from public.vs_intentos_bloqueados where empresa_id = '40000000-0000-0000-0000-000000000001';
  update public.vs_movimientos set cantidad = 999 where id = '43000000-0000-0000-0000-000000000001';
  select count(*) into despues from public.vs_intentos_bloqueados where empresa_id = '40000000-0000-0000-0000-000000000001';
  if despues <> antes + 1 then raise exception 'El bloqueo con bitacora dejo de funcionar'; end if;
  if (select cantidad from public.vs_movimientos where id = '43000000-0000-0000-0000-000000000001') <> 5 then
    raise exception 'El movimiento original fue alterado pese al bloqueo';
  end if;
end $$;
reset role;

select 'OK: los 3 casos reportados en la revision del PR quedan corregidos, y el bloqueo sigue intacto' as resultado;

rollback;
