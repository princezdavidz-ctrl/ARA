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
@Module({ controllers:[HealthController,KnowledgeController,AnswerController], providers:[ConfigService,DatabaseService,OpenAiService,IngestionService,RetrievalService,AnswerService] })
export class AppModule {}
