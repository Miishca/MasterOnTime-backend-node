// Стан системи: бекенд, БД, кількість рядків. Запуск: node scripts/status.js
const { PrismaClient } = require('@prisma/client');

async function httpCheck(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    return `HTTP ${res.status}`;
  } catch {
    return 'НЕ ВІДПОВІДАЄ';
  }
}

(async () => {
  console.log('Бекенд  :8080/health  ->', await httpCheck('http://localhost:8080/health'));
  console.log('Фронтенд :5173       ->', await httpCheck('http://localhost:5173'));

  const p = new PrismaClient();
  try {
    await p.$queryRaw`SELECT 1`;
    const tables = await p.$queryRawUnsafe(
      "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name <> '_prisma_migrations' ORDER BY table_name",
    );
    console.log('\nБД masterontime (localhost:5432) -> up');
    console.log('  таблиці:', tables.map((t) => t.table_name).join(', '));
    const counts = {};
    for (const m of ['user', 'specialistProfile', 'booking', 'review', 'category', 'categoryItem', 'availability', 'unavailability']) {
      counts[m] = await p[m].count();
    }
    console.log('  рядки:', JSON.stringify(counts));
  } catch (e) {
    console.log('\nБД -> НЕДОСТУПНА:', String(e.message).split('\n')[0]);
  } finally {
    await p.$disconnect();
  }
})();
