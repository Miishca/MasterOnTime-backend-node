// Димовий тест Фази 5 (schedule) + інтеграція з available-slots.
// node scripts/smoke-schedule.js   (сервер на :8080)
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

async function reg(email, role) {
  return (await call('POST', '/auth/registration', {
    email, password: 'pass123', repeatPassword: 'pass123', firstName: 'S', lastName: 'T',
    address: { country: 'UA', city: 'Kyiv', street: 'S1', zip: '01001' }, role,
  })).data;
}
const login = async (email) => (await call('POST', '/auth/login', { email, password: 'pass123' })).data.token;

const DOW = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

(async () => {
  const p = new PrismaClient();
  const s = Date.now();
  const spec = await reg(`sc${s}@t.dev`, 'SPECIALIST');
  const cli = await reg(`sk${s}@t.dev`, 'USER');
  await p.user.update({ where: { id: spec.id }, data: { role: 'SPECIALIST' } });
  await p.specialistProfile.create({ data: { userId: spec.id } });
  const specTok = await login(`sc${s}@t.dev`);
  const cliTok = await login(`sk${s}@t.dev`);

  // цільова дата: рівно за 7 днів (той самий день тижня, точно в майбутньому)
  const target = new Date(Date.now() + 7 * 864e5);
  const date = target.toISOString().slice(0, 10);
  const weekday = DOW[new Date(`${date}T12:00:00`).getDay()];
  const otherDay = DOW[(new Date(`${date}T12:00:00`).getDay() + 1) % 7];

  console.log(`(цільовий день: ${date} = ${weekday})`);

  console.log('1) GET /availability as USER -> 403');
  let r = await call('GET', '/api/schedule/availability', null, cliTok);
  assert(r.status === 403, `403 (got ${r.status})`);

  console.log('2) GET /availability as SPECIALIST -> 200 []');
  r = await call('GET', '/api/schedule/availability', null, specTok);
  assert(r.status === 200 && Array.isArray(r.data) && r.data.length === 0, `empty array (got ${r.status})`);

  console.log('3) PUT /availability (2 windows) -> 204, GET returns 2');
  r = await call('PUT', '/api/schedule/availability', [
    { dayOfWeek: weekday, startTime: '09:00', endTime: '12:00' },
    { dayOfWeek: weekday, startTime: '14:00', endTime: '17:00' },
  ], specTok);
  assert(r.status === 204, `204 (got ${r.status})`);
  r = await call('GET', '/api/schedule/availability', null, specTok);
  assert(r.data.length === 2 && r.data.every((x) => x.dayOfWeek === weekday), 'GET returns the 2 windows');

  console.log('4) PUT /availability again (replace) -> old rows gone');
  r = await call('PUT', '/api/schedule/availability', [
    { dayOfWeek: otherDay, startTime: '10:00', endTime: '15:00' },
  ], specTok);
  assert(r.status === 204, `204 (got ${r.status})`);
  r = await call('GET', '/api/schedule/availability', null, specTok);
  assert(r.data.length === 1 && r.data[0].dayOfWeek === otherDay, 'delete-all-then-insert');

  console.log('5) PUT /availability invalid (start >= end) -> 400');
  r = await call('PUT', '/api/schedule/availability', [
    { dayOfWeek: weekday, startTime: '17:00', endTime: '09:00' },
  ], specTok);
  assert(r.status === 400, `400 (got ${r.status})`);

  console.log('6) PUT /availability invalid time format -> 400');
  r = await call('PUT', '/api/schedule/availability', [
    { dayOfWeek: weekday, startTime: '9am', endTime: '17:00' },
  ], specTok);
  assert(r.status === 400, `400 (got ${r.status})`);

  console.log('7) POST /unavailability -> 204, GET returns it');
  const uStart = `${date}T10:00:00`;
  const uEnd = `${date}T11:00:00`;
  r = await call('POST', '/api/schedule/unavailability', { start: uStart, end: uEnd }, specTok);
  assert(r.status === 204, `204 (got ${r.status})`);
  r = await call('GET', '/api/schedule/unavailability', null, specTok);
  assert(r.status === 200 && r.data.length === 1, `1 row (got ${r.data.length})`);

  console.log('8) POST /unavailability invalid (start >= end) -> 400');
  r = await call('POST', '/api/schedule/unavailability', { start: uEnd, end: uStart }, specTok);
  assert(r.status === 400, `400 (got ${r.status})`);

  // ---- інтеграція з available-slots ----
  console.log('9) available-slots honours the weekly availability window');
  // ставимо графік лише на цільовий день: 09:00-12:00
  await call('PUT', '/api/schedule/availability', [
    { dayOfWeek: weekday, startTime: '09:00', endTime: '12:00' },
  ], specTok);
  r = await call('GET', `/api/bookings/available-slots?specialistId=${spec.id}&date=${date}`, null, cliTok);
  const times = r.data.map((iso) => new Date(iso));
  assert(r.status === 200 && times.length > 0, `slots returned (got ${r.status}, n=${times.length})`);
  assert(times.every((t) => {
    const end = new Date(t.getTime() + 60 * 60000);
    const winStart = new Date(`${date}T09:00:00`);
    const winEnd = new Date(`${date}T12:00:00`);
    return t >= winStart && end <= winEnd;
  }), 'every slot fits inside 09:00–12:00');

  console.log('10) unavailability 10:00–11:00 removes the overlapping slots');
  await call('POST', '/api/schedule/unavailability', { start: `${date}T10:00:00`, end: `${date}T11:00:00` }, specTok);
  r = await call('GET', `/api/bookings/available-slots?specialistId=${spec.id}&date=${date}`, null, cliTok);
  const t2 = r.data.map((iso) => new Date(iso));
  assert(!t2.some((t) => {
    const end = new Date(t.getTime() + 60 * 60000);
    return t < new Date(`${date}T11:00:00`) && end > new Date(`${date}T10:00:00`);
  }), 'no slot overlaps the 10:00–11:00 block');
  assert(t2.some((t) => t.getTime() === new Date(`${date}T09:00:00`).getTime()), '09:00 slot still there');

  console.log('11) a day with no availability window -> no slots');
  r = await call('GET', `/api/bookings/available-slots?specialistId=${spec.id}&date=${new Date(Date.now() + 8 * 864e5).toISOString().slice(0, 10)}`, null, cliTok);
  // день+8 має інший day-of-week, для якого графік не заданий
  assert(r.status === 200 && r.data.length === 0, `empty on unscheduled weekday (got n=${r.data.length})`);

  // прибирання
  await p.refreshToken.deleteMany({ where: { user: { email: { in: [`sc${s}@t.dev`, `sk${s}@t.dev`] } } } });
  await p.availability.deleteMany({ where: { specialistId: spec.id } });
  await p.unavailability.deleteMany({ where: { specialistId: spec.id } });
  await p.specialistProfile.deleteMany({ where: { userId: spec.id } });
  await p.user.deleteMany({ where: { email: { in: [`sc${s}@t.dev`, `sk${s}@t.dev`] } } });
  await p.$disconnect();

  console.log(process.exitCode ? '\nSOME CHECKS FAILED' : '\nALL CHECKS PASSED');
})();
