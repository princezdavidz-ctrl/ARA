import { z } from 'zod';

const category=z.string().trim().min(1).max(64).regex(/^[a-z][a-z0-9_-]*$/);

export const knowledgeSchema=z.object({
  title:z.string().trim().min(2).max(300),
  category,
  language:z.enum(['en','sw','both']),
  content:z.string().trim().min(20).max(100000),
  sourceRef:z.string().trim().max(200).optional(),
  knowledgeBaseId:z.string().uuid().optional(),
  metadata:z.record(z.unknown()).default({})
});

export const answerSchema=z.object({
  message:z.string().trim().min(2).max(5000),
  preferredLanguage:z.enum(['en','sw','auto']).default('auto'),
  filters:z.object({
    category:category.optional(),
    knowledgeBaseId:z.string().uuid().optional(),
    metadata:z.record(z.unknown()).default({}),
    // Backward-compatible real-estate filters; these are translated into metadata filters.
    location:z.string().max(120).optional(),
    propertyType:z.string().max(80).optional(),
    purpose:z.enum(['rent','sale']).optional(),
    bedrooms:z.number().int().min(0).max(20).optional(),
    maxPrice:z.number().positive().optional()
  }).default({})
});

export type KnowledgeInput=z.infer<typeof knowledgeSchema>;
export type AnswerInput=z.infer<typeof answerSchema>;
export type Chunk={documentId:string;title:string;category:string;language:string;content:string;metadata:Record<string,unknown>;similarity:number;retrievalMethod?:'semantic'|'keyword'};
