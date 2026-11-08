import {test} from 'node:test';
import assert from 'node:assert/strict';
import {skuDesdeCodigo as sku,productosPorCodigo as buscar,clasificarMovimientos as clasificar} from '../src/lib/sku.ts';
const productos=[{id:'1',sku:'CAJA-001',almacen_id:'a'},{id:'2',sku:'7751234567892',almacen_id:'a'},{id:'3',sku:'caja-001',almacen_id:'b'},{id:'4',sku:'LALI-TOM',almacen_id:'a'}];
test('el código puede ser el SKU directo',()=>assert.equal(sku('  CAJA-001 \n'),'CAJA-001'));
test('lee el SKU de un texto con prefijo',()=>{assert.equal(sku('SKU:LALI-TOM'),'LALI-TOM');assert.equal(sku('lote 7; sku = LALI-TOM'),'LALI-TOM');});
test('lee el SKU de un enlace',()=>assert.equal(sku('https://visiostock-mia.vercel.app/p?empresa=1&sku=LALI%20TOM'),'LALI TOM'));
test('no se confunde con palabras que contienen sku',()=>assert.equal(sku('BASKU-9'),'BASKU-9'));
test('busca sin distinguir mayúsculas',()=>assert.deepEqual(buscar(productos,['caja-001']).map(p=>p.id),['1','3']));
test('identifica por código de barras EAN',()=>assert.deepEqual(buscar(productos,['7751234567892']).map(p=>p.id),['2']));
test('varios códigos en la foto',()=>assert.deepEqual(buscar(productos,['SKU:LALI-TOM','otro']).map(p=>p.id),['4']));
test('sin coincidencias devuelve vacío',()=>{assert.deepEqual(buscar(productos,['NO-EXISTE']),[]);assert.deepEqual(buscar(productos,['  ']),[]);});
test('clasifica los movimientos del video por almacén',()=>{
 const r=clasificar([{sentido:'entrada',segundo:1,codigo:'SKU:CAJA-001',tipo:'QR',imagen:'a'},{sentido:'salida',segundo:2,codigo:null,tipo:null,imagen:'b'},{sentido:'entrada',segundo:3,codigo:'LALI-TOM',tipo:'Code128',imagen:'c'}],productos,'b');
 assert.deepEqual(r.map(m=>[m.producto?.id??null,m.motivo]),[['3',''],[null,'NO IDENTIFICADO'],[null,'Código sin producto en este almacén']]);
});
