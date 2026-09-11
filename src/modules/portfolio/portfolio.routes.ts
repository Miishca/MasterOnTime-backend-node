import { NextFunction, Response, Router } from 'express';
import { AuthedRequest, requireAuth, requireRole } from '../../middleware/auth';
import { HttpError } from '../../middleware/errorHandler';
import { addPortfolioItemSchema } from './portfolio.schemas';
import * as service from './portfolio.service';

// /api/specialist/portfolio — SPECIALIST-only self-service; публічний перегляд
// живе на /api/specialists/:id/portfolio (search module).
export const portfolioRouter = Router();

portfolioRouter.use(requireAuth, requireRole('SPECIALIST'));

const wrap =
  (fn: (req: AuthedRequest, res: Response) => Promise<unknown>) =>
  (req: AuthedRequest, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };

// GET /api/specialist/portfolio
portfolioRouter.get(
  '/',
  wrap(async (req, res) => {
    res.json(await service.listMyPortfolio(req.userId!));
  }),
);

// POST /api/specialist/portfolio
portfolioRouter.post(
  '/',
  wrap(async (req, res) => {
    const input = addPortfolioItemSchema.parse(req.body);
    res.status(201).json(await service.addPortfolioItem(req.userId!, input));
  }),
);

// DELETE /api/specialist/portfolio/:id
portfolioRouter.delete(
  '/:id',
  wrap(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'Invalid item id');
    await service.deletePortfolioItem(req.userId!, id);
    res.sendStatus(204);
  }),
);
