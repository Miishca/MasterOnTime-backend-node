import { NextFunction, Response, Router } from 'express';
import { AuthedRequest, requireAuth, requireRole } from '../../middleware/auth';
import { HttpError } from '../../middleware/errorHandler';
import { categoryItemSchema, categoryNameSchema } from './categories.schemas';
import * as service from './categories.service';

// /api/specialist/categories — керування категоріями та послугами (лише спеціаліст,
// лише власними). Відповідає Java CategoryManagementController.
export const categoriesRouter = Router();

categoriesRouter.use(requireAuth, requireRole('SPECIALIST'));

const wrap =
  (fn: (req: AuthedRequest, res: Response) => Promise<unknown>) =>
  (req: AuthedRequest, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };

const intParam = (raw: string, label: string): number => {
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, `Invalid ${label}`);
  return n;
};

// GET /api/specialist/categories
categoriesRouter.get(
  '/',
  wrap(async (req, res) => {
    res.json(await service.listCategories(req.userId!));
  }),
);

// POST /api/specialist/categories  — { name }
categoriesRouter.post(
  '/',
  wrap(async (req, res) => {
    const { name } = categoryNameSchema.parse(req.body);
    res.status(201).json(await service.createCategory(req.userId!, name));
  }),
);

// PUT /api/specialist/categories/:id  — { name }
categoriesRouter.put(
  '/:id',
  wrap(async (req, res) => {
    const id = intParam(req.params.id, 'category id');
    const { name } = categoryNameSchema.parse(req.body);
    res.json(await service.updateCategory(req.userId!, id, name));
  }),
);

// DELETE /api/specialist/categories/:id
categoriesRouter.delete(
  '/:id',
  wrap(async (req, res) => {
    const id = intParam(req.params.id, 'category id');
    await service.deleteCategory(req.userId!, id);
    res.sendStatus(204);
  }),
);

// POST /api/specialist/categories/:categoryId/items  — { name, durationMinutes, price }
categoriesRouter.post(
  '/:categoryId/items',
  wrap(async (req, res) => {
    const categoryId = intParam(req.params.categoryId, 'category id');
    const input = categoryItemSchema.parse(req.body);
    res.status(201).json(await service.addItem(req.userId!, categoryId, input));
  }),
);

// PUT /api/specialist/categories/items/:id  — { name, durationMinutes, price }
categoriesRouter.put(
  '/items/:id',
  wrap(async (req, res) => {
    const id = intParam(req.params.id, 'service id');
    const input = categoryItemSchema.parse(req.body);
    res.json(await service.updateItem(req.userId!, id, input));
  }),
);

// DELETE /api/specialist/categories/items/:id
categoriesRouter.delete(
  '/items/:id',
  wrap(async (req, res) => {
    const id = intParam(req.params.id, 'service id');
    await service.deleteItem(req.userId!, id);
    res.sendStatus(204);
  }),
);
