import { NextFunction, Request, Response, Router } from 'express';
import { registrationSchema } from './auth.schemas';
import { registerUser } from './auth.service';

export const authRouter = Router();

// POST /auth/registration
authRouter.post('/registration', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = registrationSchema.parse(req.body);
    const user = await registerUser(input);
    res.status(201).json(user);
  } catch (err) {
    next(err);
  }
});

// POST /auth/login
authRouter.post('/login', (_req, res) => {
  res.status(501).json({ message: 'Not implemented yet' });
});
