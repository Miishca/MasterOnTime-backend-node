import { NextFunction, Response, Router } from 'express';
import { AuthedRequest, requireAuth, requireRole } from '../../middleware/auth';
import { HttpError } from '../../middleware/errorHandler';
import { listUsersQuerySchema, setRoleSchema } from './admin.schemas';
import { specialistProfileUpdateSchema } from '../search/search.schemas';
import { updateSpecialistProfile } from '../search/search.service';
import * as service from './admin.service';

export const adminRouter = Router();

adminRouter.use(requireAuth, requireRole('ADMIN'));

const wrap =
  (fn: (req: AuthedRequest, res: Response) => Promise<unknown>) =>
  (req: AuthedRequest, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };

// GET /api/admin/users?search=&role=
adminRouter.get(
  '/users',
  wrap(async (req, res) => {
    const q = listUsersQuerySchema.parse(req.query);
    res.json(await service.listUsers(q));
  }),
);

// PATCH /api/admin/users/:id/role
adminRouter.patch(
  '/users/:id/role',
  wrap(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'Invalid user id');
    const input = setRoleSchema.parse(req.body);
    res.json(await service.setUserRole(id, input));
  }),
);

// PATCH /api/admin/users/:id/specialist-profile — адмін править професійний
// профіль спеціаліста (для підтримки). Та сама логіка, що й у PUT /api/specialists/me.
adminRouter.patch(
  '/users/:id/specialist-profile',
  wrap(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'Invalid user id');
    const input = specialistProfileUpdateSchema.parse(req.body);
    res.json(await updateSpecialistProfile(id, input));
  }),
);
