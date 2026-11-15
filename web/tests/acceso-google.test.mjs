// SCRUM-75: registro e inicio de sesión con Google.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {destinoGoogle, errorDeRetorno, mensajeSinEmpresa} from '../src/lib/acceso-google.ts';

test('Google solo devuelve al usuario a nuestro propio origen', () => {
 assert.equal(destinoGoogle('https://visiostock.vercel.app'), 'https://visiostock.vercel.app/acceso');
 assert.equal(destinoGoogle('https://visiostock.vercel.app/portal?x=1'), 'https://visiostock.vercel.app/acceso');
 assert.equal(destinoGoogle('http://localhost:5173'), 'http://localhost:5173/acceso');
 assert.equal(destinoGoogle('http://127.0.0.1:5173'), 'http://127.0.0.1:5173/acceso');
 // Sin HTTPS fuera de desarrollo local, ni credenciales embebidas, ni esquemas raros.
 for (const malo of ['http://visiostock.vercel.app', 'https://user:pass@visiostock.vercel.app', 'javascript:alert(1)', 'file:///etc/passwd']) {
  assert.throws(() => destinoGoogle(malo), /no permitido/, malo);
 }
});

test('errores de retorno de Google se muestran sin detalles internos', () => {
 assert.equal(errorDeRetorno('https://visiostock.vercel.app/acceso'), null);
 assert.equal(errorDeRetorno('https://visiostock.vercel.app/acceso#access_token=abc&type=bearer'), null);
 assert.match(errorDeRetorno('https://visiostock.vercel.app/acceso?error=access_denied&error_description=The+user+denied'), /Cancelaste/);
 assert.match(errorDeRetorno('https://visiostock.vercel.app/acceso#error=access_denied&error_code=signup_disabled&error_description=Signups+not+allowed+for+this+instance'), /registro con Google todavía no está habilitado/);
 const generico = errorDeRetorno('https://visiostock.vercel.app/acceso#error=server_error&error_description=<script>alert(1)</script>');
 assert.equal(generico, 'No pudimos iniciar sesión con Google. Inténtalo de nuevo.');
});

test('una cuenta nueva sin empresa recibe instrucciones y no datos', () => {
 assert.match(mensajeSinEmpresa('ana@gmail.com'), /\(ana@gmail\.com\) ya está creada/);
 assert.match(mensajeSinEmpresa(undefined), /^Tu cuenta ya está creada/);
 assert.match(mensajeSinEmpresa('x@y.z'), /no verás ningún dato/);
});
