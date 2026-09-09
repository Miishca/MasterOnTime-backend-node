import { z } from 'zod';

// Java ReviewRequestDto: rating 1..5, comment?, createdAt? (ігнорується), bookingId
export const reviewBodySchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
});
export type ReviewBody = z.infer<typeof reviewBodySchema>;

// POST /api/reviews (альтернативний вхід) — bookingId у тілі
export const addReviewSchema = reviewBodySchema.extend({
  bookingId: z.coerce.number().int().positive(),
});
export type AddReviewInput = z.infer<typeof addReviewSchema>;
