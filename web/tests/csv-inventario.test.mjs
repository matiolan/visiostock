import {test} from 'node:test';
import assert from 'node:assert/strict';
import {leerInventarioCSV as leer} from '../src/lib/csv-inventario.ts';
const header='sku,nombre,stock_inicial\n';
test('lee el formato de Lali y prioriza stock_inicial',()=>{
 const r=leer('sku,nombre,zona,stock_registrado,stock_inicial\nLALI-001,Tomatodo,A,0,60');
 assert.equal(r.errores.length,0);assert.deepEqual(r.filas,[{sku:'LALI-001',nombre:'Tomatodo',stock:60}]);
});
test('lee BOM, punto y coma y el formato de exportación',()=>{
 assert.deepEqual(leer('\uFEFFSKU;Producto;Stock\r\nA;Caja;0').filas,[{sku:'A',nombre:'Caja',stock:0}]);
});
test('conserva comas, comillas escapadas y saltos de línea',()=>{
 assert.equal(leer(header+'A,"Set, ""Lali""\nnuevo",2').filas[0].nombre,'Set, "Lali"\nnuevo');
});
for(const [nombre,csv] of Object.entries({vacio:'',columnas:'sku,nombre\nA,B',duplicados:header+'A,B,1\nA,C,2',negativo:header+'A,B,-1',decimal:header+'A,B,1.5',stockVacio:header+'A,B,',limite:header+'A,B,2147483648',comillas:header+'A,"B,1',ancho:header+'A,B,1,2',encabezados:'sku,nombre,stock,stock\nA,B,1,1',mas500:header+Array.from({length:501},(_,i)=>`${i},B,1`).join('\n')}))test('rechaza '+nombre,()=>assert.ok(leer(csv).errores.length));
