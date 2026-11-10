import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { ConfigService } from '../config/config.service';
import { OpenAiEmbeddingResult } from '../llm/openai.service';

@Injectable()
export class EmbeddingUsageService {
  private readonly logger = new Logger(EmbeddingUsageService.name);
  constructor(private db: DatabaseService, private config: ConfigService) {}

  async record(
    agencyId: string,
    usage: OpenAiEmbeddingResult,
    idempotencyKey: string,
    context: { operation: 'document_ingestion' | 'query_retrieval'; knowledgeBaseId?: string; channel?: string; conversationId?: string | null; messageId?: string | null },
  ): Promise<void> {
    const quantity = usage.inputTokens;
    if (!Number.isSafeInteger(quantity) || Number(quantity) <= 0) return;
    const rate = this.config.get('AI_EMBEDDING_INPUT_USD_PER_1M_TOKENS');
    const estimatedCostUsd = rate === undefined ? null : Number((Number(quantity) * rate / 1_000_000).toFixed(10));
    const metadata = {
      provider: 'openai',
      model: usage.model,
      operation: context.operation,
      tokenType: 'embedding_input',
      knowledgeBaseId: context.knowledgeBaseId ?? null,
      channel: context.channel ?? null,
      conversationId: context.conversationId ?? null,
      messageId: context.messageId ?? null,
      estimatedCostUsd,
      pricingSource: rate === undefined ? null : 'environment_config',
      pricePerMillionUsd: rate ?? null,
    };
    try {
      await this.db.query(`INSERT INTO usage_records(agency_id,subscription_id,metric,quantity,idempotency_key,metadata)
        VALUES($1,(SELECT id FROM company_subscriptions WHERE agency_id=$1 AND status IN ('active','trialing','past_due') AND current_period_start<=now() AND current_period_end>now() ORDER BY created_at DESC LIMIT 1),'token_input',$2,$3,$4::jsonb)
        ON CONFLICT(agency_id,idempotency_key) DO NOTHING`, [
        agencyId, quantity, idempotencyKey, JSON.stringify(metadata),
      ]);
    } catch (error) {
      this.logger.warn('Embedding usage telemetry write failed: ' + (error instanceof Error ? error.name : 'UnknownError'));
    }
  }
}
