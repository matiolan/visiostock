import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
const rules = config.headers.filter((rule) => rule.source === '/(.*)');
assert.equal(rules.length, 1, 'Debe existir una regla global de cabeceras');

const headers = new Map();
for (const { key, value } of rules[0].headers) {
  const name = key.toLowerCase();
  assert(!headers.has(name), `Cabecera duplicada: ${name}`);
  headers.set(name, value);
}

test('la web envía las cuatro cabeceras de seguridad', () => {
  assert.equal(headers.get('x-frame-options'), 'DENY');
  assert.equal(headers.get('x-content-type-options'), 'nosniff');
  assert.equal(headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
  assert(headers.has('content-security-policy'), 'La CSP debe aplicarse en modo obligatorio');
});

const directives = new Map();
for (const directive of (headers.get('content-security-policy') ?? '').split(';')) {
  const [name, ...sources] = directive.trim().split(/\s+/);
  if (!name) continue;
  assert(!directives.has(name), `Directiva CSP duplicada: ${name}`);
  directives.set(name, sources);
}

test('la CSP limita scripts y bloquea marcos, plugins y cambios de base', () => {
  assert.deepEqual(directives.get('default-src'), ["'self'"]);
  assert.deepEqual(directives.get('script-src'), ["'self'"]);
  for (const name of ['frame-ancestors', 'frame-src', 'object-src', 'base-uri']) {
    assert.deepEqual(directives.get(name), ["'none'"], name);
  }
  for (const name of ['script-src-elem', 'script-src-attr']) {
    if (directives.has(name)) {
      assert.deepEqual(directives.get(name), ["'none'"], name);
    }
  }
});

test('connect-src admite orígenes exactos y valida el servicio de visión si está configurado', () => {
  const sources = directives.get('connect-src') ?? [];
  const requiredSupabaseOrigin = new URL('https://bkedmoshqaulckhvnclx.supabase.co').origin;
  assert(sources.includes("'self'"));
  assert(
    sources
      .filter((source) => source !== "'self'")
      .some((source) => {
        const url = new URL(source);
        return url.origin === requiredSupabaseOrigin;
      })
  );
  for (const source of sources.filter((value) => value !== "'self'")) {
    const url = new URL(source);
    assert(['https:', 'wss:'].includes(url.protocol), `Origen sin TLS: ${source}`);
    assert(!source.includes('*') && source === url.origin, `Origen CSP no exacto: ${source}`);
  }
  const visionUrl = process.env.VITE_VISION_URL?.trim();
  if (visionUrl) {
    const url = new URL(visionUrl);
    assert.equal(url.protocol, 'https:', 'Visión debe publicarse por HTTPS');
    assert(!url.username && !url.password, 'La URL de visión debe ser pública');
    assert(sources.some((source) => source === url.origin), 'Falta el origen de VITE_VISION_URL en connect-src');
  }
});
