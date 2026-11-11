// SCRUM-74: lógica del doble factor TOTP.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {requiereCodigo, normalizarCodigo, factorActivo, factoresPendientes, nombreFactor, mensajeError} from '../src/lib/doble-factor.ts';

test('pide el código solo si la cuenta tiene factor y la sesión es AAL1', () => {
 assert.equal(requiereCodigo({currentLevel: 'aal1', nextLevel: 'aal2'}), true);
 assert.equal(requiereCodigo({currentLevel: 'aal1', nextLevel: 'aal1'}), false); // sin doble factor
 assert.equal(requiereCodigo({currentLevel: 'aal2', nextLevel: 'aal2'}), false); // ya ingresó el código
 assert.equal(requiereCodigo({currentLevel: null, nextLevel: null}), false);     // sin sesión
});

test('el código debe tener exactamente 6 dígitos', () => {
 assert.equal(normalizarCodigo('123456'), '123456');
 assert.equal(normalizarCodigo(' 123 456 '), '123456');
 assert.equal(normalizarCodigo('123-456'), '123456');
 for (const malo of ['', '12345', '1234567', 'abcdef', '12345a', '<script>']) assert.equal(normalizarCodigo(malo), null);
});

test('solo un factor TOTP verificado cuenta como activo', () => {
 const f = [
  {id: '1', factor_type: 'totp', status: 'unverified'},
  {id: '2', factor_type: 'phone', status: 'verified'},
  {id: '3', factor_type: 'totp', status: 'verified'},
 ];
 assert.equal(factorActivo(f)?.id, '3');
 assert.equal(factorActivo(f.slice(0, 2)), null);
 assert.deepEqual(factoresPendientes(f).map(x => x.id), ['1']);
});

test('nombre del factor único y legible', () => {
 assert.equal(nombreFactor(new Date('2026-11-10T17:05:09Z')), 'VisioStock 2026-11-10 17:05');
});

test('los errores no exponen detalles internos', () => {
 assert.match(mensajeError({code: 'mfa_verification_failed', message: 'Invalid TOTP code entered'}), /código no es correcto/);
 assert.match(mensajeError({code: 'insufficient_aal', message: 'AAL2 required'}), /primero ingresa tu código/);
 assert.match(mensajeError({message: 'Too many requests'}), /Demasiados intentos/);
 assert.equal(mensajeError({message: 'relation "auth.mfa_factors" ...'}), 'No se pudo completar la operación. Inténtalo de nuevo.');
});
