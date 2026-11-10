-- SCRUM-21 · Corrige 3 fallas reales en la cadena de hash de 08_auditoria_inmutable.sql, mas 2
-- huecos encontrados en una segunda revision del PR:
--   1) Los movimientos insertados ANTES de aplicar 08 quedan con hash NULL, y la verificacion
--      los compara contra "000...0" esperando que coincidan: siempre salen "alterados".
--   2) now() devuelve el MISMO valor para toda una transaccion (no por cada INSERT), asi que
--      varios movimientos seguidos quedan con el mismo creado_en. El desempate por id (un UUID
--      aleatorio) no refleja el orden real de insercion, asi que el orden usado al calcular el
--      hash no coincide con el orden usado al verificar.
--   3) El hash incluia creado_en::text, y ese ::text depende de la zona horaria de la SESION que
--      lo ejecuta (no del dato en si). Calcularlo y verificarlo desde sesiones con zonas
--      distintas da textos distintos y el hash ya no coincide.
--   4) Volver a correr este script re-sellaba TODA la cadena otra vez, lo que borraba la
--      evidencia de una alteracion hecha entre dos corridas. Se agrega hash_version: el
--      sellado solo toca empresas que todavia no esten en la version actual, asi que una
--      alteracion posterior al primer sellado sigue siendo detectable aunque el script se
--      vuelva a correr.
--   5) El hash no incluia empresa_id ni actor: cambiar de empresa o de autor a un movimiento no
--      se detectaba. Ambos se agregan a la formula.
-- La formula del hash vive en una sola funcion (vs_hash_movimiento) para que el trigger, la
-- verificacion, el sellado y la prueba usen siempre la misma, sin copiarla a mano en cada lugar.
-- Ejecutar despues de 08_auditoria_inmutable.sql.
begin;

-- Orden real de insercion: no depende de que dos filas compartan creado_en ni de que el id
-- (un UUID aleatorio) refleje el orden en que se insertaron.
alter table public.vs_movimientos add column if not exists secuencia bigint generated always as identity;
-- Version de la formula con la que quedo sellada cada fila. Permite sellar una sola vez: volver
-- a correr este script no re-sella lo que ya esta en la version actual (no puede ocultar una
-- alteracion hecha despues del primer sellado).
alter table public.vs_movimientos add column if not exists hash_version smallint;

create or replace function public.vs_hash_movimiento(anterior text, mov public.vs_movimientos) returns text
language sql immutable set search_path = public, extensions as $$
  select encode(digest(
    anterior || mov.id::text || mov.empresa_id::text || mov.producto_id::text || mov.sentido || mov.cantidad::text
      || coalesce(mov.actor::text, '') || extract(epoch from mov.creado_en)::text,
    'sha256'), 'hex')
$$;
revoke all on function public.vs_hash_movimiento(text, public.vs_movimientos) from public, anon, authenticated;

create or replace function public.vs_encadenar_movimiento() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare anterior text;
begin
  -- Serializa los inserts de la MISMA empresa: sin este lock, dos inserts concurrentes podrian
  -- leer el mismo "ultimo hash" antes de que el otro confirme, rompiendo la cadena. El lock se
  -- libera solo al terminar la transaccion (pg_advisory_xact_lock).
  perform pg_advisory_xact_lock(hashtext(new.empresa_id::text));
  select hash_actual into anterior from public.vs_movimientos
    where empresa_id = new.empresa_id
    order by secuencia desc
    limit 1;
  new.hash_anterior := coalesce(anterior, repeat('0', 64));
  new.hash_actual := public.vs_hash_movimiento(new.hash_anterior, new);
  new.hash_version := 2;
  return new;
end;
$$;

create or replace function public.vs_verificar_cadena(empresa uuid) returns table(valido boolean, primer_alterado uuid)
language plpgsql security definer set search_path = public, extensions as $$
declare r public.vs_movimientos; anterior text := repeat('0', 64);
begin
  if not vs_acceso(empresa) then raise exception 'No autorizado'; end if;
  for r in select * from public.vs_movimientos where empresa_id = empresa order by secuencia asc loop
    if r.hash_anterior is distinct from anterior or r.hash_actual is distinct from public.vs_hash_movimiento(anterior, r) then
      return query select false, r.id;
      return;
    end if;
    anterior := r.hash_actual;
  end loop;
  return query select true, null::uuid;
end;
$$;

-- Vuelve a encadenar, en el orden real de insercion (secuencia), los movimientos de cada
-- empresa que todavia NO este sellada con la version actual (2). Si una empresa ya quedo
-- sellada, no se toca: asi una alteracion hecha despues del sellado sigue siendo detectable,
-- incluso si este script se vuelve a correr. El propio trigger de bloqueo impediria estos
-- UPDATE, asi que se desactiva mientras dura el sellado.
alter table public.vs_movimientos disable trigger vs_movimientos_bloquear_update;
do $$
declare empresa_rec record; mov_rec public.vs_movimientos; anterior text; nuevo_hash text;
begin
  for empresa_rec in select distinct empresa_id from public.vs_movimientos where hash_version is distinct from 2 loop
    anterior := repeat('0', 64);
    for mov_rec in select * from public.vs_movimientos where empresa_id = empresa_rec.empresa_id order by secuencia asc loop
      nuevo_hash := public.vs_hash_movimiento(anterior, mov_rec);
      update public.vs_movimientos set hash_anterior = anterior, hash_actual = nuevo_hash, hash_version = 2 where id = mov_rec.id;
      anterior := nuevo_hash;
    end loop;
  end loop;
end $$;
alter table public.vs_movimientos enable trigger vs_movimientos_bloquear_update;

commit;
