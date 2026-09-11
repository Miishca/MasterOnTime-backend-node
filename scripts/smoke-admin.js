// Димовий тест admin-модуля + зміни реєстрації (роль більше не приймається).
// node scripts/smoke-admin.js  (сервер на :8080, ADMIN_* у .env)
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

async function reg(email, extra = {}) {
  return call('POST', '/auth/registration', {
    email, password: 'pass123', repeatPassword: 'pass123', firstName: 'A', lastName: 'B',
    address: { country: 'UA', city: 'Kyiv', street: 'S1', zip: '01001' }, ...extra,
  });
}
const login = async (email, password = 'pass123') =>
  (await call('POST', '/auth/login', { email, password })).data.token;

(async () => {
  const p = new PrismaClient();
  const s = Date.now();

  console.log('0) seed:admin is idempotent');
  execSync('node scripts/seed-admin.js', { cwd: 'C:/Projects/MasterOnTime-backend-node', stdio: 'pipe' });
  execSync('node scripts/seed-admin.js', { cwd: 'C:/Projects/MasterOnTime-backend-node', stdio: 'pipe' });
  const adminCount = await p.user.count({ where: { email: process.env.ADMIN_EMAIL } });
  assert(adminCount === 1, `exactly one admin row (got ${adminCount})`);

  const adminTok = await login(process.env.ADMIN_EMAIL, process.env.ADMIN_PASSWORD);
  assert(typeof adminTok === 'string', 'admin can log in');

  console.log('1) registration ignores role -> always USER');
  let r = await reg(`u${s}@t.dev`, { role: 'SPECIALIST' });
  assert(r.status === 201, `201 (got ${r.status})`);
  const target = r.data;
  const dbUser = await p.user.findUnique({ where: { id: target.id } });
  assert(dbUser.role === 'USER', `role is USER despite asking for SPECIALIST (got ${dbUser.role})`);

  const userTok = await login(`u${s}@t.dev`);

  console.log('2) non-admin hits /api/admin/* -> 403');
  r = await call('GET', '/api/admin/users', null, userTok);
  assert(r.status === 403, `403 (got ${r.status})`);
  r = await call('PATCH', `/api/admin/users/${target.id}/role`, { role: 'SPECIALIST' }, userTok);
  assert(r.status === 403, `403 (got ${r.status})`);

  console.log('3) no token -> 401');
  assert((await call('GET', '/api/admin/users')).status === 401, '401');

  console.log('4) GET /api/admin/users (search)');
  r = await call('GET', `/api/admin/users?search=u${s}`, null, adminTok);
  assert(r.status === 200 && r.data.some((x) => x.id === target.id), 'finds the user by search');
  assert(r.data.every((x) => 'role' in x && 'hasSpecialistProfile' in x), 'rows carry role + profile flag');

  console.log('5) PATCH role -> SPECIALIST (with profile fields)');
  r = await call('PATCH', `/api/admin/users/${target.id}/role`, {
    role: 'SPECIALIST',
    profile: { profession: 'Electrician', price: 75, experience: 6, about: 'Licensed', industry: 'HOME_GARDEN' },
  }, adminTok);
  assert(r.status === 200 && r.data.role === 'SPECIALIST' && r.data.hasSpecialistProfile, 'now SPECIALIST + profile');
  assert(r.data.specialistProfile.industry === 'HOME_GARDEN', 'industry saved and returned in admin row');
  const prof = await p.specialistProfile.findUnique({ where: { userId: target.id } });
  assert(prof && Number(prof.price) === 75 && prof.profession === 'Electrician' && prof.experience === 6, 'profile fields saved');

  console.log('6) promoted specialist appears in /api/users/specialists');
  r = await call('GET', '/api/users/specialists', null, userTok);
  assert(r.data.some((x) => x.id === target.id), 'shows up in the specialist list');

  console.log('7) promoted specialist can now log in and use a SPECIALIST route');
  const newSpecTok = await login(`u${s}@t.dev`);
  r = await call('GET', '/api/schedule/availability', null, newSpecTok);
  assert(r.status === 200, `schedule route now allowed (got ${r.status})`);

  console.log('8) PATCH role for missing user -> 404');
  r = await call('PATCH', '/api/admin/users/99999999/role', { role: 'SPECIALIST' }, adminTok);
  assert(r.status === 404, `404 (got ${r.status})`);

  console.log('9) PATCH invalid role -> 400');
  r = await call('PATCH', `/api/admin/users/${target.id}/role`, { role: 'WIZARD' }, adminTok);
  assert(r.status === 400, `400 (got ${r.status})`);

  console.log('10) demote back to USER -> profile row kept, hidden from search');
  r = await call('PATCH', `/api/admin/users/${target.id}/role`, { role: 'USER' }, adminTok);
  assert(r.status === 200 && r.data.role === 'USER', 'back to USER');
  r = await call('GET', '/api/users/specialists', null, adminTok);
  assert(!r.data.some((x) => x.id === target.id), 'no longer in specialist list');
  assert((await p.specialistProfile.findUnique({ where: { userId: target.id } })) !== null, 'profile row still exists');

  // прибирання (адміна лишаємо)
  await p.refreshToken.deleteMany({ where: { userId: target.id } });
  await p.specialistProfile.deleteMany({ where: { userId: target.id } });
  await p.user.deleteMany({ where: { email: `u${s}@t.dev` } });
  await p.$disconnect();

  console.log(process.exitCode ? '\nSOME CHECKS FAILED' : '\nALL CHECKS PASSED');
})();
