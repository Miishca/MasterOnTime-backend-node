import { z } from 'zod';

// Відповідає Java UserProfileUpdateRequestDto. Усі поля опційні — на відміну від
// Java, оновлюємо лише передані ключі (Java наосліп перезаписував усе).
export const updateProfileSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phoneNumber: z.string().nullable().optional(),
  address: z
    .object({
      country: z.string().min(1),
      city: z.string().min(1),
      street: z.string().min(1),
      zip: z.string().min(1),
    })
    .partial()
    .optional(),
  profileImageBase64: z.string().optional(),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')
    .nullable()
    .optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).nullable().optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
