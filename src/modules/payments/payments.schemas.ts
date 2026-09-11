import { z } from 'zod';

export const confirmCardSaveSchema = z.object({ orderId: z.string().min(1) }).strict();
export type ConfirmCardSaveInput = z.infer<typeof confirmCardSaveSchema>;
