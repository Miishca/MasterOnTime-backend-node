import { z } from 'zod';

// Query-параметри GET /api/specialists/search (відповідає Java SearchController).
// serviceName та categories поки приймаються, але не застосовуються — потребують
// таблиць Category/CategoryItem (Фаза 6).
export const searchQuerySchema = z.object({
  serviceName: z.string().trim().min(1).optional(),
  firstName: z.string().trim().min(1).optional(),
  city: z.string().trim().min(1).optional(),
  categories: z
    .union([z.string(), z.array(z.string())])
    .transform((v) => (Array.isArray(v) ? v : [v]))
    .optional(),
  minExperience: z.coerce.number().int().min(0).optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
});

export type SearchQuery = z.infer<typeof searchQuerySchema>;
