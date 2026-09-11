import { NextFunction, Response, Router } from 'express';
import { AuthedRequest, requireAuth } from '../../middleware/auth';
import { confirmCardSaveSchema } from './payments.schemas';
import * as service from './payments.service';

// /api/payments — картка на /profile (LiqPay, "лише зберегти", без автосписань).
export const paymentsRouter = Router();

paymentsRouter.use(requireAuth);

const wrap =
  (fn: (req: AuthedRequest, res: Response) => Promise<unknown>) =>
  (req: AuthedRequest, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };

// POST /api/payments/card/init
paymentsRouter.post(
  '/card/init',
  wrap(async (req, res) => {
    res.json(service.startCardSave(req.userId!));
  }),
);

// POST /api/payments/card/confirm
paymentsRouter.post(
  '/card/confirm',
  wrap(async (req, res) => {
    const { orderId } = confirmCardSaveSchema.parse(req.body);
    res.json(await service.confirmCardSave(req.userId!, orderId));
  }),
);

// GET /api/payments/card
paymentsRouter.get(
  '/card',
  wrap(async (req, res) => {
    res.json(await service.getSavedCard(req.userId!));
  }),
);

// DELETE /api/payments/card
paymentsRouter.delete(
  '/card',
  wrap(async (req, res) => {
    await service.deleteSavedCard(req.userId!);
    res.sendStatus(204);
  }),
);
