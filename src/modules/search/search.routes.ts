import { NextFunction, Response, Router } from 'express';
import { AuthedRequest, requireAuth } from '../../middleware/auth';
import { searchQuerySchema } from './search.schemas';
import { searchSpecialists } from './search.service';

export const searchRouter = Router();

// GET /api/specialists/search — Java: @PreAuthorize("isAuthenticated()")
searchRouter.get(
  '/search',
  requireAuth,
  async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      const query = searchQuerySchema.parse(req.query);
      res.json(await searchSpecialists(query));
    } catch (err) {
      next(err);
    }
  },
);
