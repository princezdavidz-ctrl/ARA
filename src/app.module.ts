import { Module } from '@nestjs/common';
import { ConfigService } from './config/config.service';
import { DatabaseService } from './database/database.service';
import { OpenAiService } from './llm/openai.service';
import { LocalLlmService } from './llm/local-llm.service';
import { AiOrchestratorService } from './llm/ai-orchestrator.service';
import { HealthController } from './http/health.controller';
import { PublicAssistantController } from './http/public-assistant.controller';
import { KnowledgeController } from './http/knowledge.controller';
import { AnswerController } from './http/answer.controller';
import { IngestionService } from './rag/ingestion.service';
import { RetrievalService } from './rag/retrieval.service';
import { EmbeddingUsageService } from './rag/embedding-usage.service';
import { AnswerService } from './rag/answer.service';
import { AiUsageQuotaService } from './rag/ai-usage-quota.service';
import { MessageUsageQuotaService } from './platform/message-usage-quota.service';
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
import { AfricaTalkingSmsWebhookController } from './platform/africas-talking-sms-webhook.controller';
import { AfricaTalkingSmsService } from './platform/africas-talking-sms.service';
@Module({
  imports: [PlatformModule],
  controllers: [HealthController, PublicAssistantController, KnowledgeController, AnswerController, WhatsAppWebhookController, EmailWebhookController, InstagramWebhookController, TikTokWebhookController, AfricaTalkingSmsWebhookController, PropertyController, DashboardController],
  providers: [ConfigService, DatabaseService, OpenAiService, LocalLlmService, AiOrchestratorService, IngestionService, RetrievalService, EmbeddingUsageService, AiUsageQuotaService, MessageUsageQuotaService, AnswerService, MessageWorker, WhatsAppWebhookService, EmailWebhookService, InstagramWebhookService, TikTokWebhookService, AfricaTalkingSmsService, PropertyService],
})
export class AppModule {}
