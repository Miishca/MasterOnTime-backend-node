import { z } from 'zod';

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
    profileImageUrl: z.string().optional(),
  })
  .refine((data) => data.password === data.repeatPassword, {
    message: 'Passwords do not match',
    path: ['repeatPassword'],
  });

export type RegistrationInput = z.infer<typeof registrationSchema>;
