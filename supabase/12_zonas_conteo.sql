-- Conteo en vivo: cada cámara guarda sus dos zonas (A afuera, B almacén) en fracciones del cuadro:
-- [[x1,y1,x2,y2],[x1,y1,x2,y2]]. Ejecutar después de 06_camaras_zonas.sql. No borra datos.
-- Las políticas de vs_camaras ya limitan la lectura y la edición a la empresa de la cámara.
begin;
alter table public.vs_camaras add column if not exists zonas_conteo jsonb;
alter table public.vs_camaras drop constraint if exists vs_camaras_zonas_conteo;
alter table public.vs_camaras add constraint vs_camaras_zonas_conteo check(
 zonas_conteo is null or (case when jsonb_typeof(zonas_conteo)='array' then jsonb_array_length(zonas_conteo)=2 and length(zonas_conteo::text)<=400 else false end)
);
grant update(zonas_conteo) on public.vs_camaras to authenticated;
commit;
