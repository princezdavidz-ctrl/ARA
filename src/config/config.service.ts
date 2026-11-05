import { Injectable, OnModuleInit } from '@nestjs/common';
import { z } from 'zod';

const optionalEnv = (schema: z.ZodTypeAny) => z.preprocess(value => value === '' ? undefined : value, schema.optional());
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().url(),
  OPENAI_API_KEY: z.string().min(20),
  OPENAI_CHAT_MODEL: z.string().default('gpt-4o-mini'),
  OPENAI_EMBEDDING_MODEL: z.string().default('text-embedding-3-small'),
  INGESTION_API_KEY: z.string().min(32),
  JWT_SECRET: z.string().min(32),
  RAG_TOP_K: z.coerce.number().int().min(1).max(20).default(6),
  RAG_MIN_SIMILARITY: z.coerce.number().min(0).max(1).default(0.28),
  WHATSAPP_AGENCY_ID: optionalEnv(z.string().uuid()),
  WHATSAPP_PHONE_NUMBER_ID: optionalEnv(z.string().min(1)),
  WHATSAPP_VERIFY_TOKEN: optionalEnv(z.string().min(32)),
  WHATSAPP_APP_SECRET: optionalEnv(z.string().min(1)),
});
export type Config = z.infer<typeof schema>;

@Injectable()
export class ConfigService implements OnModuleInit {
  private value!: Config;
  onModuleInit(): void {
    const parsed = schema.safeParse(process.env);
    if (!parsed.success) throw new Error(parsed.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; '));
    const wa = parsed.data;
    const values = [wa.WHATSAPP_AGENCY_ID, wa.WHATSAPP_PHONE_NUMBER_ID, wa.WHATSAPP_VERIFY_TOKEN, wa.WHATSAPP_APP_SECRET];
    if (values.some(Boolean) && !values.every(Boolean)) throw new Error('Configure all four WhatsApp variables together, or leave all four unset.');
    this.value = wa;
  }
  get<K extends keyof Config>(key: K): Config[K] { return this.value[key]; }
}
