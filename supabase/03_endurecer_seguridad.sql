-- SCRUM-72: endurecimiento según el Security Advisor de Supabase (07/11/2026).
-- Ejecutar UNA VEZ en proyectos creados con la versión anterior de esquema.sql. No modifica datos.
-- Supabase concede EXECUTE al rol anon por separado de PUBLIC; revocar solo a PUBLIC no bastaba.
begin;
revoke execute on function public.vs_admin(), public.vs_acceso(uuid) from anon;
-- vs_registrar_movimiento cambió de firma en 11_horario_laboral.sql (gana foto y zona
-- opcionales); revoca la que exista en este momento para que este archivo funcione sin
-- importar si corre antes o después de 11, o si se vuelve a correr más de una vez.
do $$ begin
  if to_regprocedure('public.vs_registrar_movimiento(uuid,text,int)') is not null then
    revoke execute on function public.vs_registrar_movimiento(uuid,text,int) from anon;
  end if;
  if to_regprocedure('public.vs_registrar_movimiento(uuid,text,int,text,uuid)') is not null then
    revoke execute on function public.vs_registrar_movimiento(uuid,text,int,text,uuid) from anon;
  end if;
end $$;
revoke execute on function public.vs_asignar_cliente(text,uuid) from anon;
commit;

-- Verificación: debe devolver 0 filas.
select p.proname
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prosecdef and p.proname like 'vs\_%'
  and has_function_privilege('anon', p.oid, 'EXECUTE');
