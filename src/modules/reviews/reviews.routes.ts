import { NextFunction, Response, Router } from 'express';
import { AuthedRequest, requireAuth, requireRole } from '../../middleware/auth';
import { HttpError } from '../../middleware/errorHandler';
import { addReviewSchema, moderateReviewSchema, reviewBodySchema } from './reviews.schemas';
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

// POST /api/reviews/:id/flag — будь-який автентифікований юзер
reviewsRouter.post(
  '/:id/flag',
  requireRole('USER', 'SPECIALIST', 'ADMIN'),
  wrap(async (req, res) => {
    await service.flagReview(idParam(req, 'id'));
    res.sendStatus(204);
  }),
);

// GET /api/reviews/moderation  — ADMIN
reviewsRouter.get(
  '/moderation',
  requireRole('ADMIN'),
  wrap(async (_req, res) => {
    res.json(await service.listForModeration());
  }),
);

// PUT /api/reviews/:id/moderate — ADMIN
reviewsRouter.put(
  '/:id/moderate',
  requireRole('ADMIN'),
  wrap(async (req, res) => {
    const { status } = moderateReviewSchema.parse(req.body);
    res.json(await service.moderateReview(idParam(req, 'id'), status));
  }),
);

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
