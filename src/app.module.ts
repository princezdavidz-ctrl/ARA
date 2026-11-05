import { Module } from '@nestjs/common';
import { ConfigService } from './config/config.service';
import { DatabaseService } from './database/database.service';
import { OpenAiService } from './llm/openai.service';
import { HealthController } from './http/health.controller';
import { KnowledgeController } from './http/knowledge.controller';
import { AnswerController } from './http/answer.controller';
import { IngestionService } from './rag/ingestion.service';
import { RetrievalService } from './rag/retrieval.service';
import { AnswerService } from './rag/answer.service';
import { PlatformModule } from './platform/platform.module';
import { MessageWorker } from './platform/message-worker.service';
import { WhatsAppWebhookController } from './platform/whatsapp-webhook.controller';
import { WhatsAppWebhookService } from './platform/whatsapp-webhook.service';
@Module({
  imports: [PlatformModule],
  controllers: [HealthController, KnowledgeController, AnswerController, WhatsAppWebhookController],
  providers: [ConfigService, DatabaseService, OpenAiService, IngestionService, RetrievalService, AnswerService, MessageWorker, WhatsAppWebhookService],
})
export class AppModule {}
