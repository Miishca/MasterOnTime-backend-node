import { NextFunction, Response, Router } from 'express';
import { AuthedRequest, requireAuth, requireRole } from '../../middleware/auth';
import { availabilityListSchema, unavailabilitySchema } from './schedule.schemas';
import * as service from './schedule.service';

export const scheduleRouter = Router();

scheduleRouter.use(requireAuth, requireRole('SPECIALIST'));

const wrap =
  (fn: (req: AuthedRequest, res: Response) => Promise<unknown>) =>
  (req: AuthedRequest, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };

// PUT /api/schedule/availability  — тіло: масив { dayOfWeek, startTime, endTime }
scheduleRouter.put(
  '/availability',
  wrap(async (req, res) => {
    const items = availabilityListSchema.parse(req.body);
    await service.setAvailability(req.userId!, items);
    res.sendStatus(204);
  }),
);

// GET /api/schedule/availability
scheduleRouter.get(
  '/availability',
  wrap(async (req, res) => {
    res.json(await service.getAvailability(req.userId!));
  }),
);

// POST /api/schedule/unavailability  — тіло: { start, end }
scheduleRouter.post(
  '/unavailability',
  wrap(async (req, res) => {
    const input = unavailabilitySchema.parse(req.body);
    await service.addUnavailability(req.userId!, input);
    res.sendStatus(204);
  }),
);

// GET /api/schedule/unavailability
scheduleRouter.get(
  '/unavailability',
  wrap(async (req, res) => {
    res.json(await service.getUnavailabilities(req.userId!));
  }),
);
