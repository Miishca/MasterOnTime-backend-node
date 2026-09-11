// Обране (Фаза 6). node scripts/smoke-favorites.js
require('dotenv/config');
const { PrismaClient } = require('C:/Projects/MasterOnTime-backend-node/node_modules/@prisma/client');
const BASE = 'http://localhost:8080';

async function call(method, path, body, token) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const t = await res.text();
  let d; try { d = JSON.parse(t); } catch { d = t; }
  return { status: res.status, data: d };
}
function assert(c, m) { console.log(c ? `  PASS  ${m}` : `  FAIL  ${m}`); if (!c) process.exitCode = 1; }

async function reg(email, fn, ln) {
  return (await call('POST', '/auth/registration', {
    email, password: 'pass123', repeatPassword: 'pass123', firstName: fn, lastName: ln,
    address: { country: 'UA', city: 'Kyiv', street: 'S1', zip: '01001' },
  })).data;
}
const login = async (email, pw = 'pass123') => (await call('POST', '/auth/login', { email, password: pw })).data.token;

(async () => {
  const p = new PrismaClient();
  const s = Date.now();
  const client = await reg(`fc${s}@t.dev`, 'Fav', 'Client');
  const spec = await reg(`fs${s}@t.dev`, 'Fav', 'Spec');
  const hidden = await reg(`fh${s}@t.dev`, 'Hid', 'Spec');
  await p.user.update({ where: { id: spec.id }, data: { role: 'SPECIALIST' } });
  await p.specialistProfile.create({ data: { userId: spec.id, price: 20 } });
  await p.user.update({ where: { id: hidden.id }, data: { role: 'SPECIALIST', visible: false } });
  await p.specialistProfile.create({ data: { userId: hidden.id, price: 20 } });
  const cliTok = await login(`fc${s}@t.dev`);
  const specTok = await login(`fs${s}@t.dev`);

  console.log('1) auth gate + SPECIALIST cannot use favorites (USER-only)');
  assert((await call('GET', '/api/favorites')).status === 401, 'guest 401');
  assert((await call('GET', '/api/favorites', null, specTok)).status === 403, 'SPECIALIST 403');

  console.log('2) add a favorite');
  let r = await call('POST', `/api/favorites/${spec.id}`, {}, cliTok);
  assert(r.status === 204, `204 (got ${r.status})`);
  r = await call('GET', '/api/favorites', null, cliTok);
  assert(r.data.some((x) => x.id === spec.id), 'shows up in list');
  r = await call('GET', '/api/favorites/ids', null, cliTok);
  assert(r.data.includes(spec.id), 'shows up in ids');

  console.log('3) adding again is idempotent, not an error');
  assert((await call('POST', `/api/favorites/${spec.id}`, {}, cliTok)).status === 204, '204 again');
  const count = await p.favorite.count({ where: { userId: client.id, specialistUserId: spec.id } });
  assert(count === 1, `still exactly one row (got ${count})`);

  console.log('4) cannot favorite yourself / a hidden specialist / a non-specialist');
  assert((await call('POST', `/api/favorites/${client.id}`, {}, cliTok)).status === 400, 'self -> 400');
  assert((await call('POST', `/api/favorites/${hidden.id}`, {}, cliTok)).status === 404, 'hidden -> 404');
  assert((await call('POST', '/api/favorites/99999999', {}, cliTok)).status === 404, 'missing -> 404');

  console.log('5) remove a favorite');
  r = await call('DELETE', `/api/favorites/${spec.id}`, null, cliTok);
  assert(r.status === 204, `204 (got ${r.status})`);
  r = await call('GET', '/api/favorites', null, cliTok);
  assert(!r.data.some((x) => x.id === spec.id), 'gone from list');

  console.log('6) removing a favorite that was never added -> still 204 (idempotent delete)');
  assert((await call('DELETE', `/api/favorites/${spec.id}`, null, cliTok)).status === 204, '204');

  // прибирання
  await p.refreshToken.deleteMany({ where: { userId: { in: [client.id, spec.id, hidden.id] } } });
  await p.favorite.deleteMany({ where: { userId: client.id } });
  await p.specialistProfile.deleteMany({ where: { userId: { in: [spec.id, hidden.id] } } });
  await p.user.deleteMany({ where: { email: { in: [`fc${s}@t.dev`, `fs${s}@t.dev`, `fh${s}@t.dev`] } } });
  await p.$disconnect();

  console.log(process.exitCode ? '\nSOME CHECKS FAILED' : '\nALL CHECKS PASSED');
})();
