import { z } from 'zod';

export const medicationOrderMetaSchema = z.object({
  medicationCatalogId: z.string().min(1),
  dose: z.string().min(1),
  frequency: z.string().min(1),
  route: z.string().min(1),
  duration: z.string().min(1),
  quantity: z.string().min(1),
  prescribedById: z.string().min(1),
  prescribedAt: z.string().datetime(),
  instructions: z.string().optional(),
  indication: z.string().optional(),
  prn: z.boolean().optional(),
  form: z.string().optional(),
  strength: z.string().optional(),
});
