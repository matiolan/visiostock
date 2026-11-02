-- Ejecutar DESPUÉS de crear tu usuario en Supabase Authentication → Users.
-- Reemplaza SOLO el correo. No escribas una contraseña aquí.
do $$
declare usuario uuid;
begin
 select id into usuario from auth.users where lower(email)=lower('CAMBIA_POR_TU_CORREO');
 if usuario is null then raise exception 'No se encontró el correo en Authentication → Users'; end if;
 insert into public.vs_miembros(user_id,rol,empresa_id) values(usuario,'administrador',null)
 on conflict(user_id) do update set rol='administrador',empresa_id=null;
end $$;
