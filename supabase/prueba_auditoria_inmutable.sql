-- SCRUM-21 · Prueba de HU-11 (registro de auditoria inmodificable). Ejecutar como postgres,
-- despues de 08_auditoria_inmutable.sql. Toda la prueba revierte: no deja datos.
begin;

insert into auth.users(id, email) values ('00000000-0000-0000-0000-0000000000b1', 'auditoria@example.test');
insert into public.vs_empresas(id, nombre) values ('30000000-0000-0000-0000-000000000001', 'Prueba auditoria');
insert into public.vs_miembros(user_id, empresa_id, rol) values ('00000000-0000-0000-0000-0000000000b1', '30000000-0000-0000-0000-000000000001', 'cliente');
insert into public.vs_almacenes(id, empresa_id, nombre) values ('31000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Central');
insert into public.vs_productos(id, empresa_id, almacen_id, sku, nombre, stock)
  values ('32000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001', 'AUD-1', 'Producto auditado', 50);

insert into public.vs_movimientos(id, empresa_id, producto_id, sentido, cantidad, actor)
  values ('33000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000001', 'entrada', 10, '00000000-0000-0000-0000-0000000000b1');
insert into public.vs_movimientos(id, empresa_id, producto_id, sentido, cantidad, actor)
  values ('33000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000001', 'salida', 3, '00000000-0000-0000-0000-0000000000b1');

-- A partir de aqui actuamos como el cliente de la empresa (igual que la web autenticada).
-- set_config con is_local=true dura el resto de esta transaccion, sobrevive al reset role.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', true);

do $$
declare
  antes_bitacora int;
  despues_bitacora int;
  v boolean; alt uuid;
begin
  -- Escenario 3 (parte 1): la cadena recien insertada debe ser valida.
  select valido, primer_alterado into v, alt from public.vs_verificar_cadena('30000000-0000-0000-0000-000000000001');
  if not v or alt is not null then raise exception 'La cadena deberia ser valida recien insertada'; end if;

  -- Escenario 1: intentar modificar o borrar un movimiento no debe cambiar nada, y debe quedar
  -- en la bitacora. El trigger no lanza excepcion (ver 08_auditoria_inmutable.sql): devuelve
  -- null, asi que el UPDATE/DELETE "corre" sin error pero no afecta ninguna fila.
  select count(*) into antes_bitacora from public.vs_intentos_bloqueados where empresa_id = '30000000-0000-0000-0000-000000000001';
  update public.vs_movimientos set cantidad = 999 where id = '33000000-0000-0000-0000-000000000001';
  delete from public.vs_movimientos where id = '33000000-0000-0000-0000-000000000002';
  select count(*) into despues_bitacora from public.vs_intentos_bloqueados where empresa_id = '30000000-0000-0000-0000-000000000001';
  if despues_bitacora <> antes_bitacora + 2 then raise exception 'Se esperaban 2 intentos nuevos en la bitacora, hubo %', despues_bitacora - antes_bitacora; end if;
  if (select cantidad from public.vs_movimientos where id = '33000000-0000-0000-0000-000000000001') <> 10 then
    raise exception 'El movimiento original fue alterado pese al bloqueo';
  end if;
  if not exists (select 1 from public.vs_movimientos where id = '33000000-0000-0000-0000-000000000002') then
    raise exception 'El movimiento original fue borrado pese al bloqueo';
  end if;

  -- Escenario 2: un ajuste trazable corrige el stock sin tocar el movimiento original.
  perform public.vs_registrar_ajuste('32000000-0000-0000-0000-000000000001', '33000000-0000-0000-0000-000000000001', -2, 'Conteo fisico encontro 2 unidades menos');
  if (select stock from public.vs_productos where id = '32000000-0000-0000-0000-000000000001') <> 5 then
    raise exception 'El stock tras el ajuste no es el esperado (10 - 3 inicial - 2 ajuste = 5)';
  end if;
  if (select cantidad from public.vs_movimientos where id = '33000000-0000-0000-0000-000000000001') <> 10 then
    raise exception 'El ajuste altero el movimiento original';
  end if;
  if not exists (select 1 from public.vs_ajustes_inventario where movimiento_original_id = '33000000-0000-0000-0000-000000000001' and cantidad_ajuste = -2) then
    raise exception 'No quedo registrado el ajuste trazable';
  end if;
end $$;

reset role;

-- Escenario 3 (parte 2): una alteracion hecha por fuera de la aplicacion (p. ej. restaurando un
-- backup o con acceso directo a la base) se detecta. El propio trigger de bloqueo tambien
-- impediria este UPDATE, asi que se desactiva un instante para simular ese escenario externo.
alter table public.vs_movimientos disable trigger vs_movimientos_bloquear_update;
update public.vs_movimientos set hash_actual = 'manipulado' where id = '33000000-0000-0000-0000-000000000001';
alter table public.vs_movimientos enable trigger vs_movimientos_bloquear_update;

do $$
declare v boolean; alt uuid;
begin
  select valido, primer_alterado into v, alt from public.vs_verificar_cadena('30000000-0000-0000-0000-000000000001');
  if v or alt <> '33000000-0000-0000-0000-000000000001' then raise exception 'La verificacion no detecto el hash manipulado'; end if;
  raise notice 'Auditoria inmutable OK: bloqueo + bitacora, ajustes trazables y cadena de hash funcionan';
end $$;

rollback;
