// Refresh-токени + logout + revoke-on-reset (Фаза 6 hardening).
// node scripts/smoke-auth-sessions.js
require('dotenv/config');
const { PrismaClient } = require('C:/Projects/MasterOnTime-backend-node/node_modules/@prisma/client');
const BASE = 'http://localhost:8080';

async function call(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const t = await res.text();
  let d; try { d = JSON.parse(t); } catch { d = t; }
  return { status: res.status, data: d, headers: res.headers };
}
function assert(c, m) { console.log(c ? `  PASS  ${m}` : `  FAIL  ${m}`); if (!c) process.exitCode = 1; }

(async () => {
  const p = new PrismaClient();
  const s = Date.now();
  const email = `as${s}@t.dev`;
  await call('POST', '/auth/registration', {
    email, password: 'pass1234', repeatPassword: 'pass1234', firstName: 'Auth', lastName: 'Sessions',
    address: { country: 'UA', city: 'Kyiv', street: 'S1', zip: '01001' },
  });

  console.log('1) login returns both token and refreshToken');
  let r = await call('POST', '/auth/login', { email, password: 'pass1234' });
  assert(r.status === 200 && typeof r.data.token === 'string' && typeof r.data.refreshToken === 'string', 'both present');
  const rt1 = r.data.refreshToken;
  const rowCount1 = await p.refreshToken.count({ where: { user: { email } } });
  assert(rowCount1 === 1, `one refresh_tokens row persisted (got ${rowCount1})`);

  console.log('2) /auth/refresh exchanges it for a new pair (rotation)');
  r = await call('POST', '/auth/refresh', { refreshToken: rt1 });
  assert(r.status === 200 && typeof r.data.token === 'string' && typeof r.data.refreshToken === 'string', '200, new pair');
  const rt2 = r.data.refreshToken;
  assert(rt2 !== rt1, 'refresh token actually rotated (not reused)');

  console.log('3) reusing the OLD (already-rotated) refresh token -> 401');
  r = await call('POST', '/auth/refresh', { refreshToken: rt1 });
  assert(r.status === 401, `401 (got ${r.status})`);

  console.log('4) garbage / missing refresh token -> 401 / 400');
  assert((await call('POST', '/auth/refresh', { refreshToken: 'not-a-real-token' })).status === 401, 'garbage -> 401');
  assert((await call('POST', '/auth/refresh', {})).status === 400, 'missing field -> 400 (zod)');

  console.log('5) /auth/logout revokes the (current) session');
  r = await call('POST', '/auth/logout', { refreshToken: rt2 });
  assert(r.status === 204, `204 (got ${r.status})`);
  r = await call('POST', '/auth/refresh', { refreshToken: rt2 });
  assert(r.status === 401, `revoked token now rejected (got ${r.status})`);

  console.log('6) logout is idempotent — logging out twice is not an error');
  assert((await call('POST', '/auth/logout', { refreshToken: rt2 })).status === 204, '204 again');

  console.log('7) password reset revokes ALL outstanding sessions for that user');
  const loginA = (await call('POST', '/auth/login', { email, password: 'pass1234' })).data;
  const loginB = (await call('POST', '/auth/login', { email, password: 'pass1234' })).data;
  const resetResp = await call('POST', '/auth/forgot-password', { email });
  const resetToken = resetResp.data.devResetToken;
  assert(typeof resetToken === 'string', 'dev reset token present (NODE_ENV != production locally)');
  r = await call('POST', '/auth/reset-password', { token: resetToken, password: 'brandnew123', repeatPassword: 'brandnew123' });
  assert(r.status === 204, `reset 204 (got ${r.status})`);
  assert((await call('POST', '/auth/refresh', { refreshToken: loginA.refreshToken })).status === 401, 'session A revoked by the reset');
  assert((await call('POST', '/auth/refresh', { refreshToken: loginB.refreshToken })).status === 401, 'session B revoked by the reset too');
  assert((await call('POST', '/auth/login', { email, password: 'brandnew123' })).status === 200, 'new password logs in fine');

  console.log('8) rate limiters exist but are skipped outside production (would otherwise flood dev/smoke logins)');
  r = await call('POST', '/auth/login', { email, password: 'wrong-on-purpose' });
  assert(r.status === 401, 'endpoint still works normally');
  assert(r.headers.get('ratelimit-remaining') === null, 'no rate-limit headers in dev — limiter is skipped (NODE_ENV != production)');

  // прибирання
  const user = await p.user.findUnique({ where: { email } });
  await p.refreshToken.deleteMany({ where: { userId: user.id } });
  await p.passwordResetToken.deleteMany({ where: { userId: user.id } });
  await p.user.delete({ where: { id: user.id } });
  await p.$disconnect();

  console.log(process.exitCode ? '\nSOME CHECKS FAILED' : '\nALL CHECKS PASSED');
})();
