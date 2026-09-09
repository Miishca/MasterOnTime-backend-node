import { NextFunction, Request, Response, Router } from 'express';
import { HttpError } from '../../middleware/errorHandler';
import { searchQuerySchema } from './search.schemas';
import { getSpecialistById, listSpecialists, searchSpecialists } from './search.service';

// Публічний роутер — гість може переглядати каталог спеціалістів без входу.
// Віддає лише PublicSpecialistDto (без контактів / адреси / ДН).
export const searchRouter = Router();

const wrap =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };

// GET /api/specialists
searchRouter.get(
  '/',
  wrap(async (_req, res) => {
    res.json(await listSpecialists());
  }),
);

// GET /api/specialists/search?serviceName=&firstName=&city=&minExperience=&minRating=
searchRouter.get(
  '/search',
  wrap(async (req, res) => {
    const query = searchQuerySchema.parse(req.query);
    res.json(await searchSpecialists(query));
  }),
);

// GET /api/specialists/:id  (має бути ПІСЛЯ /search)
searchRouter.get(
  '/:id',
  wrap(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'Invalid specialist id');
    res.json(await getSpecialistById(id));
  }),
);
