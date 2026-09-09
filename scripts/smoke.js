// Швидкий димовий тест Фази 1. Запуск: node scripts/smoke.js  (сервер має слухати :8080)
const BASE = 'http://localhost:8080';

async function call(method, path, body, token) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data;
  const text = await res.text();
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data };
}

function assert(cond, msg) {
  console.log(cond ? `  PASS  ${msg}` : `  FAIL  ${msg}`);
  if (!cond) process.exitCode = 1;
}

(async () => {
  const stamp = Date.now();
  const userEmail = `user${stamp}@test.dev`;
  const specEmail = `spec${stamp}@test.dev`;
  const addr = { country: 'Ukraine', city: 'Kyiv', street: 'Khreshchatyk 1', zip: '01001' };

  console.log('1) registration (USER)');
  let r = await call('POST', '/auth/registration', {
    email: userEmail, password: 'pass123', repeatPassword: 'pass123',
    firstName: 'Ivan', lastName: 'Test', address: addr, role: 'USER',
  });
  assert(r.status === 201, `201 created (got ${r.status})`);
  assert(r.data.id && typeof r.data.id === 'number', 'id is a number');
  assert(r.data.address && r.data.address.city === 'Kyiv', 'address is nested');
  assert(!('passwordHash' in r.data), 'no passwordHash leaked');
  assert(r.data.dateOfBirth === null && 'gender' in r.data, 'dateOfBirth/gender present as null');

  console.log('2) registration (SPECIALIST) -> auto SpecialistProfile');
  r = await call('POST', '/auth/registration', {
    email: specEmail, password: 'pass123', repeatPassword: 'pass123',
    firstName: 'Olena', lastName: 'Master', address: addr, role: 'SPECIALIST',
  });
  assert(r.status === 201, `201 created (got ${r.status})`);

  console.log('3) registration duplicate -> 409');
  r = await call('POST', '/auth/registration', {
    email: userEmail, password: 'pass123', repeatPassword: 'pass123',
    firstName: 'Ivan', lastName: 'Test', address: addr, role: 'USER',
  });
  assert(r.status === 409, `409 conflict (got ${r.status})`);

  console.log('4) registration password mismatch -> 400');
  r = await call('POST', '/auth/registration', {
    email: `x${stamp}@test.dev`, password: 'a', repeatPassword: 'b',
    firstName: 'X', lastName: 'Y', address: addr, role: 'USER',
  });
  assert(r.status === 400, `400 validation (got ${r.status})`);

  console.log('5) login (bad password) -> 401');
  r = await call('POST', '/auth/login', { email: userEmail, password: 'wrong' });
  assert(r.status === 401, `401 (got ${r.status})`);

  console.log('6) login (ok) -> { token }');
  r = await call('POST', '/auth/login', { email: userEmail, password: 'pass123' });
  assert(r.status === 200 && typeof r.data.token === 'string', 'token string returned');
  const userToken = r.data.token;

  r = await call('POST', '/auth/login', { email: specEmail, password: 'pass123' });
  const specToken = r.data.token;

  console.log('7) GET /api/users/me (no token) -> 401');
  r = await call('GET', '/api/users/me');
  assert(r.status === 401, `401 (got ${r.status})`);

  console.log('8) GET /api/users/me (with token)');
  r = await call('GET', '/api/users/me', null, userToken);
  assert(r.status === 200 && r.data.email === userEmail, 'returns own profile');

  console.log('9) PUT /api/users/me');
  r = await call('PUT', '/api/users/me', {
    firstName: 'Ivan-Updated', phoneNumber: '+380671112233', dateOfBirth: '1990-05-01', gender: 'MALE',
  }, userToken);
  assert(r.status === 200, `200 (got ${r.status})`);
  assert(r.data.firstName === 'Ivan-Updated', 'firstName updated');
  assert(r.data.dateOfBirth === '1990-05-01', 'dateOfBirth formatted YYYY-MM-DD');
  assert(r.data.gender === 'MALE', 'gender updated');
  assert(r.data.address.city === 'Kyiv', 'address untouched');

  console.log('10) PUT /api/users/me duplicate email -> 409');
  r = await call('PUT', '/api/users/me', { email: specEmail }, userToken);
  assert(r.status === 409, `409 (got ${r.status})`);

  console.log('11) GET /api/users/specialists');
  r = await call('GET', '/api/users/specialists', null, userToken);
  assert(r.status === 200 && Array.isArray(r.data), 'array returned');
  assert(r.data.some((u) => u.email === specEmail), 'includes the specialist');
  assert(!r.data.some((u) => u.email === userEmail), 'excludes plain users');

  console.log('12) GET /api/users/specialists (no token) -> 401');
  r = await call('GET', '/api/users/specialists');
  assert(r.status === 401, `401 (got ${r.status})`);

  // прибирання тестових акаунтів
  const { PrismaClient } = require('C:/Projects/MasterOnTime-backend-node/node_modules/@prisma/client');
  const p = new PrismaClient();
  const ids = (await p.user.findMany({ where: { email: { in: [userEmail, specEmail] } }, select: { id: true } })).map((u) => u.id);
  await p.specialistProfile.deleteMany({ where: { userId: { in: ids } } });
  await p.user.deleteMany({ where: { id: { in: ids } } });
  await p.$disconnect();

  console.log(process.exitCode ? '\nSOME CHECKS FAILED' : '\nALL CHECKS PASSED');
})();
