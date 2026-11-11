-- SCRUM-74: prueba del doble factor exigido por la base de datos.
-- Ejecutar como postgres después de esquema.sql y 10_doble_factor.sql. Todo se revierte al final.
-- Si algún caso falla, lanza una excepción (el pipeline queda en rojo).
begin;
insert into auth.users(id, email) values
 ('00000000-0000-0000-0000-0000000000a1', 'sin-factor@example.test'),
 ('00000000-0000-0000-0000-0000000000a2', 'con-factor@example.test'),
 ('00000000-0000-0000-0000-0000000000a3', 'factor-sin-confirmar@example.test'),
 ('00000000-0000-0000-0000-0000000000a4', 'admin-con-factor@example.test');
insert into public.vs_empresas(id, nombre) values ('20000000-0000-0000-0000-000000000001', 'Empresa MFA');
insert into public.vs_almacenes(id, empresa_id, nombre) values
 ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Central');
insert into public.vs_productos(id, empresa_id, almacen_id, sku, nombre, stock) values
 ('40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'MFA-1', 'Caja', 10);
insert into public.vs_miembros(user_id, empresa_id, rol) values
 ('00000000-0000-0000-0000-0000000000a1', '20000000-0000-0000-0000-000000000001', 'cliente'),
 ('00000000-0000-0000-0000-0000000000a2', '20000000-0000-0000-0000-000000000001', 'cliente'),
 ('00000000-0000-0000-0000-0000000000a3', '20000000-0000-0000-0000-000000000001', 'cliente'),
 ('00000000-0000-0000-0000-0000000000a4', null, 'administrador');
insert into auth.mfa_factors(user_id, status) values
 ('00000000-0000-0000-0000-0000000000a2', 'verified'),
 ('00000000-0000-0000-0000-0000000000a3', 'unverified'),
 ('00000000-0000-0000-0000-0000000000a4', 'verified');

set local role authenticated;

-- 1. Usuario SIN doble factor, sesión AAL1: entra como siempre.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated","aal":"aal1"}', true);
do $$ begin
 if (select count(*) from public.vs_productos) <> 1 then raise exception 'Caso 1: un usuario sin doble factor debe ver sus productos'; end if;
 perform public.vs_registrar_movimiento('40000000-0000-0000-0000-000000000001', 'entrada', 1);
end $$;

-- 2. Usuario CON doble factor, sesión AAL1 (solo contraseña o solo Google): no ve ni escribe nada.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated","aal":"aal1"}', true);
do $$ begin
 if public.vs_mfa_cumplido() then raise exception 'Caso 2: AAL1 con factor verificado no debe cumplir'; end if;
 if (select count(*) from public.vs_productos) <> 0 then raise exception 'Caso 2: AAL1 vio productos sin el segundo factor'; end if;
 if (select count(*) from public.vs_empresas) <> 0 then raise exception 'Caso 2: AAL1 vio empresas sin el segundo factor'; end if;
 if (select count(*) from public.vs_movimientos) <> 0 then raise exception 'Caso 2: AAL1 vio movimientos sin el segundo factor'; end if;
 -- Sí puede leer su propia membresía, para que la pantalla sepa que debe pedir el código.
 if (select count(*) from public.vs_miembros) <> 1 then raise exception 'Caso 2: debe poder leer su propia membresía'; end if;
 begin
  perform public.vs_registrar_movimiento('40000000-0000-0000-0000-000000000001', 'salida', 1);
  raise exception 'Caso 2: AAL1 pudo registrar un movimiento';
 exception when raise_exception then
  if sqlerrm <> 'No autorizado' then raise; end if;
 end;
end $$;

-- 3. El mismo usuario después de ingresar el código (AAL2): acceso normal.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated","aal":"aal2"}', true);
do $$ begin
 if (select count(*) from public.vs_productos) <> 1 then raise exception 'Caso 3: AAL2 debe ver sus productos'; end if;
 perform public.vs_registrar_movimiento('40000000-0000-0000-0000-000000000001', 'salida', 1);
end $$;

-- 4. Factor creado pero nunca confirmado: no cuenta como activo (no bloquea al usuario).
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated","aal":"aal1"}', true);
do $$ begin
 if (select count(*) from public.vs_productos) <> 1 then raise exception 'Caso 4: un factor sin confirmar no debe bloquear'; end if;
end $$;

-- 5. Administrador con doble factor: sin el código pierde los permisos de administrador.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a4","role":"authenticated","aal":"aal1"}', true);
do $$ begin
 if public.vs_admin() then raise exception 'Caso 5: administrador AAL1 no debe ser admin'; end if;
 begin
  insert into public.vs_empresas(nombre) values ('No permitido');
  raise exception 'Caso 5: administrador AAL1 pudo crear una empresa';
 exception when insufficient_privilege then null;
 end;
end $$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a4","role":"authenticated","aal":"aal2"}', true);
do $$ begin
 if not public.vs_admin() then raise exception 'Caso 5: administrador AAL2 debe ser admin'; end if;
end $$;

-- 6. Sin sesión (anon) la función ni siquiera se puede ejecutar.
reset role;
set local role anon;
do $$ begin
 perform public.vs_mfa_cumplido();
 raise exception 'Caso 6: anon pudo ejecutar vs_mfa_cumplido';
exception when insufficient_privilege then null;
end $$;

reset role;
select 'prueba_doble_factor: 6 casos OK' as resultado;
rollback;
