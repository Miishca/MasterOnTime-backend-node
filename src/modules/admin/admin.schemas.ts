import { z } from 'zod';
import { industrySchema } from '../search/search.schemas';

// PATCH /api/admin/users/:id/role
// При підвищенні до SPECIALIST адмін може одразу задати поля профілю.
export const setRoleSchema = z.object({
  role: z.enum(['USER', 'SPECIALIST', 'ADMIN']),
  profile: z
    .object({
      profession: z.string().min(1).optional(),
      about: z.string().optional(),
      price: z.coerce.number().nonnegative().optional(),
      experience: z.coerce.number().int().nonnegative().optional(),
      tags: z.array(z.string()).optional(),
      industry: industrySchema.nullable().optional(),
    })
    .optional(),
});
export type SetRoleInput = z.infer<typeof setRoleSchema>;

// GET /api/admin/users?search=&role=
export const listUsersQuerySchema = z.object({
  search: z.string().trim().min(1).optional(),
  role: z.enum(['USER', 'SPECIALIST', 'ADMIN']).optional(),
});
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
