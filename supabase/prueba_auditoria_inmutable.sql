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

do $$
declare
  antes_bitacora int;
  despues_bitacora int;
  v boolean; alt uuid;
begin
  -- Escenario 3: la cadena recien insertada debe ser valida.
  select valido, primer_alterado into v, alt from public.vs_verificar_cadena('30000000-0000-0000-0000-000000000001');
  if not v or alt is not null then raise exception 'La cadena deberia ser valida recien insertada'; end if;

  -- Escenario 1: como cliente de la empresa, intentar modificar un movimiento debe fallar y quedar en la bitacora.
  select count(*) into antes_bitacora from public.vs_intentos_bloqueados where empresa_id = '30000000-0000-0000-0000-000000000001';
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', true);
  begin
    update public.vs_movimientos set cantidad = 999 where id = '33000000-0000-0000-0000-000000000001';
    raise exception 'El UPDATE deberia haber sido rechazado';
  exception when others then
    if sqlerrm not like 'Los movimientos son append-only%' then raise; end if;
  end;
  begin
    delete from public.vs_movimientos where id = '33000000-0000-0000-0000-000000000002';
    raise exception 'El DELETE deberia haber sido rechazado';
  exception when others then
    if sqlerrm not like 'Los movimientos son append-only%' then raise; end if;
  end;
  reset role;
  select count(*) into despues_bitacora from public.vs_intentos_bloqueados where empresa_id = '30000000-0000-0000-0000-000000000001';
  if despues_bitacora <> antes_bitacora + 2 then raise exception 'Se esperaban 2 intentos nuevos en la bitacora, hubo %', despues_bitacora - antes_bitacora; end if;
  if (select cantidad from public.vs_movimientos where id = '33000000-0000-0000-0000-000000000001') <> 10 then
    raise exception 'El movimiento original fue alterado pese al bloqueo';
  end if;
  if not exists (select 1 from public.vs_movimientos where id = '33000000-0000-0000-0000-000000000002') then
    raise exception 'El movimiento original fue borrado pese al bloqueo';
  end if;

  -- Escenario 2: un ajuste trazable corrige el stock sin tocar el movimiento original.
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', true);
  perform public.vs_registrar_ajuste('32000000-0000-0000-0000-000000000001', '33000000-0000-0000-0000-000000000001', -2, 'Conteo fisico encontro 2 unidades menos');
  reset role;
  if (select stock from public.vs_productos where id = '32000000-0000-0000-0000-000000000001') <> 5 then
    raise exception 'El stock tras el ajuste no es el esperado (10 - 3 inicial - 2 ajuste = 5)';
  end if;
  if (select cantidad from public.vs_movimientos where id = '33000000-0000-0000-0000-000000000001') <> 10 then
    raise exception 'El ajuste altero el movimiento original';
  end if;
  if not exists (select 1 from public.vs_ajustes_inventario where movimiento_original_id = '33000000-0000-0000-0000-000000000001' and cantidad_ajuste = -2) then
    raise exception 'No quedo registrado el ajuste trazable';
  end if;

  -- Escenario 3: una alteracion hecha por fuera de la aplicacion (p. ej. con service_role) se detecta.
  update public.vs_movimientos set hash_actual = 'manipulado' where id = '33000000-0000-0000-0000-000000000001';
  select valido, primer_alterado into v, alt from public.vs_verificar_cadena('30000000-0000-0000-0000-000000000001');
  if v or alt <> '33000000-0000-0000-0000-000000000001' then raise exception 'La verificacion no detecto el hash manipulado'; end if;

  raise notice 'Auditoria inmutable OK: bloqueo + bitacora, ajustes trazables y cadena de hash funcionan';
end $$;
rollback;
