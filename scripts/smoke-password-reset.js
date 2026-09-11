// Forgot/reset password (Фаза 6). node scripts/smoke-password-reset.js
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
  return { status: res.status, data: d };
}
function assert(c, m) { console.log(c ? `  PASS  ${m}` : `  FAIL  ${m}`); if (!c) process.exitCode = 1; }

(async () => {
  const p = new PrismaClient();
  const s = Date.now();
  const email = `pr${s}@t.dev`;
  const reg = await call('POST', '/auth/registration', {
    email, password: 'original-pass', repeatPassword: 'original-pass', firstName: 'Reset', lastName: 'Me',
    address: { country: 'UA', city: 'Kyiv', street: 'S1', zip: '01001' },
  });
  const userId = reg.data.id;

  console.log('1) unknown email -> still 200, no enumeration, no devResetToken');
  let r = await call('POST', '/auth/forgot-password', { email: `nobody${s}@t.dev` });
  assert(r.status === 200 && r.data.devResetToken === undefined, `200, no token leaked (got ${r.status})`);

  console.log('2) known email -> 200 + dev token (NODE_ENV !== production locally) + a row in the DB');
  r = await call('POST', '/auth/forgot-password', { email });
  assert(r.status === 200, `200 (got ${r.status})`);
  const rows = await p.passwordResetToken.count({ where: { userId } });
  assert(rows === 1, `one token row created (got ${rows})`);
  const rawToken = r.data.devResetToken;
  assert(typeof rawToken === 'string' && rawToken.length > 10, 'dev token present in response');

  console.log('3) reset with a garbage token -> 400');
  assert((await call('POST', '/auth/reset-password', { token: 'not-a-real-token', password: 'newpass123', repeatPassword: 'newpass123' })).status === 400, '400');

  console.log('4) mismatched passwords -> 400 (zod refine), token untouched');
  assert((await call('POST', '/auth/reset-password', { token: rawToken, password: 'newpass123', repeatPassword: 'different' })).status === 400, '400');

  console.log('5) reset with the real token -> 204, can log in with the new password, not the old one');
  r = await call('POST', '/auth/reset-password', { token: rawToken, password: 'newpass123', repeatPassword: 'newpass123' });
  assert(r.status === 204, `204 (got ${r.status})`);
  assert((await call('POST', '/auth/login', { email, password: 'original-pass' })).status === 401, 'old password rejected');
  assert((await call('POST', '/auth/login', { email, password: 'newpass123' })).status === 200, 'new password works');

  console.log('6) the same token cannot be reused');
  r = await call('POST', '/auth/reset-password', { token: rawToken, password: 'yetanother123', repeatPassword: 'yetanother123' });
  assert(r.status === 400, `400 (got ${r.status})`);

  console.log('7) a short new password is rejected');
  await call('POST', '/auth/forgot-password', { email });
  const rawToken2 = (await call('POST', '/auth/forgot-password', { email })).data.devResetToken;
  assert((await call('POST', '/auth/reset-password', { token: rawToken2, password: 'short', repeatPassword: 'short' })).status === 400, '400');

  // прибирання
  await p.passwordResetToken.deleteMany({ where: { userId } });
  await p.user.deleteMany({ where: { email } });
  await p.$disconnect();

  console.log(process.exitCode ? '\nSOME CHECKS FAILED' : '\nALL CHECKS PASSED');
})();
