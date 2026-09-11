// In-app сповіщення (заміна email — Фаза 6). node scripts/smoke-notifications.js
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
  const client = await reg(`nc${s}@t.dev`, 'Not', 'Client');
  const spec = await reg(`ns${s}@t.dev`, 'Not', 'Spec');
  await p.user.update({ where: { id: spec.id }, data: { role: 'SPECIALIST' } });
  await p.specialistProfile.create({ data: { userId: spec.id, price: 30 } });
  const cliTok = await login(`nc${s}@t.dev`);
  const specTok = await login(`ns${s}@t.dev`);

  console.log('1) auth gate');
  assert((await call('GET', '/api/notifications')).status === 401, 'guest 401');

  console.log('2) booking a slot notifies the SPECIALIST');
  const d = new Date(Date.now() + 4 * 864e5).toISOString().slice(0, 10);
  const booking = (await call('POST', '/api/bookings', { specialistId: spec.id, startTime: `${d}T10:00:00` }, cliTok)).data;
  let r = await call('GET', '/api/notifications', null, specTok);
  assert(r.status === 200 && r.data.some((n) => n.type === 'BOOKING_CREATED' && n.bookingId === booking.id), 'specialist has BOOKING_CREATED');
  assert(!(await call('GET', '/api/notifications', null, cliTok)).data.some((n) => n.bookingId === booking.id), 'client got nothing for their own booking');

  console.log('3) unread-count reflects it, mark-read clears it');
  r = await call('GET', '/api/notifications/unread-count', null, specTok);
  assert(r.data.count >= 1, `unread >= 1 (got ${r.data.count})`);
  const notifId = (await call('GET', '/api/notifications', null, specTok)).data.find((n) => n.bookingId === booking.id).id;
  r = await call('PATCH', `/api/notifications/${notifId}/read`, null, specTok);
  assert(r.status === 204, `204 (got ${r.status})`);
  r = await call('GET', '/api/notifications', null, specTok);
  assert(r.data.find((n) => n.id === notifId).read === true, 'now read');

  console.log('4) marking someone else\u2019s notification -> 404');
  assert((await call('PATCH', `/api/notifications/${notifId}/read`, null, cliTok)).status === 404, '404');

  console.log('5) cancelling notifies the OTHER party, not the actor');
  r = await call('POST', `/api/bookings/${booking.id}/cancel`, {}, cliTok);
  assert(r.status === 204, `cancel 204 (got ${r.status})`);
  r = await call('GET', '/api/notifications', null, specTok);
  assert(r.data.some((n) => n.type === 'BOOKING_CANCELLED' && n.bookingId === booking.id), 'specialist notified of cancellation');
  r = await call('GET', '/api/notifications', null, cliTok);
  assert(!r.data.some((n) => n.type === 'BOOKING_CANCELLED'), 'client (who cancelled) got no cancellation notice');

  console.log('6) read-all clears unread-count to 0');
  r = await call('POST', '/api/notifications/read-all', {}, specTok);
  assert(r.status === 204, `204 (got ${r.status})`);
  r = await call('GET', '/api/notifications/unread-count', null, specTok);
  assert(r.data.count === 0, `count 0 (got ${r.data.count})`);

  console.log('7) a review notifies the specialist');
  await p.booking.update({ where: { id: booking.id }, data: { status: 'COMPLETED' } });
  await call('POST', `/api/reviews/booking/${booking.id}`, { rating: 4, comment: 'nice' }, cliTok);
  r = await call('GET', '/api/notifications', null, specTok);
  assert(r.data.some((n) => n.type === 'REVIEW_RECEIVED'), 'specialist got REVIEW_RECEIVED');

  // прибирання
  await p.review.deleteMany({ where: { bookingId: booking.id } });
  await p.refreshToken.deleteMany({ where: { userId: { in: [client.id, spec.id] } } });
  await p.notification.deleteMany({ where: { userId: { in: [client.id, spec.id] } } });
  await p.booking.deleteMany({ where: { id: booking.id } });
  await p.specialistProfile.deleteMany({ where: { userId: spec.id } });
  await p.user.deleteMany({ where: { email: { in: [`nc${s}@t.dev`, `ns${s}@t.dev`] } } });
  await p.$disconnect();

  console.log(process.exitCode ? '\nSOME CHECKS FAILED' : '\nALL CHECKS PASSED');
})();
