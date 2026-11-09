-- SCRUM-71 · Prueba de exactitud del reporte semanal en la base (escenario 3 de HU-14).
-- Usa los MISMOS datos y totales esperados que web/tests/reporte-semanal.test.mjs, para demostrar
-- que el job de Supabase y la vista web calculan lo mismo. Ejecutar como postgres después de
-- 04_reporte_semanal.sql. Toda la prueba revierte: no deja datos.
begin;
insert into auth.users(id,email) values ('00000000-0000-0000-0000-0000000000a1','reporte@example.test');
insert into public.vs_empresas(id,nombre) values ('20000000-0000-0000-0000-000000000001','Prueba reporte');
insert into public.vs_almacenes(id,empresa_id,nombre) values ('21000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','Central');
insert into public.vs_productos(id,empresa_id,almacen_id,sku,nombre,stock)
select ('22000000-0000-0000-0000-00000000000'||i)::uuid,'20000000-0000-0000-0000-000000000001','21000000-0000-0000-0000-000000000001',s,'Caja '||left(s,1),50
from (values (1,'A-1'),(2,'B-2'),(3,'C-3'),(4,'D-4'),(5,'E-5'),(6,'F-6')) t(i,s);

-- Semana evaluada: lunes 02/11/2026 00:00 Lima (= 05:00 UTC) a lunes 09/11/2026 00:00 Lima.
insert into public.vs_movimientos(empresa_id,producto_id,sentido,cantidad,creado_en,actor)
select '20000000-0000-0000-0000-000000000001',('22000000-0000-0000-0000-00000000000'||p)::uuid,s,c,t::timestamptz,'00000000-0000-0000-0000-0000000000a1'
from (values (1,'entrada',10,'2026-11-02T05:00:00Z'),(1,'salida',4,'2026-11-03T14:00:00Z'),(2,'entrada',6,'2026-11-08T23:00:00Z'),
             (2,'salida',5,'2026-11-09T04:59:59Z'),(2,'salida',99,'2026-11-09T05:00:00Z'),
             (1,'entrada',3,'2026-11-02T04:59:59Z'),(1,'salida',2,'2026-10-28T15:00:00Z')) d(p,s,c,t);

insert into public.vs_verificaciones(empresa_id,producto_id,stock_registrado,conteo,metodo,evidencia,actor,creado_en)
select '20000000-0000-0000-0000-000000000001',('22000000-0000-0000-0000-00000000000'||p)::uuid,20,20+d,'manual','prueba/evidencia.jpg','00000000-0000-0000-0000-0000000000a1',t::timestamptz
from (values (1,-3,'2026-11-03T15:00:00Z'),(1,-1,'2026-11-05T15:00:00Z'),(2,-7,'2026-11-04T15:00:00Z'),(3,2,'2026-11-04T16:00:00Z'),
             (4,0,'2026-11-04T17:00:00Z'),(5,-2,'2026-11-06T15:00:00Z'),(6,-1,'2026-11-06T16:00:00Z'),(3,-5,'2026-11-07T15:00:00Z'),
             (4,-1,'2026-11-07T16:00:00Z'),(1,-2,'2026-10-29T15:00:00Z')) v(p,d,t);

select public.vs_generar_reporte_semanal('2026-11-02');

do $$
declare r jsonb; c jsonb;
begin
 if public.vs_lunes_semana_anterior('2026-11-09T13:00:00Z') <> '2026-11-02' then raise exception 'Lunes de la última semana completa incorrecto'; end if;
 select datos into r from public.vs_reportes_semanales where empresa_id='20000000-0000-0000-0000-000000000001' and semana_inicio='2026-11-02';
 if r->'actual' <> '{"entradas":16,"salidas":9,"movimientos":4,"verificaciones":9,"conDiferencia":8,"unidadesFaltantes":20,"unidadesSobrantes":2}'::jsonb
   then raise exception 'Totales de la semana no coinciden: %', r->'actual'; end if;
 if (r->'anterior'->>'entradas')::int <> 3 or (r->'anterior'->>'salidas')::int <> 2 or (r->'anterior'->>'unidadesFaltantes')::int <> 2
   then raise exception 'Semana anterior no coincide: %', r->'anterior'; end if;
 if (select jsonb_agg(jsonb_build_array(x->>'sku',(x->>'faltante')::int)) from jsonb_array_elements(r->'topMermas') x)
    <> '[["B-2",7],["C-3",5],["A-1",4],["E-5",2],["D-4",1]]'::jsonb then raise exception 'Top 5 no coincide: %', r->'topMermas'; end if;
 select x into c from jsonb_array_elements(r->'porSku') x where x->>'sku'='C-3';
 if (c->>'faltante')::int<>5 or (c->>'sobrante')::int<>2 or (c->>'neto')::int<>-3 or (c->>'conDiferencia')::int<>2 then raise exception 'C-3 no coincide: %', c; end if;
 raise notice 'Reporte semanal OK: mismos totales que la prueba web';
end $$;
rollback;
