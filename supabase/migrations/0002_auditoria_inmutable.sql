-- VisioStock · HU-11 registro de auditoría inmodificable (SCRUM-21)

-- Bitácora de intentos de modificar o borrar un movimiento ya registrado
create table if not exists intentos_bloqueados (
  id uuid primary key default gen_random_uuid(),
  movimiento_id uuid,
  operacion text not null check (operacion in ('update', 'delete')),
  usuario text,
  intentado_en timestamptz not null default now()
);

alter table intentos_bloqueados enable row level security;

drop policy if exists "intentos_bloqueados_select_anon" on intentos_bloqueados;
create policy "intentos_bloqueados_select_anon"
  on intentos_bloqueados for select
  to anon
  using (true);

-- Trigger: registra el intento en la bitácora y rechaza la operación
create or replace function bloquear_modificacion_movimiento()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into intentos_bloqueados (movimiento_id, operacion, usuario)
  values (old.id, lower(tg_op), current_user);

  raise exception 'Los movimientos son append-only: no se pueden modificar ni eliminar (id=%)', old.id;
end;
$$;

drop trigger if exists movimientos_bloquear_update on movimientos;
create trigger movimientos_bloquear_update
  before update on movimientos
  for each row execute function bloquear_modificacion_movimiento();

drop trigger if exists movimientos_bloquear_delete on movimientos;
create trigger movimientos_bloquear_delete
  before delete on movimientos
  for each row execute function bloquear_modificacion_movimiento();

-- Ajustes trazables: corrige el inventario sin alterar el movimiento original
create table if not exists ajustes_inventario (
  id uuid primary key default gen_random_uuid(),
  movimiento_original_id uuid references movimientos(id),
  usuario text not null,
  motivo text not null,
  cantidad_ajuste int not null,
  creado_en timestamptz not null default now()
);

alter table ajustes_inventario enable row level security;

drop policy if exists "ajustes_inventario_select_anon" on ajustes_inventario;
create policy "ajustes_inventario_select_anon"
  on ajustes_inventario for select
  to anon
  using (true);
