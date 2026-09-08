import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { prisma } from './config/db';
import { authRouter } from './modules/auth/auth.routes';
import { usersRouter } from './modules/users/users.routes';
import { bookingRouter } from './modules/booking/booking.routes';
import { reviewsRouter } from './modules/reviews/reviews.routes';
import { searchRouter } from './modules/search/search.routes';
import { errorHandler } from './middleware/errorHandler';

const app = express();

app.use(cors());
app.use(express.json());

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

app.use(errorHandler);

const port = process.env.PORT ?? 8080;
app.listen(port, () => {
  console.log(`MasterOnTime backend listening on port ${port}`);
});
