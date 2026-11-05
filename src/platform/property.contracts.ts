import { z } from 'zod';

export const propertyCreateSchema = z.object({
  sourceRef: z.string().trim().min(1).max(120),
  title: z.string().trim().min(3).max(250),
  description: z.string().trim().min(20).max(12000),
  purpose: z.enum(['rent','sale']),
  propertyType: z.string().trim().min(2).max(80),
  county: z.string().trim().min(2).max(80),
  town: z.string().trim().max(100).optional(),
  area: z.string().trim().max(100).optional(),
  price: z.number().positive().max(100000000000),
  bedrooms: z.number().int().min(0).max(30).optional(),
  bathrooms: z.number().int().min(0).max(30).optional(),
  sizeSqm: z.number().positive().max(10000000).optional(),
  language: z.enum(['en','sw','both']).default('both'),
});
export const propertyUpdateSchema = propertyCreateSchema.partial().omit({sourceRef:true});
export const propertyQuerySchema = z.object({
  purpose: z.enum(['rent','sale']).optional(),
  county: z.string().trim().max(80).optional(),
  town: z.string().trim().max(100).optional(),
  status: z.enum(['available','reserved','let','sold','inactive']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type PropertyCreate = z.infer<typeof propertyCreateSchema>;
