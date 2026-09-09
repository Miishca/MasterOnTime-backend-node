import { z } from 'zod';

// base64 без префікса "data:image/...;base64,". ~4.2M символів ≈ 3 МБ зображення.
export const imageBase64Field = z
  .string()
  .max(4_200_000, 'The image is too large (about 3 MB max).');

export const registrationSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(1),
    repeatPassword: z.string().min(1),
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    address: z.object({
      country: z.string().min(1),
      city: z.string().min(1),
      street: z.string().min(1),
      zip: z.string().min(1),
    }),
    phoneNumber: z.string().optional(),
    // фронт шле файл, читаний через FileReader
    profileImageBase64: imageBase64Field.optional(),
  })
  .refine((data) => data.password === data.repeatPassword, {
    message: 'Passwords do not match',
    path: ['repeatPassword'],
  });

export type RegistrationInput = z.infer<typeof registrationSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type LoginInput = z.infer<typeof loginSchema>;
