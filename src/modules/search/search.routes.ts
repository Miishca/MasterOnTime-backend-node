import { Router } from 'express';

export const searchRouter = Router();

// GET /api/specialists/search
searchRouter.get('/search', (_req, res) => {
  res.status(501).json({ message: 'Not implemented yet' });
});
