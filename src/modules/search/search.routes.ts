import { NextFunction, Request, Response, Router } from 'express';
import { AuthedRequest, requireAuth, requireRole } from '../../middleware/auth';
import { HttpError } from '../../middleware/errorHandler';
import { searchQuerySchema, specialistProfileUpdateSchema } from './search.schemas';
import {
  getMySpecialistProfile,
  getSpecialistById,
  getSpecialistReviews,
  listSpecialists,
  searchSpecialists,
  updateSpecialistProfile,
} from './search.service';

// /api/specialists — публічний каталог (гість бачить лише PublicSpecialistDto,
// без контактів / адреси / ДН) + self-service профіль для самого спеціаліста.
export const searchRouter = Router();

const wrap =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };

// GET /api/specialists  — публічно
searchRouter.get(
  '/',
  wrap(async (_req, res) => {
    res.json(await listSpecialists());
  }),
);

// GET /api/specialists/search  — публічно
searchRouter.get(
  '/search',
  wrap(async (req, res) => {
    const query = searchQuerySchema.parse(req.query);
    res.json(await searchSpecialists(query));
  }),
);

// GET /api/specialists/me  — власний профіль спеціаліста (має бути ПЕРЕД /:id)
searchRouter.get(
  '/me',
  requireAuth,
  requireRole('SPECIALIST'),
  wrap(async (req, res) => {
    res.json(await getMySpecialistProfile((req as AuthedRequest).userId!));
  }),
);

// PUT /api/specialists/me  — спеціаліст редагує свій профіль
searchRouter.put(
  '/me',
  requireAuth,
  requireRole('SPECIALIST'),
  wrap(async (req, res) => {
    const input = specialistProfileUpdateSchema.parse(req.body);
    res.json(await updateSpecialistProfile((req as AuthedRequest).userId!, input));
  }),
);

// GET /api/specialists/:id  — публічно (ПІСЛЯ /search та /me)
searchRouter.get(
  '/:id',
  wrap(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'Invalid specialist id');
    res.json(await getSpecialistById(id));
  }),
);

// GET /api/specialists/:id/reviews — публічно
searchRouter.get(
  '/:id/reviews',
  wrap(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'Invalid specialist id');
    res.json(await getSpecialistReviews(id));
  }),
);
