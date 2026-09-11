import { NextFunction, Request, Response, Router } from 'express';
import { forgotPasswordSchema, loginSchema, registrationSchema, resetPasswordSchema } from './auth.schemas';
import { loginUser, registerUser, requestPasswordReset, resetPassword } from './auth.service';

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

// POST /auth/forgot-password — завжди 200, навіть для невідомого email (no enumeration).
// Поки немає email-сервісу: у не-проді додатково повертаємо сирий токен у
// відповіді (звична дев-практика "magic link у відповіді/консолі", поки
// реального провайдера листів не підключено) — і завжди логуємо на сервері.
authRouter.post('/forgot-password', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = forgotPasswordSchema.parse(req.body);
    const rawToken = await requestPasswordReset(email);
    const devHint =
      process.env.NODE_ENV !== 'production' && rawToken ? { devResetToken: rawToken } : {};
    res.json({ message: 'If that email is registered, a reset link has been sent.', ...devHint });
  } catch (err) {
    next(err);
  }
});

// POST /auth/reset-password
authRouter.post('/reset-password', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token, password } = resetPasswordSchema.parse(req.body);
    await resetPassword(token, password);
    res.sendStatus(204);
  } catch (err) {
    next(err);
  }
});
