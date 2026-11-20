-- SCRUM-63 / Mia: integración de políticas y RPC con dos empresas.
-- Ejecutar como postgres en una BASE DE PRUEBA con las mismas migraciones del job seguridad-sql.
-- No sustituye el login de navegador ni una prueba con clientes reales. Todo revierte.
begin;
insert into auth.users(id,email) values
 ('00000000-0000-0000-0000-000000000011','mia-prueba-a@example.test'),
 ('00000000-0000-0000-0000-000000000012','mia-prueba-b@example.test'),
 ('00000000-0000-0000-0000-000000000013','mia-prueba-admin@example.test'),
 ('00000000-0000-0000-0000-000000000014','mia-prueba-nuevo@example.test');
insert into public.vs_empresas(id,nombre) values
 ('10000000-0000-0000-0000-000000000011','Prueba A'),
 ('10000000-0000-0000-0000-000000000012','Prueba B');
insert into public.vs_miembros(user_id,empresa_id,rol) values
 ('00000000-0000-0000-0000-000000000011','10000000-0000-0000-0000-000000000011','cliente'),
 ('00000000-0000-0000-0000-000000000012','10000000-0000-0000-0000-000000000012','cliente'),
 ('00000000-0000-0000-0000-000000000013',null,'administrador');
insert into public.vs_almacenes(id,empresa_id,nombre) values
 ('20000000-0000-0000-0000-000000000011','10000000-0000-0000-0000-000000000011','Almacén A'),
 ('20000000-0000-0000-0000-000000000012','10000000-0000-0000-0000-000000000012','Almacén B');
insert into public.vs_productos(id,empresa_id,almacen_id,sku,nombre,stock) values
 ('30000000-0000-0000-0000-000000000011','10000000-0000-0000-0000-000000000011','20000000-0000-0000-0000-000000000011','A-001','Producto A',10),
 ('30000000-0000-0000-0000-000000000012','10000000-0000-0000-0000-000000000012','20000000-0000-0000-0000-000000000012','B-001','Producto B',20);

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000011',true);
do $$ begin
 if (select count(*) from public.vs_empresas)<>1 or (select count(*) from public.vs_almacenes)<>1 or (select count(*) from public.vs_productos)<>1 then
  raise exception 'T01: el cliente A ve filas de otra empresa'; end if;
 if exists(select 1 from public.vs_productos where sku='B-001') then raise exception 'T01: fuga de B a A'; end if;
end $$;
select 'T01: lectura aislada de empresa, almacén y producto A' as resultado;

do $$ declare bloqueado boolean:=false; begin
 begin
  insert into public.vs_productos(empresa_id,almacen_id,sku,nombre) values
  ('10000000-0000-0000-0000-000000000012','20000000-0000-0000-0000-000000000012','ILEGAL','No permitido');
 exception when insufficient_privilege then bloqueado:=true; end;
 if not bloqueado then raise exception 'T02: A pudo insertar en B'; end if;
end $$;
select 'T02: escritura cruzada rechazada por RLS' as resultado;

do $$ declare bloqueado boolean:=false; begin
 begin
  insert into public.vs_productos(empresa_id,almacen_id,sku,nombre) values
  ('10000000-0000-0000-0000-000000000011','20000000-0000-0000-0000-000000000012','MEZCLA','No permitido');
 exception when foreign_key_violation then bloqueado:=true; end;
 if not bloqueado then raise exception 'T03: almacén de otra empresa aceptado'; end if;
end $$;
select 'T03: vínculo empresa-almacén obligatorio' as resultado;

insert into public.vs_productos(empresa_id,almacen_id,sku,nombre,stock) values
 ('10000000-0000-0000-0000-000000000011','20000000-0000-0000-0000-000000000011','A-CSV','Carga propia',2);
do $$ begin
 if (select count(*) from public.vs_productos)<>2 then raise exception 'T04: inserción propia falló'; end if;
end $$;
select 'T04: inserción de inventario en empresa propia permitida' as resultado;

select public.vs_registrar_movimiento('30000000-0000-0000-0000-000000000011','entrada',3);
do $$ begin
 if (select stock from public.vs_productos where sku='A-001')<>13 then raise exception 'T05: stock no actualizado'; end if;
 if (select count(*) from public.vs_movimientos)<>1 then raise exception 'T05: movimiento no registrado'; end if;
 if exists(select 1 from public.vs_movimientos where actor<>auth.uid() or empresa_id<>'10000000-0000-0000-0000-000000000011') then raise exception 'T05: auditoría incorrecta'; end if;
end $$;
select 'T05: movimiento propio, stock y autor coherentes' as resultado;

do $$ declare bloqueado boolean:=false; begin
 begin perform public.vs_registrar_movimiento('30000000-0000-0000-0000-000000000012','entrada',9);
 exception when raise_exception then if sqlerrm='No autorizado' then bloqueado:=true; else raise; end if; end;
 if not bloqueado then raise exception 'T06: A modificó stock B mediante RPC'; end if;
end $$;
select 'T06: RPC rechaza producto ajeno' as resultado;

do $$ declare bloqueado boolean:=false; begin
 begin update public.vs_miembros set rol='administrador' where user_id=auth.uid();
 exception when insufficient_privilege then bloqueado:=true; end;
 if not bloqueado or public.vs_admin() then raise exception 'T07: cliente escaló privilegios'; end if;
end $$;
select 'T07: escalamiento de rol rechazado' as resultado;

do $$ declare bloqueado boolean:=false; begin
 begin insert into public.vs_empresas(nombre) values('Empresa no autorizada');
 exception when insufficient_privilege then bloqueado:=true; end;
 if not bloqueado then raise exception 'T08: cliente creó empresa'; end if;
end $$;
select 'T08: alta de empresa reservada a administrador' as resultado;

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000012',true);
do $$ begin
 if (select count(*) from public.vs_productos)<>1 or exists(select 1 from public.vs_productos where sku like 'A-%') then raise exception 'T09: B ve inventario A'; end if;
 if exists(select 1 from public.vs_movimientos) then raise exception 'T09: B ve movimientos A'; end if;
 if (select stock from public.vs_productos where sku='B-001')<>20 then raise exception 'T09: stock B alterado por intento cruzado'; end if;
end $$;
select 'T09: aislamiento simétrico y stock B intacto' as resultado;

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000013',true);
do $$ begin
 if not public.vs_admin() or (select count(*) from public.vs_empresas)<>2 then raise exception 'T10: administrador no ve empresas autorizadas'; end if;
end $$;
insert into public.vs_empresas(id,nombre) values ('10000000-0000-0000-0000-000000000013','Prueba nueva');
insert into public.vs_almacenes(empresa_id,nombre) values('10000000-0000-0000-0000-000000000013','Nuevo almacén');
select public.vs_asignar_cliente('mia-prueba-nuevo@example.test','10000000-0000-0000-0000-000000000013');
do $$ begin
 if not exists(select 1 from public.vs_miembros where user_id='00000000-0000-0000-0000-000000000014' and empresa_id='10000000-0000-0000-0000-000000000013' and rol='cliente') then raise exception 'T10: asignación administrativa falló'; end if;
end $$;
select 'T10: administrador crea empresa/almacén y asigna cliente' as resultado;

reset role;
set local role anon;
select set_config('request.jwt.claim.sub','',true);
do $$ declare bloqueado boolean:=false; begin
 begin perform count(*) from public.vs_productos;
 exception when insufficient_privilege then bloqueado:=true; end;
 if not bloqueado then raise exception 'T11: anon lee inventario'; end if;
end $$;
select 'T11: inventario denegado sin autenticación' as resultado;
do $$ declare bloqueado boolean:=false; begin
 begin perform public.vs_registrar_movimiento('30000000-0000-0000-0000-000000000011','entrada',1);
 exception when insufficient_privilege then bloqueado:=true; end;
 if not bloqueado then raise exception 'T12: anon ejecuta movimiento'; end if;
end $$;
select 'T12: RPC de movimiento denegada a anon' as resultado;
reset role;
rollback;
