import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { authRouter } from './modules/auth/auth.routes';
import { bookingRouter } from './modules/booking/booking.routes';
import { reviewsRouter } from './modules/reviews/reviews.routes';
import { searchRouter } from './modules/search/search.routes';
import { errorHandler } from './middleware/errorHandler';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/auth', authRouter);
app.use('/api/specialists', searchRouter);
app.use('/api/bookings', bookingRouter);
app.use('/api/reviews', reviewsRouter);

app.use(errorHandler);

const port = process.env.PORT ?? 8080;
app.listen(port, () => {
  console.log(`MasterOnTime backend listening on port ${port}`);
});
