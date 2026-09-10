import { z } from 'zod';

// Java CategoryManagementController приймав усе як @RequestParam; тут — JSON-тіла
// (RESTfully). Семантика полів та обмеження збережені.

export const categoryNameSchema = z
  .object({ name: z.string().trim().min(1).max(120) })
  .strict();
export type CategoryNameInput = z.infer<typeof categoryNameSchema>;

// CategoryItem: name, durationMinutes (>0), price (>0) — як у Java CategoryItemResponseDto.
export const categoryItemSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    durationMinutes: z.coerce.number().int().positive().max(24 * 60),
    price: z.coerce.number().positive().max(1_000_000),
  })
  .strict();
export type CategoryItemInput = z.infer<typeof categoryItemSchema>;
