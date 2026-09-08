import { NextFunction, Response, Router } from 'express';
import { AuthedRequest, requireAuth } from '../../middleware/auth';
import { getAllSpecialists, getUserById, updateUserProfile } from './users.service';
import { updateProfileSchema } from './users.schemas';

export const usersRouter = Router();

// GET /api/users/specialists — публічний список (потрібен лише валідний JWT, як у Java SecurityConfig).
usersRouter.get(
  '/specialists',
  requireAuth,
  async (_req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      res.json(await getAllSpecialists());
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/users/me
usersRouter.get(
  '/me',
  requireAuth,
  async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      res.json(await getUserById(req.userId!));
    } catch (err) {
      next(err);
    }
  },
);

// PUT /api/users/me
usersRouter.put(
  '/me',
  requireAuth,
  async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      const input = updateProfileSchema.parse(req.body);
      res.json(await updateUserProfile(req.userId!, input));
    } catch (err) {
      next(err);
    }
  },
);
