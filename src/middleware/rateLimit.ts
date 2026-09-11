// Обмежує лише чутливі auth-ендпоінти (брутфорс/спам), не весь API.
// Ключ за замовчуванням — IP (express-rate-limit); цього достатньо проти
// найпростішого перебору з однієї адреси. Розподілений credential-stuffing
// це не зупинить — для того потрібен окремий сервіс (Cloudflare/WAF тощо).
import rateLimit from 'express-rate-limit';

const MINUTES = 60_000;

// Лічильники — per-process пам'ять (express-rate-limit default MemoryStore).
// Це означає: (a) скидається при рестарті сервера, (b) не ділиться між
// кількома інстансами за балансувальником — для того знадобився б
// Redis-based store (rate-limit-redis), тут поки не потрібен.
//
// У dev/smoke-тестах один і той самий процес б'є /auth/login/refresh тощо
// десятки разів поспіль (11+ smoke-скриптів) — це легко перевищило б будь-який
// розумний ліміт і зафлудило б розробнику власний логін на весь час вікна.
// Тому лімітери реально діють лише коли NODE_ENV === 'production' — той самий
// підхід, що вже є в auth.routes.ts для приховування devResetToken. Це не
// "вимкнено назавжди": на проді (де це і потрібно) вони одразу активні без
// додаткового коду.
const skipOutsideProduction = () => process.env.NODE_ENV !== 'production';

// Логін: 10 спроб на 15 хв з однієї IP.
export const loginLimiter = rateLimit({
  windowMs: 15 * MINUTES,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipOutsideProduction,
  message: { message: 'Too many login attempts. Please try again later.' },
});

// Forgot-password: 5 на годину — це і спам-стіна, і захист від зайвого
// навантаження (кожен виклик пише токен у БД).
export const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * MINUTES,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipOutsideProduction,
  message: { message: 'Too many password reset requests. Please try again later.' },
});

// Reset-password: перебір самих токенів (не email) — трохи щедріше.
export const resetPasswordLimiter = rateLimit({
  windowMs: 15 * MINUTES,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipOutsideProduction,
  message: { message: 'Too many attempts. Please request a new reset link.' },
});

// Реєстрація: м'якше — не хочемо блокувати легітимних юзерів за спільною IP
// (NAT/офіс/кампус), лише відсікти масовий спам акаунтів.
export const registrationLimiter = rateLimit({
  windowMs: 60 * MINUTES,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipOutsideProduction,
  message: { message: 'Too many registrations from this network. Please try again later.' },
});

// Refresh: легітимно може відбуватись доволі часто (кожен новий access-токен).
export const refreshLimiter = rateLimit({
  windowMs: 15 * MINUTES,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipOutsideProduction,
  message: { message: 'Too many refresh attempts. Please log in again.' },
});
