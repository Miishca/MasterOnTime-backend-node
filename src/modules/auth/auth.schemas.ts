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
    // Java-DTO вимагає role; старий сервіс його ігнорував — ми поважаємо (D3).
    role: z.enum(['USER', 'SPECIALIST', 'ADMIN']).default('USER'),
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
