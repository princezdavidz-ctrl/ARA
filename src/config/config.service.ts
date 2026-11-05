import { Injectable, OnModuleInit } from '@nestjs/common';
import { z } from 'zod';

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
  WHATSAPP_AGENCY_ID: z.preprocess(value => value === '' ? undefined : value, z.string().uuid().optional()),
  WHATSAPP_PHONE_NUMBER_ID: z.preprocess(value => value === '' ? undefined : value, z.string().min(1).optional()),
  WHATSAPP_VERIFY_TOKEN: z.preprocess(value => value === '' ? undefined : value, z.string().min(32).optional()),
  WHATSAPP_APP_SECRET: z.preprocess(value => value === '' ? undefined : value, z.string().min(1).optional()),
  WHATSAPP_ACCESS_TOKEN: z.preprocess(value => value === '' ? undefined : value, z.string().min(1).optional()),
  EMAIL_AGENCY_ID: z.preprocess(value => value === '' ? undefined : value, z.string().uuid().optional()),
  EMAIL_RESEND_API_KEY: z.preprocess(value => value === '' ? undefined : value, z.string().min(1).optional()),
  EMAIL_FROM_ADDRESS: z.preprocess(value => value === '' ? undefined : value, z.string().email().optional()),
  EMAIL_WEBHOOK_SECRET: z.preprocess(value => value === '' ? undefined : value, z.string().min(32).optional()),
  WHATSAPP_API_VERSION: z.string().regex(/^v\d+\.\d+$/).default('v27.0'),
});
export type Config = z.infer<typeof schema>;

@Injectable()
export class ConfigService implements OnModuleInit {
  private value!: Config;
  onModuleInit(): void {
    const parsed = schema.safeParse(process.env);
    if (!parsed.success) throw new Error(parsed.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; '));
    const wa = parsed.data;
    const inboundConfigured = Boolean(wa.WHATSAPP_VERIFY_TOKEN || wa.WHATSAPP_APP_SECRET);
    if (inboundConfigured && !(wa.WHATSAPP_AGENCY_ID && wa.WHATSAPP_PHONE_NUMBER_ID && wa.WHATSAPP_VERIFY_TOKEN && wa.WHATSAPP_APP_SECRET)) {
      throw new Error('Inbound WhatsApp webhooks require WHATSAPP_AGENCY_ID, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_VERIFY_TOKEN and WHATSAPP_APP_SECRET.');
    }
    if (wa.WHATSAPP_ACCESS_TOKEN && !(wa.WHATSAPP_AGENCY_ID && wa.WHATSAPP_PHONE_NUMBER_ID)) {
      throw new Error('Outbound WhatsApp delivery requires WHATSAPP_AGENCY_ID and WHATSAPP_PHONE_NUMBER_ID.');
    }
    const emailAny = Boolean(wa.EMAIL_AGENCY_ID || wa.EMAIL_RESEND_API_KEY || wa.EMAIL_FROM_ADDRESS || wa.EMAIL_WEBHOOK_SECRET);
    if (emailAny && !(wa.EMAIL_AGENCY_ID && wa.EMAIL_RESEND_API_KEY && wa.EMAIL_FROM_ADDRESS && wa.EMAIL_WEBHOOK_SECRET)) {
      throw new Error('Email channel requires EMAIL_AGENCY_ID, EMAIL_RESEND_API_KEY, EMAIL_FROM_ADDRESS and EMAIL_WEBHOOK_SECRET together.');
    }
    this.value = wa;
  }
  get<K extends keyof Config>(key: K): Config[K] { return this.value[key]; }
}
