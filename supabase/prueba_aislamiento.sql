-- Ejecutar tras 0002 en una base de prueba, como postgres. Toda la prueba revierte.
begin;
insert into auth.users(id,email) values ('00000000-0000-0000-0000-000000000001','a@example.test'),('00000000-0000-0000-0000-000000000002','b@example.test');
insert into public.vs_empresas(id,nombre) values ('10000000-0000-0000-0000-000000000001','Prueba A'),('10000000-0000-0000-0000-000000000002','Prueba B');
insert into public.vs_miembros(user_id,empresa_id,rol) values ('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','cliente'),('00000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002','cliente');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
do $$ begin
 if (select count(*) from public.vs_empresas)<>1 then raise exception 'Aislamiento de empresas falló'; end if;
 if public.vs_acceso('10000000-0000-0000-0000-000000000002') then raise exception 'Acceso cruzado permitido'; end if;
 if public.vs_admin() then raise exception 'Escalamiento de rol'; end if;
 begin
 insert into public.vs_empresas(nombre) values ('No permitido');
 raise exception 'Cliente pudo crear empresa';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
