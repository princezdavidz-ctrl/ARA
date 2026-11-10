import { Module } from '@nestjs/common';
import { ConfigService } from './config/config.service';
import { DatabaseService } from './database/database.service';
import { OpenAiService } from './llm/openai.service';
import { AiOrchestratorService } from './llm/ai-orchestrator.service';
import { HealthController } from './http/health.controller';
import { KnowledgeController } from './http/knowledge.controller';
import { AnswerController } from './http/answer.controller';
import { IngestionService } from './rag/ingestion.service';
import { RetrievalService } from './rag/retrieval.service';
import { EmbeddingUsageService } from './rag/embedding-usage.service';
import { AnswerService } from './rag/answer.service';
import { AiUsageQuotaService } from './rag/ai-usage-quota.service';
import { PlatformModule } from './platform/platform.module';
import { MessageWorker } from './platform/message-worker.service';
import { WhatsAppWebhookController } from './platform/whatsapp-webhook.controller';
import { WhatsAppWebhookService } from './platform/whatsapp-webhook.service';
import { PropertyController } from './platform/property.controller';
import { PropertyService } from './platform/property.service';
import { DashboardController } from './platform/dashboard.controller';
import { EmailWebhookController } from './platform/email-webhook.controller';
import { EmailWebhookService } from './platform/email-webhook.service';
import { InstagramWebhookController } from './platform/instagram-webhook.controller';
import { InstagramWebhookService } from './platform/instagram-webhook.service';
import { TikTokWebhookController } from './platform/tiktok-webhook.controller';
import { TikTokWebhookService } from './platform/tiktok-webhook.service';
@Module({
  imports: [PlatformModule],
  controllers: [HealthController, KnowledgeController, AnswerController, WhatsAppWebhookController, EmailWebhookController, InstagramWebhookController, TikTokWebhookController, PropertyController, DashboardController],
  providers: [ConfigService, DatabaseService, OpenAiService, AiOrchestratorService, IngestionService, RetrievalService, EmbeddingUsageService, AiUsageQuotaService, AnswerService, MessageWorker, WhatsAppWebhookService, EmailWebhookService, InstagramWebhookService, TikTokWebhookService, PropertyService],
})
export class AppModule {}
