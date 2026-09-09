// Димовий тест Фази 3 (booking). node scripts/smoke-booking.js  (сервер на :8080)
const { PrismaClient } = require('C:/Projects/MasterOnTime-backend-node/node_modules/@prisma/client');
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
function assert(c, m) { console.log(c ? `  PASS  ${m}` : `  FAIL  ${m}  ${JSON.stringify(globalThis.__last ?? '')}`); if (!c) process.exitCode = 1; }

async function reg(email, role, first) {
  const r = await call('POST', '/auth/registration', {
    email, password: 'pass123', repeatPassword: 'pass123',
    firstName: first, lastName: 'T',
    address: { country: 'UA', city: 'Kyiv', street: 'S1', zip: '01001' }, role,
  });
  return r.data;
}
const login = async (email) => (await call('POST', '/auth/login', { email, password: 'pass123' })).data.token;

(async () => {
  const p = new PrismaClient();
  const s = Date.now();
  const client = await reg(`cli${s}@t.dev`, 'USER', 'Client');
  const other = await reg(`oth${s}@t.dev`, 'USER', 'Other');
  const spec = await reg(`spec${s}@t.dev`, 'SPECIALIST', 'Spec');
  await p.specialistProfile.update({ where: { userId: spec.id }, data: { price: 50 } });
  const specProfile = await p.specialistProfile.findUnique({ where: { userId: spec.id } });

  const cliTok = await login(`cli${s}@t.dev`);
  const othTok = await login(`oth${s}@t.dev`);
  const specTok = await login(`spec${s}@t.dev`);

  // дата за 3 дні
  const d = new Date(Date.now() + 3 * 864e5);
  const date = d.toISOString().slice(0, 10);
  const at = (h, m = 0) => `${date}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;

  const iso = (h, m = 0) => new Date(at(h, m)).toISOString();

  console.log('1) available-slots (USER)');
  let r = await call('GET', `/api/bookings/available-slots?specialistId=${spec.id}&date=${date}`, null, cliTok);
  assert(r.status === 200 && Array.isArray(r.data) && r.data.length > 0, `slots array (got ${r.status}, n=${r.data?.length})`);
  const slotsBefore = r.data.length;

  console.log('2) available-slots as SPECIALIST -> 403');
  r = await call('GET', `/api/bookings/available-slots?specialistId=${spec.id}&date=${date}`, null, specTok);
  assert(r.status === 403, `403 (got ${r.status})`);

  console.log('3) book a slot (USER)');
  r = await call('POST', '/api/bookings', { specialistId: spec.id, startTime: at(10) }, cliTok);
  globalThis.__last = r.data;
  assert(r.status === 201, `201 (got ${r.status})`);
  assert(r.data.status === 'CONFIRMED', 'status CONFIRMED');
  assert(r.data.specialistId === specProfile.id, 'specialistId = SpecialistProfile id');
  assert(r.data.clientId === client.id, 'clientId = client user id');
  assert(r.data.price === '50', 'price from profile');
  const bookingId = r.data.id;

  console.log('4) book same slot again -> 400 conflict');
  r = await call('POST', '/api/bookings', { specialistId: spec.id, startTime: at(10, 30) }, cliTok);
  assert(r.status === 400, `400 (got ${r.status})`);

  console.log('5) book as SPECIALIST -> 403');
  r = await call('POST', '/api/bookings', { specialistId: spec.id, startTime: at(14) }, specTok);
  assert(r.status === 403, `403 (got ${r.status})`);

  console.log('6) book in the past -> 400');
  r = await call('POST', '/api/bookings', { specialistId: spec.id, startTime: '2020-01-01T10:00:00' }, cliTok);
  assert(r.status === 400, `400 (got ${r.status})`);

  console.log('7) GET /:id  (owner ok, stranger 403)');
  r = await call('GET', `/api/bookings/${bookingId}`, null, cliTok);
  assert(r.status === 200 && r.data.id === bookingId, 'owner reads it');
  r = await call('GET', `/api/bookings/${bookingId}`, null, othTok);
  assert(r.status === 403, `stranger 403 (got ${r.status})`);

  console.log('8) /confirmed and /appointments/upcoming');
  r = await call('GET', '/api/bookings/confirmed', null, cliTok);
  assert(r.data.some((b) => b.id === bookingId), 'confirmed contains booking (client)');
  r = await call('GET', '/api/bookings/appointments/upcoming', null, specTok);
  assert(r.data.some((b) => b.id === bookingId), 'upcoming contains booking (specialist side)');

  console.log('9) available-slots now excludes the booked hour');
  r = await call('GET', `/api/bookings/available-slots?specialistId=${spec.id}&date=${date}`, null, cliTok);
  assert(!r.data.includes(iso(10)), 'booked 10:00 slot gone');
  assert(r.data.length < slotsBefore, `slot count dropped (${slotsBefore} -> ${r.data.length})`);

  console.log('10) reschedule proposal (SPECIALIST) then accept (USER)');
  r = await call('POST', '/api/bookings/reschedule', {
    bookingId, proposedStartTime: at(15), proposedEndTime: at(16), message: 'move please',
  }, specTok);
  assert(r.status === 204, `204 (got ${r.status})`);
  assert((await p.booking.findUnique({ where: { id: bookingId } })).status === 'RESCHEDULE_REQUESTED', 'status RESCHEDULE_REQUESTED');

  r = await call('POST', `/api/bookings/${bookingId}/reschedule-response`, { accept: true }, cliTok);
  assert(r.status === 204, `204 (got ${r.status})`);
  const afterResp = await p.booking.findUnique({ where: { id: bookingId } });
  assert(afterResp.status === 'CONFIRMED' && afterResp.proposedStartTime === null, 'back to CONFIRMED, proposed cleared');
  assert(new Date(afterResp.startTime).getHours() === 15, 'start moved to 15:00');

  console.log('11) reschedule by non-specialist -> 403');
  r = await call('POST', '/api/bookings/reschedule', { bookingId, proposedStartTime: at(9), proposedEndTime: at(10) }, cliTok);
  assert(r.status === 403, `403 (got ${r.status})`);

  console.log('12) cancel (USER) then double-cancel -> 400');
  r = await call('POST', `/api/bookings/${bookingId}/cancel`, {}, cliTok);
  assert(r.status === 204, `204 (got ${r.status})`);
  r = await call('POST', `/api/bookings/${bookingId}/cancel`, {}, cliTok);
  assert(r.status === 400, `400 (got ${r.status})`);

  console.log('13) block a slot (SPECIALIST) then unblock');
  r = await call('POST', '/api/bookings/block', { startTime: at(11), endTime: at(12), reason: 'lunch' }, specTok);
  assert(r.status === 201 && r.data.status === 'BLOCKED', `201 BLOCKED (got ${r.status})`);
  const blockId = r.data.id;
  r = await call('GET', `/api/bookings/available-slots?specialistId=${spec.id}&date=${date}`, null, cliTok);
  assert(!r.data.includes(iso(11)), 'blocked 11:00 slot gone');
  r = await call('DELETE', `/api/bookings/block/${blockId}`, null, specTok);
  assert(r.status === 204, `unblock 204 (got ${r.status})`);

  console.log('14) sync-google-calendar -> 501');
  r = await call('POST', '/api/bookings/sync-google-calendar', {}, cliTok);
  assert(r.status === 501, `501 (got ${r.status})`);

  // прибирання
  await p.booking.deleteMany({ where: { specialistId: specProfile.id } });
  await p.specialistProfile.deleteMany({ where: { userId: spec.id } });
  await p.user.deleteMany({ where: { email: { in: [`cli${s}@t.dev`, `oth${s}@t.dev`, `spec${s}@t.dev`] } } });
  await p.$disconnect();

  console.log(process.exitCode ? '\nSOME CHECKS FAILED' : '\nALL CHECKS PASSED');
})();
