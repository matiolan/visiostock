-- VisioStock · HU-09 evidencia fotográfica y zona en movimientos. Ejecutar después de esquema.sql y 02_verificaciones.sql.
begin;
alter table public.vs_movimientos add column if not exists foto_evidencia text;
alter table public.vs_movimientos add column if not exists zona text not null default 'A';

drop function if exists public.vs_registrar_movimiento(uuid,text,int);
create or replace function public.vs_registrar_movimiento(p uuid,s text,n int,foto text,zona text default 'A') returns uuid
language plpgsql security definer set search_path=public as $$
declare producto public.vs_productos; nuevo uuid;
begin
 select * into producto from public.vs_productos where id=p for update;
 if not found or not public.vs_acceso(producto.empresa_id) then raise exception 'No autorizado'; end if;
 if n is null or n<=0 or s is null or s not in ('entrada','salida') then raise exception 'Movimiento inválido'; end if;
 if foto is null or split_part(foto,'/',1)<>producto.empresa_id::text or split_part(foto,'/',2)<>auth.uid()::text or not exists(select 1 from storage.objects where bucket_id='vs-evidencias' and name=foto) then raise exception 'Evidencia inválida'; end if;
 if s='salida' and producto.stock<n then raise exception 'Stock insuficiente'; end if;
 update public.vs_productos set stock=stock+case when s='entrada' then n else -n end where id=p;
 insert into public.vs_movimientos(empresa_id,producto_id,sentido,cantidad,actor,foto_evidencia,zona) values(producto.empresa_id,p,s,n,auth.uid(),foto,coalesce(zona,'A')) returning id into nuevo;
 return nuevo;
end $$;
revoke all on function public.vs_registrar_movimiento(uuid,text,int,text,text) from public, anon;
grant execute on function public.vs_registrar_movimiento(uuid,text,int,text,text) to authenticated;

-- La evidencia de un movimiento también impide que su archivo se borre del bucket.
drop policy if exists vs_foto_limpiar on storage.objects;
create policy vs_foto_limpiar on storage.objects for delete to authenticated using(
  bucket_id='vs-evidencias' and split_part(name,'/',2)=auth.uid()::text and public.vs_ruta_evidencia(name)
  and not exists(select 1 from public.vs_verificaciones v where v.evidencia=name)
  and not exists(select 1 from public.vs_movimientos m where m.foto_evidencia=name)
);
commit;
