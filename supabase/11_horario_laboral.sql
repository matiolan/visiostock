-- SCRUM-26 · HU-16 Detectar movimientos fuera del horario laboral.
-- De paso agrega zona_id y foto_evidencia (opcional) a vs_movimientos: el registro automatico
-- por video (HU-07) y el formulario manual comparten vs_registrar_movimiento, y el de video no
-- mandaba evidencia, asi que hacerla obligatoria habria roto ese camino. La foto queda OPCIONAL;
-- el flujo de video sí la manda ahora (ya tenia la imagen del frame, solo no la guardaba).
-- Ejecutar despues de esquema.sql y 06_camaras_zonas.sql (usa vs_zonas).
begin;

alter table public.vs_movimientos add column if not exists foto_evidencia text;
alter table public.vs_movimientos add column if not exists zona_id uuid references public.vs_zonas(id);
alter table public.vs_movimientos add column if not exists fuera_de_horario boolean not null default false;

-- Horario laboral: una fila general por empresa (zona_id null) y, opcionalmente, una por zona
-- que la sobreescribe. dias_semana usa ISO (1=lunes .. 7=domingo).
create table if not exists public.vs_horarios_laborales (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.vs_empresas(id),
  zona_id uuid references public.vs_zonas(id),
  dias_semana smallint[] not null default '{1,2,3,4,5,6}',
  hora_inicio time not null default '07:00',
  hora_fin time not null default '19:00',
  creado_en timestamptz not null default now(),
  check (hora_inicio < hora_fin),
  check (dias_semana <@ array[1,2,3,4,5,6,7]::smallint[]),
  check (cardinality(dias_semana) between 1 and 7)
);
create unique index if not exists vs_horarios_empresa_general on public.vs_horarios_laborales(empresa_id) where zona_id is null;
create unique index if not exists vs_horarios_por_zona on public.vs_horarios_laborales(zona_id) where zona_id is not null;
-- Si zona_id no es null, debe pertenecer a la MISMA empresa (evita que un horario quede
-- apuntando a una zona de otra empresa; con zona_id null esta FK no aplica).
alter table public.vs_horarios_laborales drop constraint if exists vs_horario_zona_empresa;
alter table public.vs_horarios_laborales add constraint vs_horario_zona_empresa
  foreign key (zona_id, empresa_id) references public.vs_zonas(id, empresa_id);
alter table public.vs_horarios_laborales enable row level security;
drop policy if exists leer_horarios on public.vs_horarios_laborales;
create policy leer_horarios on public.vs_horarios_laborales for select to authenticated using (vs_acceso(empresa_id));
drop policy if exists admin_horarios on public.vs_horarios_laborales;
create policy admin_horarios on public.vs_horarios_laborales for all to authenticated using (vs_admin()) with check (vs_admin());
grant select, insert, update, delete on public.vs_horarios_laborales to authenticated;
revoke all on public.vs_horarios_laborales from anon;

create table if not exists public.vs_feriados (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.vs_empresas(id),
  fecha date not null,
  descripcion text not null default '',
  creado_en timestamptz not null default now(),
  unique (empresa_id, fecha)
);
alter table public.vs_feriados enable row level security;
drop policy if exists leer_feriados on public.vs_feriados;
create policy leer_feriados on public.vs_feriados for select to authenticated using (vs_acceso(empresa_id));
drop policy if exists admin_feriados on public.vs_feriados;
create policy admin_feriados on public.vs_feriados for all to authenticated using (vs_admin()) with check (vs_admin());
grant select, insert, update, delete on public.vs_feriados to authenticated;
revoke all on public.vs_feriados from anon;

-- Evalua si un momento (convertido a America/Lima) cae dentro del horario laboral configurado.
-- Simplificacion: no soporta horarios que cruzan medianoche (p.ej. 22:00-06:00); si la empresa
-- no configuro ningun horario, se asume que SIEMPRE esta en horario, para no generar alertas
-- falsas antes de que alguien lo configure.
create or replace function public.vs_en_horario_laboral(empresa uuid, zona uuid, momento timestamptz) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare local timestamp; h public.vs_horarios_laborales;
begin
  if not vs_acceso(empresa) then raise exception 'No autorizado'; end if;
  local := momento at time zone 'America/Lima';
  if exists (select 1 from public.vs_feriados where empresa_id = empresa and fecha = local::date) then
    return false;
  end if;
  if zona is not null then
    select * into h from public.vs_horarios_laborales where zona_id = zona and empresa_id = empresa;
  end if;
  if h.id is null then
    select * into h from public.vs_horarios_laborales where empresa_id = empresa and zona_id is null;
  end if;
  if h.id is null then
    return true;
  end if;
  return extract(isodow from local)::smallint = any(h.dias_semana)
     and local::time between h.hora_inicio and h.hora_fin;
end;
$$;
revoke all on function public.vs_en_horario_laboral(uuid, uuid, timestamptz) from public, anon;
grant execute on function public.vs_en_horario_laboral(uuid, uuid, timestamptz) to authenticated;

drop function if exists public.vs_registrar_movimiento(uuid, text, int);
create or replace function public.vs_registrar_movimiento(p uuid, s text, n int, foto text default null, zona uuid default null) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare producto public.vs_productos; nuevo uuid; fuera boolean;
begin
  select * into producto from public.vs_productos where id = p for update;
  if not found or not vs_acceso(producto.empresa_id) then raise exception 'No autorizado'; end if;
  if n is null or n <= 0 or s is null or s not in ('entrada', 'salida') then raise exception 'Movimiento inválido'; end if;
  if s = 'salida' and producto.stock < n then raise exception 'Stock insuficiente'; end if;
  if foto is not null and (split_part(foto, '/', 1) <> producto.empresa_id::text or split_part(foto, '/', 2) <> auth.uid()::text or not exists (select 1 from storage.objects where bucket_id = 'vs-evidencias' and name = foto)) then
    raise exception 'Evidencia inválida';
  end if;
  if zona is not null and not exists (select 1 from public.vs_zonas z where z.id = zona and z.empresa_id = producto.empresa_id and z.almacen_id = producto.almacen_id) then
    raise exception 'La zona no pertenece al almacén del producto.';
  end if;
  fuera := not public.vs_en_horario_laboral(producto.empresa_id, zona, now());
  update public.vs_productos set stock = stock + case when s = 'entrada' then n else -n end where id = p;
  insert into public.vs_movimientos(empresa_id, producto_id, sentido, cantidad, actor, foto_evidencia, zona_id, fuera_de_horario)
  values (producto.empresa_id, p, s, n, auth.uid(), foto, zona, fuera) returning id into nuevo;
  return nuevo;
end;
$$;
revoke all on function public.vs_registrar_movimiento(uuid, text, int, text, uuid) from public, anon;
grant execute on function public.vs_registrar_movimiento(uuid, text, int, text, uuid) to authenticated;

-- Alertas de horario: una lista para el panel, igual de estilo que las alertas de diferencias de
-- Verificaciones. No hay correo ni push en el proyecto, asi que no se inventa esa parte aqui.
create or replace function public.vs_alertas_horario(empresa uuid, limite int default 100) returns setof public.vs_movimientos
language sql stable security definer set search_path = public as $$
  select * from public.vs_movimientos
  where empresa_id = empresa and fuera_de_horario and vs_acceso(empresa)
  order by creado_en desc
  limit greatest(1, least(limite, 500))
$$;
revoke all on function public.vs_alertas_horario(uuid, int) from public, anon;
grant execute on function public.vs_alertas_horario(uuid, int) to authenticated;

commit;
