import { prisma } from '../../config/db';
import { HttpError } from '../../middleware/errorHandler';
import {
  LIQPAY_CHECKOUT_URL,
  buildCardSaveCheckout,
  isLiqPayConfigured,
  liqpayStatus,
  makeCardSaveOrderId,
  orderIdBelongsToUser,
} from '../../lib/liqpay';

export interface SavedCardDto {
  cardMask: string;
  cardType: string | null;
  createdAt: string;
}

function toSavedCardDto(row: { cardMask: string; cardType: string | null; createdAt: Date }): SavedCardDto {
  return { cardMask: row.cardMask, cardType: row.cardType, createdAt: row.createdAt.toISOString() };
}

export interface CardSaveCheckout {
  checkoutUrl: string;
  data: string;
  signature: string;
}

// POST /api/payments/card/init — фронт бере {checkoutUrl, data, signature} і
// сабмітить прихованою формою (POST) на checkoutUrl — так LiqPay і очікує
// прийом параметрів для своєї hosted-сторінки введення картки.
export function startCardSave(userId: number): CardSaveCheckout {
  if (!isLiqPayConfigured()) {
    throw new HttpError(503, 'Card payments are not configured yet.');
  }
  const orderId = makeCardSaveOrderId(userId);
  const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173';
  const resultUrl = `${frontendUrl}/profile?cardSaveOrderId=${encodeURIComponent(orderId)}`;
  const { data, signature } = buildCardSaveCheckout(orderId, resultUrl);
  return { checkoutUrl: LIQPAY_CHECKOUT_URL, data, signature };
}

// POST /api/payments/card/confirm — фронт кличе це, коли LiqPay повернув
// користувача на result_url. Ми самі питаємо в LiqPay статус цього order_id
// (action:"status") і, якщо в відповіді є card_token, зберігаємо його.
export async function confirmCardSave(userId: number, orderId: string): Promise<SavedCardDto> {
  if (!orderIdBelongsToUser(orderId, userId)) {
    throw new HttpError(403, 'This order does not belong to you');
  }

  const result = await liqpayStatus(orderId);
  if (!result.card_token) {
    throw new HttpError(
      400,
      `Card was not saved (LiqPay status: ${result.status ?? result.err_description ?? 'unknown'}).`,
    );
  }

  const saved = await prisma.savedCard.upsert({
    where: { userId },
    create: {
      userId,
      cardToken: result.card_token,
      cardMask: result.sender_card_mask2 ?? '****',
      cardType: result.sender_card_type ?? null,
    },
    update: {
      cardToken: result.card_token,
      cardMask: result.sender_card_mask2 ?? '****',
      cardType: result.sender_card_type ?? null,
    },
  });
  return toSavedCardDto(saved);
}

// GET /api/payments/card
export async function getSavedCard(userId: number): Promise<SavedCardDto | null> {
  const row = await prisma.savedCard.findUnique({ where: { userId } });
  return row ? toSavedCardDto(row) : null;
}

// DELETE /api/payments/card
export async function deleteSavedCard(userId: number): Promise<void> {
  await prisma.savedCard.deleteMany({ where: { userId } });
}
