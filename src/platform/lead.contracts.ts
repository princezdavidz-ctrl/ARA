import { z } from 'zod';

const nullableText = (max: number) => z.string().trim().max(max).nullable().optional();
const contactFields = z.object({
  contactName: z.string().trim().min(2).max(160),
  email: z.string().trim().email().max(254).nullable().optional(),
  phone: z.string().trim().min(7).max(32).nullable().optional(),
  source: z.enum(['website','whatsapp','messenger','instagram','telegram','email','phone','referral','walk_in','other']).default('other'),
  interestedPurpose: z.enum(['rent','sale']).nullable().optional(),
  propertyId: z.string().uuid().nullable().optional(),
  conversationId: z.string().uuid().nullable().optional(),
  county: nullableText(80),
  town: nullableText(100),
  budgetMin: z.number().nonnegative().max(100000000000).nullable().optional(),
  budgetMax: z.number().nonnegative().max(100000000000).nullable().optional(),
  assignedUserId: z.string().uuid().nullable().optional(),
  followUpAt: z.string().datetime({ offset: true }).nullable().optional(),
});
export const leadCreateSchema = contactFields.superRefine((v, ctx) => {
  if (!v.email && !v.phone) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Provide an email address or phone number', path: ['phone'] });
  if (v.budgetMin != null && v.budgetMax != null && v.budgetMax < v.budgetMin) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'budgetMax must be greater than or equal to budgetMin', path: ['budgetMax'] });
});
export const leadUpdateSchema = contactFields.partial().superRefine((v, ctx) => {
  if (v.budgetMin != null && v.budgetMax != null && v.budgetMax < v.budgetMin) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'budgetMax must be greater than or equal to budgetMin', path: ['budgetMax'] });
});
export const leadStatusSchema = z.object({ status: z.enum(['new','contacted','qualified','viewing','won','lost']) });
export const leadNoteSchema = z.object({ body: z.string().trim().min(1).max(8000) });
export const leadQuerySchema = z.object({
  status: z.enum(['new','contacted','qualified','viewing','won','lost']).optional(),
  assignedUserId: z.string().uuid().optional(),
  source: z.enum(['website','whatsapp','messenger','instagram','telegram','email','phone','referral','walk_in','other']).optional(),
  search: z.string().trim().max(160).optional(),
  dueFollowUp: z.enum(['true','false']).transform(value => value === 'true').optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(100000).default(0),
});
export type LeadCreate = z.infer<typeof leadCreateSchema>;
