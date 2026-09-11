import { z } from 'zod';
import { imageBase64Field } from '../auth/auth.schemas';

// Той самий підхід до фото, що й у auth/users: base64 без префікса "data:...",
// обмежений розмір (див. imageBase64Field).
export const addPortfolioItemSchema = z
  .object({
    imageBase64: imageBase64Field,
    caption: z.string().trim().max(200).optional(),
  })
  .strict();
export type AddPortfolioItemInput = z.infer<typeof addPortfolioItemSchema>;
