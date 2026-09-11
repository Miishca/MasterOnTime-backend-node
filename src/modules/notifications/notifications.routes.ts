import { NextFunction, Response, Router } from 'express';
import { AuthedRequest, requireAuth } from '../../middleware/auth';
import { HttpError } from '../../middleware/errorHandler';
import * as service from './notifications.service';

// /api/notifications — in-app сповіщення (заміна email, див. lib/notifications.ts).
export const notificationsRouter = Router();

notificationsRouter.use(requireAuth);

const wrap =
  (fn: (req: AuthedRequest, res: Response) => Promise<unknown>) =>
  (req: AuthedRequest, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };

// GET /api/notifications
notificationsRouter.get(
  '/',
  wrap(async (req, res) => {
    res.json(await service.listMyNotifications(req.userId!));
  }),
);

// GET /api/notifications/unread-count
notificationsRouter.get(
  '/unread-count',
  wrap(async (req, res) => {
    res.json({ count: await service.unreadCount(req.userId!) });
  }),
);

// POST /api/notifications/read-all
notificationsRouter.post(
  '/read-all',
  wrap(async (req, res) => {
    await service.markAllRead(req.userId!);
    res.sendStatus(204);
  }),
);

// PATCH /api/notifications/:id/read
notificationsRouter.patch(
  '/:id/read',
  wrap(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'Invalid notification id');
    await service.markRead(req.userId!, id);
    res.sendStatus(204);
  }),
);
