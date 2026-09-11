// In-app сповіщення (не email — немає SMTP/сервісу; див. обговорення в PR).
// Раніше це був лог-стаб; тепер реально пише рядки в таблицю notifications,
// які фронт показує через дзвіночок у Header. Сигнатури функцій навмисно не
// змінились, щоб виклики в booking.service.ts лишились ті самі.
import { NotificationType } from '@prisma/client';
import { prisma } from '../config/db';

type BookingLike = { id: number; status: string; startTime: Date };

const fmt = (d: Date) =>
  d.toLocaleString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

async function push(
  userId: number,
  type: NotificationType,
  title: string,
  body: string,
  bookingId: number,
) {
  await prisma.notification.create({ data: { userId, type, title, body, bookingId } });
}

export const notifications = {
  bookingCreated: (booking: BookingLike, specialistUserId: number) =>
    push(
      specialistUserId,
      'BOOKING_CREATED',
      'New booking',
      `You have a new booking for ${fmt(booking.startTime)}.`,
      booking.id,
    ),
  bookingCancelled: (booking: BookingLike, recipientUserId: number | null) =>
    recipientUserId
      ? push(
          recipientUserId,
          'BOOKING_CANCELLED',
          'Booking cancelled',
          `The booking for ${fmt(booking.startTime)} was cancelled.`,
          booking.id,
        )
      : undefined,
  rescheduleProposed: (booking: BookingLike, clientUserId: number) =>
    push(
      clientUserId,
      'RESCHEDULE_PROPOSED',
      'Reschedule proposed',
      `A new time was proposed for your booking: ${fmt(booking.startTime)}.`,
      booking.id,
    ),
  rescheduleAccepted: (booking: BookingLike, specialistUserId: number) =>
    push(
      specialistUserId,
      'RESCHEDULE_ACCEPTED',
      'Reschedule accepted',
      `The client accepted the new time: ${fmt(booking.startTime)}.`,
      booking.id,
    ),
  rescheduleDeclined: (booking: BookingLike, specialistUserId: number) =>
    push(
      specialistUserId,
      'RESCHEDULE_DECLINED',
      'Reschedule declined',
      `The client declined the proposed time. Booking stays at ${fmt(booking.startTime)}.`,
      booking.id,
    ),
  reviewReceived: (specialistUserId: number, rating: number, bookingId: number) =>
    push(
      specialistUserId,
      'REVIEW_RECEIVED',
      'New review',
      `You received a new ${rating}-star review.`,
      bookingId,
    ),
};
