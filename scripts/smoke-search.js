// Димовий тест публічного каталогу спеціалістів (feat/public-specialist-browsing).
// node scripts/smoke-search.js   (сервер на :8080)
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

async function register(email, extra) {
  return call('POST', '/auth/registration', {
    email, password: 'pass123', repeatPassword: 'pass123',
    firstName: extra.firstName, lastName: extra.lastName,
    address: { country: 'Ukraine', city: extra.city, street: 'Secret St 1', zip: '99999' },
  });
}

(async () => {
  const p = new PrismaClient();
  const s = Date.now();
  await register(`u${s}@t.dev`, { firstName: 'Plain', lastName: 'User', city: 'Kyiv' });
  const a = (await register(`kyiv${s}@t.dev`, { firstName: 'Anna', lastName: 'Kyivska', city: 'Kyiv' })).data;
  const b = (await register(`lviv${s}@t.dev`, { firstName: 'Bohdan', lastName: 'Lvivsky', city: 'Lviv' })).data;
  const hidden = (await register(`hid${s}@t.dev`, { firstName: 'Hidden', lastName: 'One', city: 'Kyiv' })).data;

  for (const [u, data] of [[a, { experience: 8, rating: 4.5 }], [b, { experience: 2, rating: 3 }], [hidden, {}]]) {
    await p.user.update({ where: { id: u.id }, data: { role: 'SPECIALIST' } });
    await p.specialistProfile.create({ data: { userId: u.id, profession: 'Tutor', price: 30, ...data } });
  }
  await p.user.update({ where: { id: hidden.id }, data: { visible: false } }); // прихований спеціаліст

  console.log('1) GET /api/specialists — NO token (public)');
  let r = await call('GET', '/api/specialists');
  assert(r.status === 200 && Array.isArray(r.data), `200 array (got ${r.status})`);
  assert(r.data.some((x) => x.id === a.id) && r.data.some((x) => x.id === b.id), 'includes both specialists');
  assert(!r.data.some((x) => x.id === hidden.id), 'excludes visible=false specialist');
  assert(!r.data.some((x) => x.email === `u${s}@t.dev`), 'excludes plain USERs');

  console.log('2) PublicSpecialistDto has NO PII');
  const anna = r.data.find((x) => x.id === a.id);
  assert(anna && anna.firstName === 'Anna' && anna.lastName === 'Kyivska', 'name present');
  assert(anna.city === 'Kyiv', 'city present');
  assert(!('email' in anna) && !('phoneNumber' in anna) && !('dateOfBirth' in anna), 'no email/phone/dob');
  assert(anna.address === undefined, 'no address object (street/zip hidden)');
  assert(anna.rating === 4.5 && anna.experience === 8 && anna.profession === 'Tutor', 'profile fields present');

  console.log('3) GET /api/specialists/search — public, filters');
  r = await call('GET', '/api/specialists/search?city=kyiv');
  assert(r.status === 200 && r.data.some((x) => x.id === a.id) && !r.data.some((x) => x.id === b.id), 'city filter (ci)');
  r = await call('GET', '/api/specialists/search?minRating=4');
  assert(r.data.some((x) => x.id === a.id) && !r.data.some((x) => x.id === b.id), 'minRating filter');
  r = await call('GET', '/api/specialists/search?firstName=anna');
  assert(r.data.length >= 1 && r.data.every((x) => /anna/i.test(x.firstName)), 'firstName filter');

  console.log('4) search with no filter -> full list (not 400)');
  r = await call('GET', '/api/specialists/search');
  assert(r.status === 200 && r.data.some((x) => x.id === a.id), 'returns everyone');

  console.log('5) GET /api/specialists/:id — public');
  r = await call('GET', `/api/specialists/${a.id}`);
  assert(r.status === 200 && r.data.id === a.id && !('email' in r.data), 'single specialist, no PII');

  console.log('6) GET /api/specialists/:id for a hidden / non-specialist -> 404');
  assert((await call('GET', `/api/specialists/${hidden.id}`)).status === 404, 'hidden -> 404');
  const plainId = (await p.user.findUnique({ where: { email: `u${s}@t.dev` } })).id;
  assert((await call('GET', `/api/specialists/${plainId}`)).status === 404, 'plain user -> 404');
  assert((await call('GET', '/api/specialists/99999999')).status === 404, 'missing -> 404');

  console.log('7) /api/users/specialists still requires a token (unchanged)');
  assert((await call('GET', '/api/users/specialists')).status === 401, '401 without token');

  // прибирання
  const emails = [`u${s}@t.dev`, `kyiv${s}@t.dev`, `lviv${s}@t.dev`, `hid${s}@t.dev`];
  const ids = (await p.user.findMany({ where: { email: { in: emails } }, select: { id: true } })).map((u) => u.id);
  await p.specialistProfile.deleteMany({ where: { userId: { in: ids } } });
  await p.user.deleteMany({ where: { id: { in: ids } } });
  await p.$disconnect();

  console.log(process.exitCode ? '\nSOME CHECKS FAILED' : '\nALL CHECKS PASSED');
})();
