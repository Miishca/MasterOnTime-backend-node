import { NextFunction, Request, Response, Router } from 'express';
import { loginSchema, registrationSchema } from './auth.schemas';
import { loginUser, registerUser } from './auth.service';

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
authRouter.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = loginSchema.parse(req.body);
    const result = await loginUser(input);
    res.json(result);
  } catch (err) {
    next(err);
  }
});
