import { NextFunction, Response, Router } from 'express';
import { AuthedRequest, requireAuth, requireRole } from '../../middleware/auth';
import { HttpError } from '../../middleware/errorHandler';
import * as service from './favorites.service';

// /api/favorites — юзер зберігає собі список спеціалістів.
export const favoritesRouter = Router();

favoritesRouter.use(requireAuth, requireRole('USER'));

const wrap =
  (fn: (req: AuthedRequest, res: Response) => Promise<unknown>) =>
  (req: AuthedRequest, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };

const specialistIdParam = (req: AuthedRequest): number => {
  const id = Number(req.params.specialistId);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'Invalid specialist id');
  return id;
};

// GET /api/favorites
favoritesRouter.get(
  '/',
  wrap(async (req, res) => {
    res.json(await service.listFavorites(req.userId!));
  }),
);

// GET /api/favorites/ids  (перед /:specialistId нижче — тут немає конфлікту path-структур,
// але лишаємо для симетрії з іншими модулями)
favoritesRouter.get(
  '/ids',
  wrap(async (req, res) => {
    res.json(await service.listFavoriteIds(req.userId!));
  }),
);

// POST /api/favorites/:specialistId
favoritesRouter.post(
  '/:specialistId',
  wrap(async (req, res) => {
    await service.addFavorite(req.userId!, specialistIdParam(req));
    res.sendStatus(204);
  }),
);

// DELETE /api/favorites/:specialistId
favoritesRouter.delete(
  '/:specialistId',
  wrap(async (req, res) => {
    await service.removeFavorite(req.userId!, specialistIdParam(req));
    res.sendStatus(204);
  }),
);
