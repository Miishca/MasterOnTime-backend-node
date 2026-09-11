import { Review } from '@prisma/client';

// Java ReviewResponseDto. specialistId = SpecialistProfile id; clientId = author (User) id.
export interface ReviewResponseDto {
  id: number;
  clientId: number;
  specialistId: number;
  rating: number;
  comment: string | null;
  createdAt: Date;
}

export function toReviewResponseDto(r: Review): ReviewResponseDto {
  return {
    id: r.id,
    clientId: r.authorId,
    specialistId: r.specialistId,
    rating: r.rating,
    comment: r.comment,
    createdAt: r.createdAt,
  };
}

// GET /api/reviews/moderation — адміну потрібен ще й статус, якого немає в
// публічному ReviewResponseDto.
export interface ModerationReviewDto extends ReviewResponseDto {
  status: string;
}

export function toModerationReviewDto(r: Review): ModerationReviewDto {
  return { ...toReviewResponseDto(r), status: r.status };
}
