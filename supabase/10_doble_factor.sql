-- SCRUM-74 (HU-SEG-01): doble factor TOTP exigido en la base de datos, no solo en la pantalla.
-- Si un usuario tiene un factor TOTP verificado, su sesión debe ser AAL2 (contraseña o Google
-- + código de la app de autenticación) para leer o escribir datos de cualquier empresa.
-- Los usuarios sin factor activo siguen entrando igual (el doble factor es opcional).
-- Se aplica en vs_admin() y vs_acceso(), que usan TODAS las políticas RLS, las políticas de
-- Storage (vs_ruta_evidencia) y las funciones de escritura; así una llamada directa a la API
-- con una sesión AAL1 tampoco ve ni modifica nada.
-- Ejecutar después de esquema.sql. Idempotente; no modifica datos. Probado en prueba_doble_factor.sql.
begin;

create or replace function public.vs_mfa_cumplido() returns boolean
language sql stable security definer set search_path = public as $$
 select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
     or not exists (select 1 from auth.mfa_factors f
                    where f.user_id = auth.uid() and f.status = 'verified')
$$;
revoke all on function public.vs_mfa_cumplido() from public, anon;
grant execute on function public.vs_mfa_cumplido() to authenticated;

-- Misma firma y misma lógica que en esquema.sql, más la condición de doble factor.
create or replace function public.vs_admin() returns boolean
language sql stable security definer set search_path = public as $$
 select exists (select 1 from vs_miembros where user_id = auth.uid() and rol = 'administrador')
    and public.vs_mfa_cumplido()
$$;

create or replace function public.vs_acceso(e uuid) returns boolean
language sql stable security definer set search_path = public as $$
 select exists (select 1 from vs_miembros where user_id = auth.uid() and (rol = 'administrador' or empresa_id = e))
    and public.vs_mfa_cumplido()
$$;

revoke all on function public.vs_admin(), public.vs_acceso(uuid) from public, anon;
grant execute on function public.vs_admin(), public.vs_acceso(uuid) to authenticated;

commit;
