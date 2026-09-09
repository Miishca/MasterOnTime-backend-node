import { NextFunction, Response, Router } from 'express';
import { AuthedRequest, requireAuth, requireRole } from '../../middleware/auth';
import { HttpError } from '../../middleware/errorHandler';
import { addReviewSchema, reviewBodySchema } from './reviews.schemas';
import * as service from './reviews.service';

export const reviewsRouter = Router();

reviewsRouter.use(requireAuth);

const wrap =
  (fn: (req: AuthedRequest, res: Response) => Promise<unknown>) =>
  (req: AuthedRequest, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };

function idParam(req: AuthedRequest, name: string): number {
  const id = Number(req.params[name]);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, `Invalid ${name}`);
  return id;
}

// POST /api/reviews/booking/:bookingId
reviewsRouter.post(
  '/booking/:bookingId',
  requireRole('USER'),
  wrap(async (req, res) => {
    const body = reviewBodySchema.parse(req.body);
    res.status(201).json(await service.submitReview(idParam(req, 'bookingId'), req.userId!, body));
  }),
);

// POST /api/reviews  (bookingId у тілі)
reviewsRouter.post(
  '/',
  requireRole('USER'),
  wrap(async (req, res) => {
    const input = addReviewSchema.parse(req.body);
    res.status(201).json(await service.addReview(req.userId!, input));
  }),
);

// GET /api/reviews/specialist
reviewsRouter.get(
  '/specialist',
  requireRole('SPECIALIST'),
  wrap(async (req, res) => {
    res.json(await service.getReviewsForSpecialist(req.userId!));
  }),
);

// GET /api/reviews/can-review/:bookingId
reviewsRouter.get(
  '/can-review/:bookingId',
  requireRole('USER', 'SPECIALIST'),
  wrap(async (req, res) => {
    res.json(await service.canReview(idParam(req, 'bookingId'), req.userId!));
  }),
);

// GET /api/reviews/moderation  — Фаза 6 (admin)
reviewsRouter.get('/moderation', (_req, res) => {
  res.status(501).json({ message: 'Review moderation not implemented yet' });
});

// PUT /api/reviews/:id/moderate — Фаза 6 (admin)
reviewsRouter.put('/:id/moderate', (_req, res) => {
  res.status(501).json({ message: 'Review moderation not implemented yet' });
});

// PUT /api/reviews/:id
reviewsRouter.put(
  '/:id',
  requireRole('USER', 'SPECIALIST'),
  wrap(async (req, res) => {
    const body = reviewBodySchema.parse(req.body);
    res.json(await service.updateReview(idParam(req, 'id'), req.userId!, body));
  }),
);

// DELETE /api/reviews/:id
reviewsRouter.delete(
  '/:id',
  requireRole('USER', 'SPECIALIST'),
  wrap(async (req, res) => {
    await service.deleteReview(idParam(req, 'id'), req.userId!);
    res.sendStatus(204);
  }),
);
