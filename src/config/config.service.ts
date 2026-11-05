import { Injectable, OnModuleInit } from '@nestjs/common';
import { z } from 'zod';
const schema=z.object({NODE_ENV:z.enum(['development','test','production']).default('development'),PORT:z.coerce.number().int().positive().default(3000),DATABASE_URL:z.string().url(),OPENAI_API_KEY:z.string().min(20),OPENAI_CHAT_MODEL:z.string().default('gpt-4o-mini'),OPENAI_EMBEDDING_MODEL:z.string().default('text-embedding-3-small'),INGESTION_API_KEY:z.string().min(32),JWT_SECRET:z.string().min(32),RAG_TOP_K:z.coerce.number().int().min(1).max(20).default(6),RAG_MIN_SIMILARITY:z.coerce.number().min(0).max(1).default(.28)});
export type Config=z.infer<typeof schema>;
@Injectable() export class ConfigService implements OnModuleInit { private value!:Config; onModuleInit(){const p=schema.safeParse(process.env);if(!p.success)throw new Error(p.error.issues.map(x=>`${x.path.join('.')}: ${x.message}`).join('; '));this.value=p.data;} get<K extends keyof Config>(key:K):Config[K]{return this.value[key];}}
