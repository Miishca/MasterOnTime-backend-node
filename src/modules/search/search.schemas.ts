import { z } from 'zod';

// Довільний список рядків із query (`?tags=a&tags=b` або `?tags=a`) ->
// нормалізований масив у нижньому регістрі (теги завжди зберігаються/шукаються
// в lower-case, щоб порівняння не залежало від регістру введення).
const stringListLower = z
  .union([z.string(), z.array(z.string())])
  .transform((v) =>
    (Array.isArray(v) ? v : [v]).map((s) => s.trim().toLowerCase()).filter(Boolean),
  );

// Query-параметри GET /api/specialists/search (відповідає Java SearchController,
// + tags — пошук по SpecialistProfile.tags, якого в Java не було).
// serviceName шукає в назвах послуг (CategoryItem.name), categories — по назвах
// категорій (Category.name), tags — довільні мітки, які спеціаліст сам додає собі
// в профілі (див. specialistProfileUpdateSchema нижче).
export const searchQuerySchema = z.object({
  serviceName: z.string().trim().min(1).optional(),
  firstName: z.string().trim().min(1).optional(),
  city: z.string().trim().min(1).optional(),
  categories: z
    .union([z.string(), z.array(z.string())])
    .transform((v) => (Array.isArray(v) ? v : [v]))
    .optional(),
  tags: stringListLower.optional(),
  minExperience: z.coerce.number().int().min(0).optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
});

export type SearchQuery = z.infer<typeof searchQuerySchema>;

// Поля профілю спеціаліста, які можна редагувати (self-service або адмін).
// rating сюди не входить — рахується з відгуків.
// tags нормалізуються в lower-case — так само, як у пошуковому фільтрі вище,
// інакше "Plumbing" в профілі ніколи не знайшлося б по запиту "plumbing".
export const specialistProfileUpdateSchema = z
  .object({
    profession: z.string().trim().max(120).optional(),
    about: z.string().trim().max(2000).optional(),
    price: z.coerce.number().nonnegative().max(1_000_000).optional(),
    experience: z.coerce.number().int().nonnegative().max(80).optional(),
    tags: z
      .array(z.string().trim().min(1).max(40).transform((s) => s.toLowerCase()))
      .max(20)
      .optional(),
  })
  .strict();

export type SpecialistProfileUpdate = z.infer<typeof specialistProfileUpdateSchema>;
