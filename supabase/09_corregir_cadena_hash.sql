-- SCRUM-21 · Corrige 3 fallas reales en la cadena de hash de 08_auditoria_inmutable.sql,
-- encontradas en revision de PR:
--   1) Los movimientos insertados ANTES de aplicar 08 quedan con hash NULL, y la verificacion
--      los compara contra "000...0" esperando que coincidan: siempre salen "alterados".
--   2) now() devuelve el MISMO valor para toda una transaccion (no por cada INSERT), asi que
--      varios movimientos seguidos quedan con el mismo creado_en. El desempate por id (un UUID
--      aleatorio) no refleja el orden real de insercion, asi que el orden usado al calcular el
--      hash no coincide con el orden usado al verificar.
--   3) El hash incluia creado_en::text, y ese ::text depende de la zona horaria de la SESION que
--      lo ejecuta (no del dato en si). Calcularlo y verificarlo desde sesiones con zonas
--      distintas da textos distintos y el hash ya no coincide.
-- Ejecutar despues de 08_auditoria_inmutable.sql.
begin;

-- Orden real de insercion: no depende de que dos filas compartan creado_en ni de que el id
-- (un UUID aleatorio) refleje el orden en que se insertaron.
alter table public.vs_movimientos add column if not exists secuencia bigint generated always as identity;

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
  -- extract(epoch from ...) es un numero absoluto, independiente de la zona horaria de quien
  -- ejecuta la sesion (a diferencia del ::text que se usaba antes).
  new.hash_actual := encode(digest(
    new.hash_anterior || new.id::text || new.producto_id::text || new.sentido || new.cantidad::text
      || extract(epoch from new.creado_en)::text,
    'sha256'), 'hex');
  return new;
end;
$$;

create or replace function public.vs_verificar_cadena(empresa uuid) returns table(valido boolean, primer_alterado uuid)
language plpgsql security definer set search_path = public, extensions as $$
declare r record; anterior text := repeat('0', 64); calculado text;
begin
  if not vs_acceso(empresa) then raise exception 'No autorizado'; end if;
  for r in select * from public.vs_movimientos where empresa_id = empresa order by secuencia asc loop
    calculado := encode(digest(
      anterior || r.id::text || r.producto_id::text || r.sentido || r.cantidad::text
        || extract(epoch from r.creado_en)::text,
      'sha256'), 'hex');
    if r.hash_anterior is distinct from anterior or r.hash_actual is distinct from calculado then
      return query select false, r.id;
      return;
    end if;
    anterior := r.hash_actual;
  end loop;
  return query select true, null::uuid;
end;
$$;

-- Vuelve a encadenar, en el orden real de insercion (secuencia), todos los movimientos que ya
-- existen hoy -- incluidos los que quedaron sin hash por haberse insertado antes de 08. Segura
-- de correr mas de una vez: siempre recalcula igual, en el mismo orden. El propio trigger de
-- bloqueo impediria estos UPDATE, asi que se desactiva mientras dura el sellado.
alter table public.vs_movimientos disable trigger vs_movimientos_bloquear_update;
do $$
declare empresa_rec record; mov_rec record; anterior text; nuevo_hash text;
begin
  for empresa_rec in select distinct empresa_id from public.vs_movimientos loop
    anterior := repeat('0', 64);
    for mov_rec in select * from public.vs_movimientos where empresa_id = empresa_rec.empresa_id order by secuencia asc loop
      nuevo_hash := encode(digest(
        anterior || mov_rec.id::text || mov_rec.producto_id::text || mov_rec.sentido || mov_rec.cantidad::text
          || extract(epoch from mov_rec.creado_en)::text,
        'sha256'), 'hex');
      update public.vs_movimientos set hash_anterior = anterior, hash_actual = nuevo_hash where id = mov_rec.id;
      anterior := nuevo_hash;
    end loop;
  end loop;
end $$;
alter table public.vs_movimientos enable trigger vs_movimientos_bloquear_update;

commit;
