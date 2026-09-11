import crypto from 'crypto';

// LiqPay: підпис БУДЬ-ЯКОГО запиту (і checkout-форми на liqpay.ua, і серверних
// викликів /api/request) — це base64(JSON), а signature —
// base64(sha1(private_key + data + private_key)) (сирий бінарний дайджест,
// не hex-рядок, інакше підпис не збіжиться на боці LiqPay).
// Джерело: офіційна liqpay/sdk-nodejs + liqpay.ua/doc/api (алгоритм підпису
// підтверджено кількома незалежними джерелами — фактична сторінка
// liqpay.ua/en/doc/api рендериться через JS і недоступна для прямого фетчу).
const PUBLIC_KEY = process.env.LIQPAY_PUBLIC_KEY ?? '';
const PRIVATE_KEY = process.env.LIQPAY_PRIVATE_KEY ?? '';

export const LIQPAY_CHECKOUT_URL = 'https://www.liqpay.ua/api/3/checkout';
const LIQPAY_REQUEST_URL = 'https://www.liqpay.ua/api/request';

export function isLiqPayConfigured(): boolean {
  return Boolean(PUBLIC_KEY && PRIVATE_KEY);
}

function sign(data: string): string {
  return crypto.createHash('sha1').update(PRIVATE_KEY + data + PRIVATE_KEY, 'utf8').digest('base64');
}

export function buildSignedParams(params: Record<string, unknown>): { data: string; signature: string } {
  const data = Buffer.from(JSON.stringify(params), 'utf8').toString('base64');
  return { data, signature: sign(data) };
}

export function verifySignature(data: string, signature: string): boolean {
  return sign(data) === signature;
}

interface LiqPayApiResult {
  status?: string;
  card_token?: string;
  sender_card_mask2?: string;
  sender_card_type?: string;
  err_code?: string;
  err_description?: string;
  [key: string]: unknown;
}

// Серверний виклик /api/request з action:"status" — навмисно замінює
// LiqPay-callback (server_url): callback має достукатись до нас ЗЗОВНІ, а
// localhost при розробці ззовні недосяжний без тунелю (ngrok тощо). Натомість
// ми самі, з нашого сервера, питаємо в LiqPay статус конкретного order_id
// одразу після того, як браузер користувача повернувся на result_url — це
// працює однаково і локально, і в проді.
export async function liqpayStatus(orderId: string): Promise<LiqPayApiResult> {
  const { data, signature } = buildSignedParams({
    version: 3,
    public_key: PUBLIC_KEY,
    action: 'status',
    order_id: orderId,
  });
  const res = await fetch(LIQPAY_REQUEST_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ data, signature }),
  });
  return (await res.json()) as LiqPayApiResult;
}

const CARD_SAVE_AMOUNT = 1; // мінімальна сума — гроші не списуються, див. нижче
const CARD_SAVE_CURRENCY = 'UAH';

// "Лише зберегти картку": action:"hold" — двостадійна оплата. Цей запит лише
// БЛОКУЄ суму на картці (як застава при оренді авто), а не переказує її
// продавцю. Реальне списання відбулось би тільки окремим викликом
// action:"hold_completion" — якщо ми його ніколи не робимо (а ми навмисно
// цього не робимо), гроші так і не переходять нам, і hold сам звільниться
// на боці банку. recurringbytoken:1 просить LiqPay повернути card_token у
// відповіді на status — саме він і зберігається як "прив'язана картка".
export function buildCardSaveCheckout(
  orderId: string,
  resultUrl: string,
): { data: string; signature: string } {
  return buildSignedParams({
    version: 3,
    public_key: PUBLIC_KEY,
    action: 'hold',
    amount: CARD_SAVE_AMOUNT,
    currency: CARD_SAVE_CURRENCY,
    description: 'Card verification for MasterOnTime (not charged)',
    order_id: orderId,
    result_url: resultUrl,
    recurringbytoken: 1,
    language: 'uk',
  });
}

// order_id несе userId у собі, бо на GET /api/payments/card/confirm у нас
// немає окремої "pending"-таблиці — це прийнятно, бо confirm однаково
// перевіряє факт card_token у відповіді LiqPay, а не довіряє самому order_id
// сліпо для чогось важливішого за "чий це запит".
export function makeCardSaveOrderId(userId: number): string {
  return `card-save-${userId}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
}

export function orderIdBelongsToUser(orderId: string, userId: number): boolean {
  return orderId.startsWith(`card-save-${userId}-`);
}
