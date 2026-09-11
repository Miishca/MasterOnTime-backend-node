// Портфоліо спеціаліста (Фаза 6). node scripts/smoke-portfolio.js
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
const TINY_PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

(async () => {
  const p = new PrismaClient();
  const s = Date.now();
  const spec = await reg(`ps${s}@t.dev`, 'Port', 'Spec');
  const other = await reg(`po${s}@t.dev`, 'Port', 'Other');
  const client = await reg(`pc${s}@t.dev`, 'Port', 'Client');
  await p.user.update({ where: { id: spec.id }, data: { role: 'SPECIALIST' } });
  await p.specialistProfile.create({ data: { userId: spec.id, price: 25 } });
  await p.user.update({ where: { id: other.id }, data: { role: 'SPECIALIST' } });
  await p.specialistProfile.create({ data: { userId: other.id, price: 25 } });
  const specTok = await login(`ps${s}@t.dev`);
  const otherTok = await login(`po${s}@t.dev`); // token's role claim baked in AFTER promotion above
  const cliTok = await login(`pc${s}@t.dev`);

  console.log('1) auth gate — SPECIALIST-only');
  assert((await call('GET', '/api/specialist/portfolio')).status === 401, 'guest 401');
  assert((await call('GET', '/api/specialist/portfolio', null, cliTok)).status === 403, 'USER 403');

  console.log('2) add an item');
  let r = await call('POST', '/api/specialist/portfolio', { imageBase64: TINY_PNG_B64, caption: 'Before/after' }, specTok);
  assert(r.status === 201 && r.data.caption === 'Before/after' && r.data.imageUrl.startsWith('data:image/'), `201 (got ${r.status})`);
  const itemId = r.data.id;

  console.log('3) list — own (specialist) and public both see it');
  r = await call('GET', '/api/specialist/portfolio', null, specTok);
  assert(r.data.some((x) => x.id === itemId), 'own list has it');
  r = await call('GET', `/api/specialists/${spec.id}/portfolio`);
  assert(r.status === 200 && r.data.some((x) => x.id === itemId), 'public (no token) has it');

  console.log('4) ownership — another specialist cannot delete it');
  assert((await call('DELETE', `/api/specialist/portfolio/${itemId}`, null, otherTok)).status === 404, '404 for a non-owner');

  console.log('5) validation — caption too long, unknown field');
  assert((await call('POST', '/api/specialist/portfolio', { imageBase64: TINY_PNG_B64, caption: 'x'.repeat(300) }, specTok)).status === 400, 'caption too long -> 400');
  assert((await call('POST', '/api/specialist/portfolio', { imageBase64: TINY_PNG_B64, extra: 1 }, specTok)).status === 400, 'unknown field -> 400 (strict)');

  console.log('6) delete it (owner)');
  r = await call('DELETE', `/api/specialist/portfolio/${itemId}`, null, specTok);
  assert(r.status === 204, `204 (got ${r.status})`);
  r = await call('GET', '/api/specialist/portfolio', null, specTok);
  assert(!r.data.some((x) => x.id === itemId), 'gone');

  console.log('7) 20-item cap');
  await p.portfolioItem.createMany({
    data: Array.from({ length: 20 }, (_, i) => ({
      specialistUserId: spec.id, imageUrl: 'data:image/png;base64,x', caption: `item ${i}`,
    })),
  });
  r = await call('POST', '/api/specialist/portfolio', { imageBase64: TINY_PNG_B64 }, specTok);
  assert(r.status === 400, `21st item -> 400 (got ${r.status})`);

  console.log('8) public portfolio for a non-specialist / missing id -> 404');
  assert((await call('GET', `/api/specialists/${client.id}/portfolio`)).status === 404, 'non-specialist -> 404');
  assert((await call('GET', '/api/specialists/99999999/portfolio')).status === 404, 'missing -> 404');

  // прибирання
  await p.refreshToken.deleteMany({ where: { user: { email: { in: [`ps${s}@t.dev`, `po${s}@t.dev`, `pc${s}@t.dev`] } } } });
  await p.portfolioItem.deleteMany({ where: { specialistUserId: { in: [spec.id, other.id] } } });
  await p.specialistProfile.deleteMany({ where: { userId: { in: [spec.id, other.id] } } });
  await p.user.deleteMany({ where: { email: { in: [`ps${s}@t.dev`, `po${s}@t.dev`, `pc${s}@t.dev`] } } });
  await p.$disconnect();

  console.log(process.exitCode ? '\nSOME CHECKS FAILED' : '\nALL CHECKS PASSED');
})();
