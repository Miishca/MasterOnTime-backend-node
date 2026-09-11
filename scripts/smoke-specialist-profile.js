// Self-service профіль спеціаліста + admin edit.
// node scripts/smoke-specialist-profile.js   (сервер на :8080, ADMIN_* у .env)
require('dotenv/config');
const { PrismaClient } = require('C:/Projects/MasterOnTime-backend-node/node_modules/@prisma/client');
const { execSync } = require('child_process');
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

async function reg(email) {
  return (await call('POST', '/auth/registration', {
    email, password: 'pass123', repeatPassword: 'pass123', firstName: 'Sp', lastName: 'Ec',
    address: { country: 'UA', city: 'Kyiv', street: 'S1', zip: '01001' },
  })).data;
}
const login = async (email, pw = 'pass123') => (await call('POST', '/auth/login', { email, password: pw })).data.token;

(async () => {
  const p = new PrismaClient();
  const s = Date.now();
  execSync('node scripts/seed-admin.js', { cwd: 'C:/Projects/MasterOnTime-backend-node', stdio: 'pipe' });
  const adminTok = await login(process.env.ADMIN_EMAIL, process.env.ADMIN_PASSWORD);

  const spec = await reg(`sp${s}@t.dev`);
  const plain = await reg(`pl${s}@t.dev`);
  // підвищуємо через admin API
  await call('PATCH', `/api/admin/users/${spec.id}/role`, {
    role: 'SPECIALIST', profile: { profession: 'Plumber', price: 50, experience: 2 },
  }, adminTok);

  const specTok = await login(`sp${s}@t.dev`);
  const plainTok = await login(`pl${s}@t.dev`);

  console.log('1) GET /api/specialists/me — guest 401, USER 403, SPECIALIST 200');
  assert((await call('GET', '/api/specialists/me')).status === 401, 'guest 401');
  assert((await call('GET', '/api/specialists/me', null, plainTok)).status === 403, 'USER 403');
  let r = await call('GET', '/api/specialists/me', null, specTok);
  assert(r.status === 200 && r.data.profession === 'Plumber' && r.data.id === spec.id, 'SPECIALIST gets own profile');

  console.log('2) PUT /api/specialists/me — updates own profile');
  r = await call('PUT', '/api/specialists/me', {
    profession: 'Master Plumber', price: 120, experience: 9, about: 'Emergency callouts', tags: ['pipes', 'boilers'],
  }, specTok);
  assert(r.status === 200 && r.data.profession === 'Master Plumber' && r.data.price === '120', 'returns updated values');
  const db = await p.specialistProfile.findUnique({ where: { userId: spec.id } });
  assert(Number(db.price) === 120 && db.experience === 9 && db.tags.join() === 'pipes,boilers', 'persisted');

  console.log('3b) tags are normalized to lower-case on save (so search-by-tag is case-insensitive)');
  r = await call('PUT', '/api/specialists/me', { tags: ['Pipes', 'BOILERS', 'Emergency'] }, specTok);
  assert(r.status === 200 && r.data.tags.join() === 'pipes,boilers,emergency', 'response tags lower-cased');
  const db2 = await p.specialistProfile.findUnique({ where: { userId: spec.id } });
  assert(db2.tags.join() === 'pipes,boilers,emergency', 'persisted lower-case');

  console.log('3c) industry — set, invalid value rejected, clear with null');
  r = await call('PUT', '/api/specialists/me', { industry: 'HEALTH_WELLBEING' }, specTok);
  assert(r.status === 200 && r.data.industry === 'HEALTH_WELLBEING', 'industry set');
  assert((await call('GET', `/api/specialists/${spec.id}`)).data.industry === 'HEALTH_WELLBEING', 'shows up in public DTO');
  assert((await call('PUT', '/api/specialists/me', { industry: 'NOT_A_REAL_ONE' }, specTok)).status === 400, 'unknown industry -> 400');
  r = await call('PUT', '/api/specialists/me', { industry: null }, specTok);
  assert(r.status === 200 && r.data.industry === null, 'industry cleared with null');

  console.log('3) partial update — only touches provided fields');
  r = await call('PUT', '/api/specialists/me', { price: 150 }, specTok);
  assert(r.status === 200 && r.data.price === '150' && r.data.profession === 'Master Plumber', 'profession untouched');

  console.log('4) public catalogue reflects the edit');
  r = await call('GET', `/api/specialists/${spec.id}`);
  assert(r.status === 200 && r.data.profession === 'Master Plumber' && r.data.price === '150', 'public /:id shows new values');

  console.log('5) rejects unknown / read-only fields');
  assert((await call('PUT', '/api/specialists/me', { rating: 5 }, specTok)).status === 400, 'rating -> 400 (strict)');
  assert((await call('PUT', '/api/specialists/me', { price: -10 }, specTok)).status === 400, 'negative price -> 400');

  console.log('6) PUT /api/specialists/me as USER -> 403');
  assert((await call('PUT', '/api/specialists/me', { price: 1 }, plainTok)).status === 403, '403');

  console.log('7) admin PATCH /api/admin/users/:id/specialist-profile');
  r = await call('PATCH', `/api/admin/users/${spec.id}/specialist-profile`, { about: 'Edited by support' }, adminTok);
  assert(r.status === 200 && r.data.about === 'Edited by support' && r.data.profession === 'Master Plumber', 'admin edit works, other fields kept');

  console.log('8) admin specialist-profile on a non-specialist -> 404');
  assert((await call('PATCH', `/api/admin/users/${plain.id}/specialist-profile`, { about: 'x' }, adminTok)).status === 404, '404');

  console.log('9) non-admin PATCH specialist-profile -> 403');
  assert((await call('PATCH', `/api/admin/users/${spec.id}/specialist-profile`, { about: 'x' }, specTok)).status === 403, '403');

  // прибирання
  await p.refreshToken.deleteMany({ where: { userId: { in: [spec.id, plain.id] } } });
  await p.specialistProfile.deleteMany({ where: { userId: { in: [spec.id, plain.id] } } });
  await p.user.deleteMany({ where: { email: { in: [`sp${s}@t.dev`, `pl${s}@t.dev`] } } });
  await p.$disconnect();

  console.log(process.exitCode ? '\nSOME CHECKS FAILED' : '\nALL CHECKS PASSED');
})();
