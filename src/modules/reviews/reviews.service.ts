import { prisma } from '../../config/db';
import { HttpError } from '../../middleware/errorHandler';
import { completeExpiredBookings } from '../booking/booking.service';
import { toReviewResponseDto, ReviewResponseDto } from './reviews.mapper';
import { ReviewBody } from './reviews.schemas';

const COMPLETED = 'COMPLETED';

async function loadBookingForReview(bookingId: number) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) throw new HttpError(404, 'Booking not found');
  return booking;
}

function assertReviewable(
  booking: { clientId: number | null; status: string },
  userId: number,
) {
  if (booking.clientId !== userId) {
    throw new HttpError(403, 'You can only review your own bookings');
  }
  if (booking.status.toUpperCase() !== COMPLETED) {
    throw new HttpError(409, 'You can only leave a review after the service is completed');
  }
}

// Не в Java: тримаємо SpecialistProfile.rating актуальним (середнє за видимими відгуками),
// бо від нього залежить фільтр minRating у пошуку.
async function recomputeSpecialistRating(specialistId: number) {
  const agg = await prisma.review.aggregate({
    where: { specialistId, status: 'VISIBLE' },
    _avg: { rating: true },
  });
  await prisma.specialistProfile.update({
    where: { id: specialistId },
    data: { rating: agg._avg.rating ?? 0 },
  });
}

async function createReview(
  bookingId: number,
  userId: number,
  body: ReviewBody,
): Promise<ReviewResponseDto> {
  await completeExpiredBookings();
  const booking = await loadBookingForReview(bookingId);
  assertReviewable(booking, userId);

  const existing = await prisma.review.findUnique({ where: { bookingId } });
  if (existing) {
    throw new HttpError(409, 'You have already reviewed this booking');
  }

  const review = await prisma.review.create({
    data: {
      bookingId,
      authorId: userId,
      specialistId: booking.specialistId,
      rating: body.rating,
      comment: body.comment ?? null,
    },
  });
  await recomputeSpecialistRating(booking.specialistId);
  return toReviewResponseDto(review);
}

// POST /api/reviews/booking/:bookingId
export const submitReview = (bookingId: number, userId: number, body: ReviewBody) =>
  createReview(bookingId, userId, body);

// POST /api/reviews  (bookingId у тілі)
export const addReview = (userId: number, input: ReviewBody & { bookingId: number }) =>
  createReview(input.bookingId, userId, input);

// GET /api/reviews/specialist — відгуки для автентифікованого спеціаліста
export async function getReviewsForSpecialist(specialistUserId: number): Promise<ReviewResponseDto[]> {
  const profile = await prisma.specialistProfile.findUnique({ where: { userId: specialistUserId } });
  if (!profile) throw new HttpError(404, 'Specialist profile not found for this user');
  const rows = await prisma.review.findMany({
    where: { specialistId: profile.id },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(toReviewResponseDto);
}

async function loadOwnReview(reviewId: number, userId: number) {
  const review = await prisma.review.findUnique({ where: { id: reviewId } });
  if (!review) throw new HttpError(404, 'Review not found');
  if (review.authorId !== userId) {
    throw new HttpError(403, 'You can only modify your own reviews');
  }
  return review;
}

// PUT /api/reviews/:id
export async function updateReview(
  reviewId: number,
  userId: number,
  body: ReviewBody,
): Promise<ReviewResponseDto> {
  const review = await loadOwnReview(reviewId, userId);
  const updated = await prisma.review.update({
    where: { id: reviewId },
    data: { rating: body.rating, comment: body.comment ?? null },
  });
  await recomputeSpecialistRating(review.specialistId);
  return toReviewResponseDto(updated);
}

// DELETE /api/reviews/:id
export async function deleteReview(reviewId: number, userId: number): Promise<void> {
  const review = await loadOwnReview(reviewId, userId);
  await prisma.review.delete({ where: { id: reviewId } });
  await recomputeSpecialistRating(review.specialistId);
}

// GET /api/reviews/can-review/:bookingId
export async function canReview(bookingId: number, userId: number): Promise<boolean> {
  await completeExpiredBookings();
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) return false;
  if (booking.clientId !== userId) return false;
  if (booking.status.toUpperCase() !== COMPLETED) return false;
  const existing = await prisma.review.findUnique({ where: { bookingId } });
  return existing === null;
}
