import { NextFunction, Request, Response, Router } from 'express';
import {
  forgotPasswordLimiter,
  loginLimiter,
  refreshLimiter,
  registrationLimiter,
  resetPasswordLimiter,
} from '../../middleware/rateLimit';
import {
  forgotPasswordSchema,
  loginSchema,
  refreshTokenSchema,
  registrationSchema,
  resetPasswordSchema,
} from './auth.schemas';
import {
  loginUser,
  logoutUser,
  refreshAccessToken,
  registerUser,
  requestPasswordReset,
  resetPassword,
} from './auth.service';

export const authRouter = Router();

// POST /auth/registration
authRouter.post(
  '/registration',
  registrationLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = registrationSchema.parse(req.body);
      const user = await registerUser(input);
      res.status(201).json(user);
    } catch (err) {
      next(err);
    }
  },
);

// POST /auth/login
authRouter.post('/login', loginLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = loginSchema.parse(req.body);
    const result = await loginUser(input);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /auth/refresh — обмінює refresh-токен на нову пару (access + refresh, ротація).
authRouter.post('/refresh', refreshLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = refreshTokenSchema.parse(req.body);
    res.json(await refreshAccessToken(refreshToken));
  } catch (err) {
    next(err);
  }
});

// POST /auth/logout — відкликає саме цю сесію (refresh-токен).
authRouter.post('/logout', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = refreshTokenSchema.parse(req.body);
    await logoutUser(refreshToken);
    res.sendStatus(204);
  } catch (err) {
    next(err);
  }
});

// POST /auth/forgot-password — завжди 200, навіть для невідомого email (no enumeration).
// Поки немає email-сервісу: у не-проді додатково повертаємо сирий токен у
// відповіді (звична дев-практика "magic link у відповіді/консолі", поки
// реального провайдера листів не підключено) — і завжди логуємо на сервері.
authRouter.post(
  '/forgot-password',
  forgotPasswordLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email } = forgotPasswordSchema.parse(req.body);
      const rawToken = await requestPasswordReset(email);
      const devHint =
        process.env.NODE_ENV !== 'production' && rawToken ? { devResetToken: rawToken } : {};
      res.json({ message: 'If that email is registered, a reset link has been sent.', ...devHint });
    } catch (err) {
      next(err);
    }
  },
);

// POST /auth/reset-password
authRouter.post(
  '/reset-password',
  resetPasswordLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { token, password } = resetPasswordSchema.parse(req.body);
      await resetPassword(token, password);
      res.sendStatus(204);
    } catch (err) {
      next(err);
    }
  },
);
