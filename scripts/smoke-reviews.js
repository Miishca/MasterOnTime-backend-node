// Димовий тест Фази 4 (reviews). node scripts/smoke-reviews.js  (сервер на :8080)
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

async function reg(email, role, first) {
  return (await call('POST', '/auth/registration', {
    email, password: 'pass123', repeatPassword: 'pass123', firstName: first, lastName: 'T',
    address: { country: 'UA', city: 'Kyiv', street: 'S1', zip: '01001' }, role,
  })).data;
}
const login = async (email) => (await call('POST', '/auth/login', { email, password: 'pass123' })).data.token;

(async () => {
  const p = new PrismaClient();
  const s = Date.now();
  const client = await reg(`rc${s}@t.dev`, 'USER', 'Rev');
  const other = await reg(`ro${s}@t.dev`, 'USER', 'Oth');
  const spec = await reg(`rs${s}@t.dev`, 'SPECIALIST', 'Spec');
  await p.specialistProfile.update({ where: { userId: spec.id }, data: { price: 40 } });
  const profile = await p.specialistProfile.findUnique({ where: { userId: spec.id } });

  const cliTok = await login(`rc${s}@t.dev`);
  const othTok = await login(`ro${s}@t.dev`);
  const specTok = await login(`rs${s}@t.dev`);

  // створюємо 2 бронювання через API
  const d = new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10);
  const b1 = (await call('POST', '/api/bookings', { specialistId: spec.id, startTime: `${d}T10:00:00` }, cliTok)).data;
  const b2 = (await call('POST', '/api/bookings', { specialistId: spec.id, startTime: `${d}T12:00:00` }, cliTok)).data;

  console.log('1) can-review before COMPLETED -> false');
  let r = await call('GET', `/api/reviews/can-review/${b1.id}`, null, cliTok);
  assert(r.status === 200 && r.data === false, `false (got ${r.status}/${r.data})`);

  console.log('2) review a non-completed booking -> 409');
  r = await call('POST', `/api/reviews/booking/${b1.id}`, { rating: 5, comment: 'early' }, cliTok);
  assert(r.status === 409, `409 (got ${r.status})`);

  // позначаємо обидва як COMPLETED (у проді це робить фонова задача — Фаза 6)
  await p.booking.updateMany({ where: { id: { in: [b1.id, b2.id] } }, data: { status: 'COMPLETED' } });

  console.log('3) can-review now -> true');
  r = await call('GET', `/api/reviews/can-review/${b1.id}`, null, cliTok);
  assert(r.data === true, `true (got ${r.data})`);

  console.log('4) submit review (USER) -> 201, profile.rating updates');
  r = await call('POST', `/api/reviews/booking/${b1.id}`, { rating: 5, comment: 'Great!' }, cliTok);
  assert(r.status === 201 && r.data.rating === 5, `201 rating 5 (got ${r.status})`);
  assert(r.data.clientId === client.id && r.data.specialistId === profile.id, 'clientId=author, specialistId=profile');
  const rev1 = r.data.id;
  let prof = await p.specialistProfile.findUnique({ where: { id: profile.id } });
  assert(prof.rating === 5, `profile.rating = 5 (got ${prof.rating})`);

  console.log('5) double review same booking -> 409');
  r = await call('POST', `/api/reviews/booking/${b1.id}`, { rating: 4 }, cliTok);
  assert(r.status === 409, `409 (got ${r.status})`);

  console.log('6) review as SPECIALIST -> 403');
  r = await call('POST', `/api/reviews/booking/${b2.id}`, { rating: 4 }, specTok);
  assert(r.status === 403, `403 (got ${r.status})`);

  console.log('7) review someone else\u2019s booking -> 403');
  r = await call('POST', `/api/reviews/booking/${b2.id}`, { rating: 4 }, othTok);
  assert(r.status === 403, `403 (got ${r.status})`);

  console.log('8) can-review after review -> false');
  r = await call('GET', `/api/reviews/can-review/${b1.id}`, null, cliTok);
  assert(r.data === false, `false (got ${r.data})`);

  console.log('9) GET /api/reviews/specialist (specialist sees it, client 403)');
  r = await call('GET', '/api/reviews/specialist', null, specTok);
  assert(r.status === 200 && r.data.some((x) => x.id === rev1), 'specialist sees own reviews');
  r = await call('GET', '/api/reviews/specialist', null, cliTok);
  assert(r.status === 403, `client 403 (got ${r.status})`);

  console.log('10) 2nd review (rating 3) -> average becomes 4');
  r = await call('POST', '/api/reviews', { bookingId: b2.id, rating: 3, comment: 'ok' }, cliTok);
  assert(r.status === 201, `201 (got ${r.status})`);
  const rev2 = r.data.id;
  prof = await p.specialistProfile.findUnique({ where: { id: profile.id } });
  assert(prof.rating === 4, `avg rating = 4 (got ${prof.rating})`);

  console.log('11) PUT /api/reviews/:id (author edits) -> rating recomputed');
  r = await call('PUT', `/api/reviews/${rev1}`, { rating: 1, comment: 'changed my mind' }, cliTok);
  assert(r.status === 200 && r.data.rating === 1, `200 rating 1 (got ${r.status})`);
  prof = await p.specialistProfile.findUnique({ where: { id: profile.id } });
  assert(prof.rating === 2, `avg (1+3)/2 = 2 (got ${prof.rating})`);

  console.log('12) PUT by non-author -> 403');
  r = await call('PUT', `/api/reviews/${rev1}`, { rating: 5 }, othTok);
  assert(r.status === 403, `403 (got ${r.status})`);

  console.log('13) DELETE /api/reviews/:id (author) -> 204, rating recomputed');
  r = await call('DELETE', `/api/reviews/${rev2}`, null, cliTok);
  assert(r.status === 204, `204 (got ${r.status})`);
  prof = await p.specialistProfile.findUnique({ where: { id: profile.id } });
  assert(prof.rating === 1, `only rev1 (rating 1) left -> 1 (got ${prof.rating})`);

  console.log('14) moderation endpoints -> 501');
  assert((await call('GET', '/api/reviews/moderation', null, cliTok)).status === 501, 'GET /moderation 501');
  assert((await call('PUT', '/api/reviews/1/moderate', {}, cliTok)).status === 501, 'PUT /:id/moderate 501');

  console.log('15) validation: rating 6 -> 400');
  r = await call('POST', '/api/reviews', { bookingId: b1.id, rating: 6 }, cliTok);
  assert(r.status === 400, `400 (got ${r.status})`);

  // прибирання
  await p.review.deleteMany({ where: { specialistId: profile.id } });
  await p.booking.deleteMany({ where: { specialistId: profile.id } });
  await p.specialistProfile.deleteMany({ where: { userId: spec.id } });
  await p.user.deleteMany({ where: { email: { in: [`rc${s}@t.dev`, `ro${s}@t.dev`, `rs${s}@t.dev`] } } });
  await p.$disconnect();

  console.log(process.exitCode ? '\nSOME CHECKS FAILED' : '\nALL CHECKS PASSED');
})();
