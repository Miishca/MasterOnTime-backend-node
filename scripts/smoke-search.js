// Димовий тест Фази 2 (search). Запуск: node scripts/smoke-search.js  (сервер на :8080)
const BASE = 'http://localhost:8080';

async function call(method, path, body, token) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data };
}
function assert(c, m) { console.log(c ? `  PASS  ${m}` : `  FAIL  ${m}`); if (!c) process.exitCode = 1; }

async function register(email, role, extra) {
  return call('POST', '/auth/registration', {
    email, password: 'pass123', repeatPassword: 'pass123',
    firstName: extra.firstName, lastName: extra.lastName,
    address: { country: 'Ukraine', city: extra.city, street: 'St 1', zip: '01001' },
    role,
  });
}

(async () => {
  const s = Date.now();
  await register(`u${s}@t.dev`, 'USER', { firstName: 'Plain', lastName: 'User', city: 'Kyiv' });
  const a = await register(`kyiv${s}@t.dev`, 'SPECIALIST', { firstName: 'Anna', lastName: 'Kyivska', city: 'Kyiv' });
  const b = await register(`lviv${s}@t.dev`, 'SPECIALIST', { firstName: 'Bohdan', lastName: 'Lvivsky', city: 'Lviv' });

  // дати спеціалісту A досвід/рейтинг напряму в БД
  const { PrismaClient } = require('C:/Projects/MasterOnTime-backend-node/node_modules/@prisma/client');
  const p = new PrismaClient();
  await p.specialistProfile.update({ where: { userId: a.data.id }, data: { experience: 8, rating: 4.5 } });
  await p.specialistProfile.update({ where: { userId: b.data.id }, data: { experience: 2, rating: 3 } });
  await p.$disconnect();

  const tok = (await call('POST', '/auth/login', { email: `u${s}@t.dev`, password: 'pass123' })).data.token;

  console.log('1) no filters -> 400');
  let r = await call('GET', '/api/specialists/search', null, tok);
  assert(r.status === 400, `400 (got ${r.status})`);

  console.log('2) no token -> 401');
  r = await call('GET', '/api/specialists/search?city=Kyiv');
  assert(r.status === 401, `401 (got ${r.status})`);

  console.log('3) city=Kyiv');
  r = await call('GET', '/api/specialists/search?city=kyiv', null, tok);
  assert(r.status === 200 && r.data.some((u) => u.email === `kyiv${s}@t.dev`), 'finds Kyiv specialist (ci)');
  assert(!r.data.some((u) => u.email === `lviv${s}@t.dev`), 'excludes Lviv specialist');
  assert(!r.data.some((u) => u.email === `u${s}@t.dev`), 'excludes plain user');

  console.log('4) firstName=anna');
  r = await call('GET', '/api/specialists/search?firstName=anna', null, tok);
  assert(r.status === 200 && r.data.length >= 1 && r.data.every((u) => /anna/i.test(u.firstName)), 'firstName contains match');

  console.log('5) minExperience=5');
  r = await call('GET', '/api/specialists/search?minExperience=5', null, tok);
  assert(r.data.some((u) => u.email === `kyiv${s}@t.dev`) && !r.data.some((u) => u.email === `lviv${s}@t.dev`), 'exp filter (8 in, 2 out)');

  console.log('6) minRating=4');
  r = await call('GET', '/api/specialists/search?minRating=4', null, tok);
  assert(r.data.some((u) => u.email === `kyiv${s}@t.dev`) && !r.data.some((u) => u.email === `lviv${s}@t.dev`), 'rating filter (4.5 in, 3 out)');

  console.log('7) combined city=Lviv&minRating=4 -> empty');
  r = await call('GET', '/api/specialists/search?city=Lviv&minRating=4', null, tok);
  assert(r.status === 200 && Array.isArray(r.data) && !r.data.some((u) => u.email === `lviv${s}@t.dev`), 'Lviv spec excluded by rating');

  // прибирання
  {
    const { PrismaClient } = require('C:/Projects/MasterOnTime-backend-node/node_modules/@prisma/client');
    const p2 = new PrismaClient();
    const emails = [`u${s}@t.dev`, `kyiv${s}@t.dev`, `lviv${s}@t.dev`];
    const ids = (await p2.user.findMany({ where: { email: { in: emails } }, select: { id: true } })).map((u) => u.id);
    await p2.specialistProfile.deleteMany({ where: { userId: { in: ids } } });
    await p2.user.deleteMany({ where: { id: { in: ids } } });
    await p2.$disconnect();
  }

  console.log(process.exitCode ? '\nSOME CHECKS FAILED' : '\nALL CHECKS PASSED');
})();
