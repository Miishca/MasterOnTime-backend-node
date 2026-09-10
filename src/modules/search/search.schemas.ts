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

// Поля профілю спеціаліста, які можна редагувати (self-service або адмін).
// rating сюди не входить — рахується з відгуків.
export const specialistProfileUpdateSchema = z
  .object({
    profession: z.string().trim().max(120).optional(),
    about: z.string().trim().max(2000).optional(),
    price: z.coerce.number().nonnegative().max(1_000_000).optional(),
    experience: z.coerce.number().int().nonnegative().max(80).optional(),
    tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  })
  .strict();

export type SpecialistProfileUpdate = z.infer<typeof specialistProfileUpdateSchema>;
