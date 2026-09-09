// Перевірка, що весь стек працює ЧЕРЕЗ проксі Vite (:5173 -> :8080), а не лише напряму.
// node scripts/smoke-proxy.js   (мають бути підняті обидва сервери)
const { PrismaClient } = require('C:/Projects/MasterOnTime-backend-node/node_modules/@prisma/client');
const FE = 'http://localhost:5173'; // фронтенд-проксі
const BE = 'http://localhost:8080'; // прямий бекенд (для порівняння)

async function call(base, method, path, body, token) {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const t = await res.text();
  let d; try { d = JSON.parse(t); } catch { d = t; }
  return { status: res.status, data: d };
}
function assert(c, m) { console.log(c ? `  PASS  ${m}` : `  FAIL  ${m}`); if (!c) process.exitCode = 1; }

(async () => {
  const p = new PrismaClient();
  const s = Date.now();
  const email = `proxy${s}@t.dev`;
  const addr = { country: 'UA', city: 'Kyiv', street: 'S1', zip: '01001' };

  console.log('через проксі :5173 --------------------------------');

  console.log('POST /auth/registration');
  let r = await call(FE, 'POST', '/auth/registration', {
    email, password: 'pass123', repeatPassword: 'pass123', firstName: 'Proxy', lastName: 'T', address: addr, role: 'SPECIALIST',
  });
  assert(r.status === 201 && typeof r.data.id === 'number', `201 + numeric id (got ${r.status})`);

  console.log('POST /auth/login');
  r = await call(FE, 'POST', '/auth/login', { email, password: 'pass123' });
  assert(r.status === 200 && typeof r.data.token === 'string', 'token returned');
  const token = r.data.token;

  console.log('GET /api/users/me');
  r = await call(FE, 'GET', '/api/users/me', null, token);
  assert(r.status === 200 && r.data.email === email, 'own profile via proxy');

  console.log('PUT /api/users/me');
  r = await call(FE, 'PUT', '/api/users/me', { firstName: 'ProxyRenamed' }, token);
  assert(r.status === 200 && r.data.firstName === 'ProxyRenamed', 'PUT works through proxy');

  console.log('GET /api/users/specialists');
  r = await call(FE, 'GET', '/api/users/specialists', null, token);
  assert(r.status === 200 && Array.isArray(r.data) && r.data.some((u) => u.email === email), 'list via proxy');

  console.log('GET /api/specialists/search?city=Kyiv');
  r = await call(FE, 'GET', '/api/specialists/search?city=Kyiv', null, token);
  assert(r.status === 200 && Array.isArray(r.data), 'search via proxy');

  console.log('GET /api/bookings/confirmed (DELETE/GET/POST methods forwarded)');
  r = await call(FE, 'GET', '/api/bookings/confirmed', null, token);
  assert(r.status === 200 && Array.isArray(r.data), 'bookings route via proxy');

  console.log('DELETE method forwarded: DELETE /api/bookings/block/999999 -> 404 not 405');
  r = await call(FE, 'DELETE', '/api/bookings/block/999999', null, token);
  assert(r.status === 404, `404 (proxy forwards DELETE) (got ${r.status})`);

  console.log('порівняння прямого й проксі-виклику ---------------');
  const direct = await call(BE, 'GET', '/health');
  const viaProxy = await call(FE, 'GET', '/health');
  assert(direct.status === 200 && viaProxy.status === 200, 'both :8080 and :5173/health = 200');

  const ids = (await p.user.findMany({ where: { email }, select: { id: true } })).map((u) => u.id);
  await p.specialistProfile.deleteMany({ where: { userId: { in: ids } } });
  await p.user.deleteMany({ where: { id: { in: ids } } });
  await p.$disconnect();
  console.log(process.exitCode ? '\nFAILED' : '\nALL CHECKS PASSED');
})();
