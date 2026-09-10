// Категорії та послуги спеціаліста (Фаза 6) + serviceName-пошук + бронювання з послугою.
// node scripts/smoke-categories.js   (сервер на :8080, ADMIN_* у .env)
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

async function reg(email) {
  return (await call('POST', '/auth/registration', {
    email, password: 'pass123', repeatPassword: 'pass123', firstName: 'Cat', lastName: 'Test',
    address: { country: 'UA', city: 'Lviv', street: 'S1', zip: '79000' },
  })).data;
}
const login = async (email, pw = 'pass123') => (await call('POST', '/auth/login', { email, password: pw })).data.token;

(async () => {
  const p = new PrismaClient();
  const s = Date.now();
  execSync('node scripts/seed-admin.js', { cwd: 'C:/Projects/MasterOnTime-backend-node', stdio: 'pipe' });
  const adminTok = await login(process.env.ADMIN_EMAIL, process.env.ADMIN_PASSWORD);

  const spec = await reg(`cs${s}@t.dev`);
  const other = await reg(`co${s}@t.dev`);
  const client = await reg(`cc${s}@t.dev`);
  await call('PATCH', `/api/admin/users/${spec.id}/role`, { role: 'SPECIALIST', profile: { profession: 'Barber', price: 40 } }, adminTok);
  await call('PATCH', `/api/admin/users/${other.id}/role`, { role: 'SPECIALIST', profile: { profession: 'Barber', price: 30 } }, adminTok);
  const specTok = await login(`cs${s}@t.dev`);
  const otherTok = await login(`co${s}@t.dev`);
  const clientTok = await login(`cc${s}@t.dev`);

  console.log('1) auth gate on /api/specialist/categories');
  assert((await call('GET', '/api/specialist/categories')).status === 401, 'guest 401');
  assert((await call('GET', '/api/specialist/categories', null, clientTok)).status === 403, 'USER 403');
  assert((await call('GET', '/api/specialist/categories', null, specTok)).status === 200, 'SPECIALIST 200');

  console.log('2) create category + items');
  let r = await call('POST', '/api/specialist/categories', { name: 'Haircuts' }, specTok);
  assert(r.status === 201 && r.data.name === 'Haircuts' && Array.isArray(r.data.items), 'category created');
  const catId = r.data.id;
  r = await call('POST', `/api/specialist/categories/${catId}/items`, { name: "Men's Haircut", durationMinutes: 30, price: 25 }, specTok);
  assert(r.status === 201 && r.data.name === "Men's Haircut" && r.data.durationMinutes === 30, 'item added');
  const itemId = r.data.id;
  r = await call('POST', `/api/specialist/categories/${catId}/items`, { name: 'Beard Trim', durationMinutes: 15, price: 12 }, specTok);
  const item2Id = r.data.id;

  console.log('3) list returns category with both items');
  r = await call('GET', '/api/specialist/categories', null, specTok);
  assert(r.status === 200 && r.data.length === 1 && r.data[0].items.length === 2, 'one category, two items');

  console.log('4) validation');
  assert((await call('POST', '/api/specialist/categories', { name: '' }, specTok)).status === 400, 'empty name 400');
  assert((await call('POST', `/api/specialist/categories/${catId}/items`, { name: 'X', durationMinutes: 0, price: 5 }, specTok)).status === 400, 'zero duration 400');
  assert((await call('POST', `/api/specialist/categories/${catId}/items`, { name: 'X', durationMinutes: 10, price: -1 }, specTok)).status === 400, 'negative price 400');
  assert((await call('POST', '/api/specialist/categories', { name: 'Y', extra: 1 }, specTok)).status === 400, 'unknown key 400 (strict)');

  console.log('5) ownership — other specialist cannot touch this category/item');
  assert((await call('PUT', `/api/specialist/categories/${catId}`, { name: 'Hacked' }, otherTok)).status === 404, 'update foreign category 404');
  assert((await call('DELETE', `/api/specialist/categories/${catId}`, null, otherTok)).status === 404, 'delete foreign category 404');
  assert((await call('PUT', `/api/specialist/categories/items/${itemId}`, { name: 'Hacked', durationMinutes: 5, price: 1 }, otherTok)).status === 404, 'update foreign item 404');
  assert((await call('DELETE', `/api/specialist/categories/items/${itemId}`, null, otherTok)).status === 404, 'delete foreign item 404');

  console.log('6) update category + item');
  r = await call('PUT', `/api/specialist/categories/${catId}`, { name: 'Hair & Beard' }, specTok);
  assert(r.status === 200 && r.data.name === 'Hair & Beard', 'category renamed');
  r = await call('PUT', `/api/specialist/categories/items/${itemId}`, { name: "Men's Cut", durationMinutes: 45, price: 30 }, specTok);
  assert(r.status === 200 && r.data.durationMinutes === 45 && r.data.price === 30, 'item updated');

  console.log('7) public GET /api/specialists/:id/services');
  r = await call('GET', `/api/specialists/${spec.id}/services`);
  assert(r.status === 200 && r.data.length === 1 && r.data[0].items.length === 2, 'public services listed');
  assert((await call('GET', `/api/specialists/${other.id}/services`)).data.length === 0, 'other specialist has none');
  assert((await call('GET', '/api/specialists/99999999/services')).status === 404, 'unknown specialist 404');

  console.log('8) serviceName search finds this specialist, not the other');
  r = await call('GET', '/api/specialists/search?serviceName=beard');
  assert(r.status === 200 && r.data.some((u) => u.id === spec.id) && !r.data.some((u) => u.id === other.id), 'serviceName=beard -> only spec');
  r = await call('GET', '/api/specialists/search?serviceName=nonsense-xyz');
  assert(Array.isArray(r.data) && r.data.length === 0, 'no match -> empty');
  r = await call('GET', '/api/specialists/search?categories=Hair%20%26%20Beard');
  assert(r.data.some((u) => u.id === spec.id), 'categories filter matches');

  console.log('9) booking with a serviceItem — slot length + priceAtBooking follow the service');
  const date = new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10);
  r = await call('GET', `/api/bookings/available-slots?specialistId=${spec.id}&serviceItemId=${item2Id}&date=${date}`, null, clientTok);
  assert(r.status === 200 && Array.isArray(r.data) && r.data.length > 0, 'slots returned for 15-min service');
  const slot = r.data[0];
  r = await call('POST', '/api/bookings', { specialistId: spec.id, serviceItemId: item2Id, startTime: slot }, clientTok);
  assert(r.status === 200 || r.status === 201, 'booking created');
  assert(r.data.serviceName === 'Beard Trim' && r.data.price === '12', 'serviceName + service price on booking');
  const bId = r.data.id;
  const bRow = await p.booking.findUnique({ where: { id: bId } });
  assert((new Date(bRow.endTime) - new Date(bRow.startTime)) / 60000 === 15, 'booking is 15 minutes long');

  console.log('10) booking rejects a serviceItem that belongs to another specialist');
  r = await call('POST', '/api/bookings', { specialistId: other.id, serviceItemId: item2Id, startTime: slot }, clientTok);
  assert(r.status === 404, 'foreign serviceItem -> 404');

  console.log('11) deleting a service detaches it from existing bookings (booking kept)');
  r = await call('DELETE', `/api/specialist/categories/items/${item2Id}`, null, specTok);
  assert(r.status === 204, 'item deleted');
  const after = await p.booking.findUnique({ where: { id: bId } });
  assert(after && after.serviceItemId === null, 'booking survived, serviceItemId nulled');

  console.log('12) delete category removes its items too');
  r = await call('DELETE', `/api/specialist/categories/${catId}`, null, specTok);
  assert(r.status === 204, 'category deleted');
  assert((await call('GET', '/api/specialist/categories', null, specTok)).data.length === 0, 'no categories left');
  assert((await p.categoryItem.count({ where: { id: itemId } })) === 0, 'remaining item gone');

  // прибирання
  await p.booking.deleteMany({ where: { clientId: { in: [client.id] } } });
  await p.category.deleteMany({ where: { specialistId: { in: [spec.id, other.id] } } });
  await p.specialistProfile.deleteMany({ where: { userId: { in: [spec.id, other.id] } } });
  await p.user.deleteMany({ where: { email: { in: [`cs${s}@t.dev`, `co${s}@t.dev`, `cc${s}@t.dev`] } } });
  await p.$disconnect();

  console.log(process.exitCode ? '\nSOME CHECKS FAILED' : '\nALL CHECKS PASSED');
})();
