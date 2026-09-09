// Створює (або оновлює) одного ADMIN-користувача з ADMIN_EMAIL / ADMIN_PASSWORD у .env.
// Ідемпотентно — можна запускати повторно. Запуск: npm run seed:admin
require('dotenv/config');
const bcrypt = require('C:/Projects/MasterOnTime-backend-node/node_modules/bcrypt');
const { PrismaClient } = require('C:/Projects/MasterOnTime-backend-node/node_modules/@prisma/client');

(async () => {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD in .env first.');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('ADMIN_PASSWORD must be at least 8 characters.');
    process.exit(1);
  }

  const p = new PrismaClient();
  const passwordHash = await bcrypt.hash(password, 10);

  const user = await p.user.upsert({
    where: { email },
    update: { passwordHash, role: 'ADMIN', isDeleted: false },
    create: {
      email,
      passwordHash,
      role: 'ADMIN',
      firstName: 'Admin',
      lastName: 'User',
    },
  });

  console.log(`ADMIN ready: id=${user.id}  ${user.email}`);
  await p.$disconnect();
})();
