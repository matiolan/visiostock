-- SCRUM-26 (HU-16): prueba de horario laboral, zona y evidencia opcional en movimientos.
-- Ejecutar como postgres después de esquema.sql, 06_camaras_zonas.sql y 11_horario_laboral.sql.
-- Todo se revierte al final. Si algún caso falla, lanza una excepción (el pipeline queda en rojo).
-- Las ventanas horarias de los casos 4 y 5 se calculan a partir de la hora actual (en vez de
-- usar horas fijas) para que la prueba no sea intermitente según a qué hora corra el pipeline.
begin;

insert into auth.users(id, email) values
 ('00000000-0000-0000-0000-0000000000b1', 'horario@example.test');
insert into public.vs_empresas(id, nombre) values ('21000000-0000-0000-0000-000000000001', 'Empresa Horario');
insert into public.vs_almacenes(id, empresa_id, nombre) values
 ('31000000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000001', 'Central');
insert into public.vs_productos(id, empresa_id, almacen_id, sku, nombre, stock) values
 ('41000000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001', 'HOR-1', 'Caja', 50);
-- Administrador: este mismo usuario configura el horario/feriados (solo un administrador puede,
-- según las políticas de vs_horarios_laborales/vs_feriados) y también registra movimientos.
insert into public.vs_miembros(user_id, empresa_id, rol) values
 ('00000000-0000-0000-0000-0000000000b1', null, 'administrador');
insert into public.vs_zonas(id, empresa_id, almacen_id, nombre) values
 ('51000000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001', 'Zona A');
-- Otro almacén/zona, para probar que una zona ajena al almacén del producto se rechaza.
insert into public.vs_almacenes(id, empresa_id, nombre) values
 ('31000000-0000-0000-0000-000000000002', '21000000-0000-0000-0000-000000000001', 'Secundario');
insert into public.vs_zonas(id, empresa_id, almacen_id, nombre) values
 ('51000000-0000-0000-0000-000000000002', '21000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000002', 'Zona B');
-- Empresa ajena con su propia zona y un horario restrictivo (excluye hoy), para el Caso 7:
-- un horario por zona de OTRA empresa no debe filtrarse al consultar con la zona equivocada.
insert into public.vs_empresas(id, nombre) values ('23000000-0000-0000-0000-000000000001', 'Empresa Ajena');
insert into public.vs_almacenes(id, empresa_id, nombre) values
 ('33000000-0000-0000-0000-000000000001', '23000000-0000-0000-0000-000000000001', 'Central ajena');
insert into public.vs_zonas(id, empresa_id, almacen_id, nombre) values
 ('53000000-0000-0000-0000-000000000001', '23000000-0000-0000-0000-000000000001', '33000000-0000-0000-0000-000000000001', 'Zona ajena');
insert into public.vs_horarios_laborales(empresa_id, zona_id, dias_semana, hora_inicio, hora_fin) values
 ('23000000-0000-0000-0000-000000000001', '53000000-0000-0000-0000-000000000001',
  (select array_agg(d) from unnest(array[1,2,3,4,5,6,7]::smallint[]) d
   where d <> extract(isodow from now() at time zone 'America/Lima')::smallint),
  '00:00', '23:59');
insert into storage.buckets(id, name) values ('vs-evidencias', 'vs-evidencias') on conflict (id) do nothing;
insert into storage.objects(bucket_id, name) values
 ('vs-evidencias', '21000000-0000-0000-0000-000000000001/00000000-0000-0000-0000-0000000000b1/evidencia.jpg');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated","aal":"aal1"}', true);

-- 1. Sin horario configurado: se asume que siempre está en horario (no hay alertas falsas
--    antes de que alguien lo configure).
do $$ begin
 if not public.vs_en_horario_laboral('21000000-0000-0000-0000-000000000001', null, now()) then
  raise exception 'Caso 1: sin horario configurado debe asumirse que siempre está en horario';
 end if;
end $$;

-- 2. Horario general que cubre todos los días y todo el día: en horario.
insert into public.vs_horarios_laborales(empresa_id, dias_semana, hora_inicio, hora_fin) values
 ('21000000-0000-0000-0000-000000000001', '{1,2,3,4,5,6,7}', '00:00', '23:59');
do $$ begin
 if not public.vs_en_horario_laboral('21000000-0000-0000-0000-000000000001', null, now()) then
  raise exception 'Caso 2: horario que cubre todo el día debe estar en horario';
 end if;
end $$;

-- 3. Un horario sin ningún día marcado no debe poder guardarse (si no, todo quedaría fuera
--    de horario). El check de la tabla debe rechazarlo.
do $$ begin
 update public.vs_horarios_laborales set dias_semana = '{}' where empresa_id = '21000000-0000-0000-0000-000000000001' and zona_id is null;
 raise exception 'Caso 3: un horario sin ningún día no debió aceptarse';
exception when check_violation then null;
end $$;

-- 4. Mismo horario pero el día de hoy no está habilitado: fuera de horario.
update public.vs_horarios_laborales
   set dias_semana = (select array_agg(d) from unnest(array[1,2,3,4,5,6,7]::smallint[]) d
                       where d <> extract(isodow from now() at time zone 'America/Lima')::smallint)
 where empresa_id = '21000000-0000-0000-0000-000000000001' and zona_id is null;
do $$ begin
 if public.vs_en_horario_laboral('21000000-0000-0000-0000-000000000001', null, now()) then
  raise exception 'Caso 4: el día de hoy no está habilitado, debe quedar fuera de horario';
 end if;
end $$;

-- 5. Se restablece el día de hoy, pero con una franja que no incluye la hora actual (se elige
--    la mitad del día opuesta a la hora actual, para no cruzar medianoche): fuera de horario
--    por la hora, no por el día.
update public.vs_horarios_laborales h
   set dias_semana = '{1,2,3,4,5,6,7}',
       hora_inicio = case when (now() at time zone 'America/Lima')::time < '12:00' then '12:00'::time else '00:00'::time end,
       hora_fin    = case when (now() at time zone 'America/Lima')::time < '12:00' then '23:59'::time else '06:00'::time end
 where empresa_id = '21000000-0000-0000-0000-000000000001' and zona_id is null;
do $$ begin
 if public.vs_en_horario_laboral('21000000-0000-0000-0000-000000000001', null, now()) then
  raise exception 'Caso 5: la hora actual no está dentro de la franja, debe quedar fuera de horario';
 end if;
end $$;

-- 6. Horario por zona que sí cubre la hora actual: la zona manda sobre el horario general.
update public.vs_horarios_laborales set dias_semana = '{1,2,3,4,5,6,7}', hora_inicio = '00:00', hora_fin = '23:59'
 where empresa_id = '21000000-0000-0000-0000-000000000001' and zona_id is null;
insert into public.vs_horarios_laborales(empresa_id, zona_id, dias_semana, hora_inicio, hora_fin) values
 ('21000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000001',
  (select array_agg(d) from unnest(array[1,2,3,4,5,6,7]::smallint[]) d
   where d <> extract(isodow from now() at time zone 'America/Lima')::smallint),
  '00:00', '23:59');
do $$ begin
 if public.vs_en_horario_laboral('21000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000001', now()) then
  raise exception 'Caso 6: el horario de la zona (que excluye hoy) debe prevalecer sobre el general';
 end if;
 if not public.vs_en_horario_laboral('21000000-0000-0000-0000-000000000001', null, now()) then
  raise exception 'Caso 6: sin zona debe seguir usando el horario general (en horario)';
 end if;
end $$;
delete from public.vs_horarios_laborales where zona_id = '51000000-0000-0000-0000-000000000001';

-- 7. Una zona de OTRA empresa no debe filtrar su horario: si se consulta la empresa A con una
--    zona de la "Empresa Ajena" (cuyo horario de zona excluye hoy), debe usarse igual el horario
--    GENERAL de A (que está siempre abierto), no el de la zona ajena.
do $$ begin
 if not public.vs_en_horario_laboral('21000000-0000-0000-0000-000000000001', '53000000-0000-0000-0000-000000000001', now()) then
  raise exception 'Caso 7: el horario de una zona de otra empresa no debe aplicarse; debió usarse el horario general de A';
 end if;
end $$;

-- 8. Feriado de hoy: fuera de horario aunque el horario general cubra todo el día.
insert into public.vs_feriados(empresa_id, fecha, descripcion) values
 ('21000000-0000-0000-0000-000000000001', (now() at time zone 'America/Lima')::date, 'Feriado de prueba');
do $$ begin
 if public.vs_en_horario_laboral('21000000-0000-0000-0000-000000000001', null, now()) then
  raise exception 'Caso 8: un feriado de hoy debe dejar fuera de horario aunque el horario lo cubra';
 end if;
end $$;
delete from public.vs_feriados where empresa_id = '21000000-0000-0000-0000-000000000001';

-- 9. Integración con vs_registrar_movimiento: con horario "siempre abierto", el movimiento
--    queda marcado dentro de horario y el stock se actualiza con normalidad.
do $$ declare mov uuid; begin
 mov := public.vs_registrar_movimiento('41000000-0000-0000-0000-000000000001', 'entrada', 5);
 if (select fuera_de_horario from public.vs_movimientos where id = mov) then
  raise exception 'Caso 9: con horario siempre abierto no debe marcarse fuera de horario';
 end if;
 if (select stock from public.vs_productos where id = '41000000-0000-0000-0000-000000000001') <> 55 then
  raise exception 'Caso 9: el stock no se actualizó como se esperaba';
 end if;
end $$;

-- 10. Con una franja que excluye la hora actual, vs_registrar_movimiento marca fuera_de_horario
--     pero NO bloquea el movimiento (es una alerta, no una restricción).
update public.vs_horarios_laborales
   set hora_inicio = case when (now() at time zone 'America/Lima')::time < '12:00' then '12:00'::time else '00:00'::time end,
       hora_fin    = case when (now() at time zone 'America/Lima')::time < '12:00' then '23:59'::time else '06:00'::time end
 where empresa_id = '21000000-0000-0000-0000-000000000001' and zona_id is null;
do $$ declare mov uuid; begin
 mov := public.vs_registrar_movimiento('41000000-0000-0000-0000-000000000001', 'salida', 3);
 if not (select fuera_de_horario from public.vs_movimientos where id = mov) then
  raise exception 'Caso 10: fuera de la franja horaria debe marcarse fuera_de_horario';
 end if;
 if (select stock from public.vs_productos where id = '41000000-0000-0000-0000-000000000001') <> 52 then
  raise exception 'Caso 10: el stock no se actualizó (el fuera de horario no debe bloquear)';
 end if;
end $$;
update public.vs_horarios_laborales set hora_inicio = '00:00', hora_fin = '23:59'
 where empresa_id = '21000000-0000-0000-0000-000000000001' and zona_id is null;

-- 11. Zona ajena al almacén del producto: se rechaza.
do $$ begin
 perform public.vs_registrar_movimiento('41000000-0000-0000-0000-000000000001', 'entrada', 1, null, '51000000-0000-0000-0000-000000000002');
 raise exception 'Caso 11: una zona de otro almacén no debió aceptarse';
exception when raise_exception then
 if sqlerrm <> 'La zona no pertenece al almacén del producto.' then raise; end if;
end $$;

-- 12. Zona del almacén correcto: se acepta y queda registrada en el movimiento.
do $$ declare mov uuid; begin
 mov := public.vs_registrar_movimiento('41000000-0000-0000-0000-000000000001', 'entrada', 1, null, '51000000-0000-0000-0000-000000000001');
 if (select zona_id from public.vs_movimientos where id = mov) <> '51000000-0000-0000-0000-000000000001' then
  raise exception 'Caso 12: la zona no quedó registrada en el movimiento';
 end if;
end $$;

-- 13. Evidencia (foto) inválida: ruta que no corresponde a la empresa/usuario, o que no existe
--     en storage.objects, se rechaza igual que en vs_guardar_verificacion.
do $$ begin
 perform public.vs_registrar_movimiento('41000000-0000-0000-0000-000000000001', 'entrada', 1, 'otra-empresa/otro-usuario/x.jpg');
 raise exception 'Caso 13: una ruta de evidencia de otra empresa no debió aceptarse';
exception when raise_exception then
 if sqlerrm <> 'Evidencia inválida' then raise; end if;
end $$;
do $$ begin
 perform public.vs_registrar_movimiento('41000000-0000-0000-0000-000000000001', 'entrada', 1,
   '21000000-0000-0000-0000-000000000001/00000000-0000-0000-0000-0000000000b1/no-existe.jpg');
 raise exception 'Caso 13: una evidencia que no existe en storage.objects no debió aceptarse';
exception when raise_exception then
 if sqlerrm <> 'Evidencia inválida' then raise; end if;
end $$;

-- 14. Evidencia válida: existe en storage.objects (insertada en la carga de datos inicial) con
--     la ruta esperada, y queda asociada.
do $$ declare mov uuid; begin
 mov := public.vs_registrar_movimiento('41000000-0000-0000-0000-000000000001', 'entrada', 1,
   '21000000-0000-0000-0000-000000000001/00000000-0000-0000-0000-0000000000b1/evidencia.jpg');
 if (select foto_evidencia from public.vs_movimientos where id = mov) is distinct from
    '21000000-0000-0000-0000-000000000001/00000000-0000-0000-0000-0000000000b1/evidencia.jpg' then
  raise exception 'Caso 14: la evidencia válida no quedó asociada al movimiento';
 end if;
end $$;

-- 15. Compatibilidad: el formulario manual (y el registro por video antiguo) llaman a la función
--     con solo 3 argumentos con nombre; deben seguir funcionando sin foto ni zona.
do $$ declare antes int; begin
 select stock into antes from public.vs_productos where id = '41000000-0000-0000-0000-000000000001';
 perform public.vs_registrar_movimiento(p := '41000000-0000-0000-0000-000000000001', s := 'entrada', n := 2);
 if (select stock from public.vs_productos where id = '41000000-0000-0000-0000-000000000001') <> antes + 2 then
  raise exception 'Caso 15: la llamada compatible con 3 argumentos dejó de funcionar';
 end if;
end $$;

-- 16. vs_alertas_horario solo devuelve los movimientos marcados fuera de horario de la empresa.
do $$ declare total int; fuera int; begin
 select count(*) into total from public.vs_movimientos where empresa_id = '21000000-0000-0000-0000-000000000001';
 select count(*) into fuera from public.vs_movimientos where empresa_id = '21000000-0000-0000-0000-000000000001' and fuera_de_horario;
 if fuera = 0 or fuera = total then raise exception 'Caso 16: la prueba necesita una mezcla de movimientos dentro y fuera de horario'; end if;
 if (select count(*) from public.vs_alertas_horario('21000000-0000-0000-0000-000000000001')) <> fuera then
  raise exception 'Caso 16: vs_alertas_horario no devolvió exactamente los movimientos fuera de horario';
 end if;
 if exists (select 1 from public.vs_alertas_horario('21000000-0000-0000-0000-000000000001') where not fuera_de_horario) then
  raise exception 'Caso 16: vs_alertas_horario devolvió un movimiento que no está fuera de horario';
 end if;
end $$;

reset role;
select 'prueba_horario_laboral: 16 casos OK' as resultado;
rollback;
