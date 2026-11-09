-- SCRUM-72: endurecimiento según el Security Advisor de Supabase (07/11/2026).
-- Ejecutar UNA VEZ en proyectos creados con la versión anterior de esquema.sql. No modifica datos.
-- Supabase concede EXECUTE al rol anon por separado de PUBLIC; revocar solo a PUBLIC no bastaba.
begin;
revoke execute on function public.vs_admin(), public.vs_acceso(uuid) from anon;
revoke execute on function public.vs_registrar_movimiento(uuid,text,int) from anon;
revoke execute on function public.vs_asignar_cliente(text,uuid) from anon;
commit;

-- Verificación: debe devolver 0 filas.
select p.proname
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prosecdef and p.proname like 'vs\_%'
  and has_function_privilege('anon', p.oid, 'EXECUTE');
