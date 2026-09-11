import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { prisma } from './config/db';
import { authRouter } from './modules/auth/auth.routes';
import { usersRouter } from './modules/users/users.routes';
import { bookingRouter } from './modules/booking/booking.routes';
import { reviewsRouter } from './modules/reviews/reviews.routes';
import { scheduleRouter } from './modules/schedule/schedule.routes';
import { adminRouter } from './modules/admin/admin.routes';
import { searchRouter } from './modules/search/search.routes';
import { categoriesRouter } from './modules/categories/categories.routes';
import { notificationsRouter } from './modules/notifications/notifications.routes';
import { favoritesRouter } from './modules/favorites/favorites.routes';
import { portfolioRouter } from './modules/portfolio/portfolio.routes';
import { paymentsRouter } from './modules/payments/payments.routes';
import { errorHandler } from './middleware/errorHandler';

const app = express();

app.use(cors());
// Профільні фото приходять як base64 у JSON-тілі; дефолтний ліміт 100kb замалий.
app.use(express.json({ limit: '8mb' }));

// Перевірка живості: сервер + з'єднання з БД.
app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', db: 'up', time: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'degraded', db: 'down' });
  }
});

app.use('/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/specialists', searchRouter);
app.use('/api/bookings', bookingRouter);
app.use('/api/reviews', reviewsRouter);
app.use('/api/schedule', scheduleRouter);
app.use('/api/specialist/categories', categoriesRouter);
app.use('/api/specialist/portfolio', portfolioRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/favorites', favoritesRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/admin', adminRouter);

app.use(errorHandler);

const port = process.env.PORT ?? 8080;
app.listen(port, () => {
  console.log(`MasterOnTime backend listening on port ${port}`);
});
