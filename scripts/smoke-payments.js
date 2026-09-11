// Картка на /profile через LiqPay ("лише зберегти", без автосписань).
// node scripts/smoke-payments.js
//
// НЕ включений у npm-скрипт "test" (на відміну від інших smoke-*): крок 5
// робить РЕАЛЬНИЙ мережевий запит до LiqPay (action:"status" у сендбоксі) —
// на відміну від решти сюїти, яка повністю локальна й не залежить від
// зовнішньої мережі/аптайму LiqPay.
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
  const user = await reg(`pay${s}@t.dev`, 'Pay', 'User');
  const other = await reg(`payo${s}@t.dev`, 'Other', 'User');
  const tok = await login(`pay${s}@t.dev`);
  const otherTok = await login(`payo${s}@t.dev`);

  console.log('1) auth gate');
  assert((await call('GET', '/api/payments/card')).status === 401, 'guest 401 on GET /card');
  assert((await call('POST', '/api/payments/card/init')).status === 401, 'guest 401 on init');

  console.log('2) nothing saved yet');
  let r = await call('GET', '/api/payments/card', null, tok);
  assert(r.status === 200 && r.data === null, `null (got ${r.status} ${JSON.stringify(r.data)})`);

  console.log('3) init returns a signed LiqPay checkout payload');
  r = await call('POST', '/api/payments/card/init', {}, tok);
  assert(r.status === 200, `200 (got ${r.status})`);
  assert(r.data.checkoutUrl === 'https://www.liqpay.ua/api/3/checkout', 'checkoutUrl is LiqPay checkout');
  assert(typeof r.data.data === 'string' && r.data.data.length > 0, 'data (base64 params) present');
  assert(typeof r.data.signature === 'string' && r.data.signature.length > 0, 'signature present');
  const decoded = JSON.parse(Buffer.from(r.data.data, 'base64').toString('utf8'));
  assert(decoded.action === 'hold', 'action is hold (verify-only, no hold_completion is ever called)');
  assert(decoded.recurringbytoken === 1, 'recurringbytoken:1 requested, so LiqPay returns a card_token');
  const orderId = decoded.order_id;

  console.log('4) confirm rejects an order_id that is not yours');
  r = await call('POST', '/api/payments/card/confirm', { orderId }, otherTok);
  assert(r.status === 403, `403 (got ${r.status})`);

  console.log('5) confirm against LiqPay sandbox for an order nobody ever paid -> no card_token -> 400');
  r = await call('POST', '/api/payments/card/confirm', { orderId }, tok);
  assert(r.status === 400, `400, no card was actually saved at LiqPay (got ${r.status} ${JSON.stringify(r.data)})`);

  console.log('6) delete is idempotent even with nothing saved');
  assert((await call('DELETE', '/api/payments/card', null, tok)).status === 204, '204');

  // прибирання
  await p.refreshToken.deleteMany({ where: { userId: { in: [user.id, other.id] } } });
  await p.savedCard.deleteMany({ where: { userId: { in: [user.id, other.id] } } });
  await p.user.deleteMany({ where: { email: { in: [`pay${s}@t.dev`, `payo${s}@t.dev`] } } });
  await p.$disconnect();

  console.log(process.exitCode ? '\nSOME CHECKS FAILED' : '\nALL CHECKS PASSED');
})();
