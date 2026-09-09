// Заглушка. Java-бекенд шле email + in-app нотифікації на події бронювання.
// Реальна реалізація — Фаза 6 (модулі notifications + email).
// Поки що просто лог, щоб було видно, де саме Java щось відправляв.

type BookingLike = { id: number; status: string };

function log(event: string, booking: BookingLike, recipientUserId?: number) {
  // eslint-disable-next-line no-console
  console.log(`[notify:stub] ${event} booking#${booking.id} (${booking.status})` +
    (recipientUserId ? ` -> user#${recipientUserId}` : ''));
}

export const notifications = {
  bookingCreated: (booking: BookingLike, specialistUserId: number) =>
    log('booking-created', booking, specialistUserId),
  bookingCancelled: (booking: BookingLike) => log('booking-cancelled', booking),
  rescheduleProposed: (booking: BookingLike, clientUserId: number) =>
    log('reschedule-proposed', booking, clientUserId),
  rescheduleAccepted: (booking: BookingLike, specialistUserId: number) =>
    log('reschedule-accepted', booking, specialistUserId),
  rescheduleDeclined: (booking: BookingLike, specialistUserId: number) =>
    log('reschedule-declined', booking, specialistUserId),
};
