import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';

export interface AiExecutionContext {
  agencyId: string;
  channel?: string;
  conversationId?: string;
  messageId?: string;
  operation: 'answer_generation' | 'embedding' | 'classification' | 'tool_execution';
}

export interface AiExecutionMetadata {
  traceId: string;
  startedAt: string;
}

@Injectable()
export class AiOrchestratorService {
  private readonly logger = new Logger(AiOrchestratorService.name);

  async execute<T>(
    context: AiExecutionContext,
    operation: (metadata: AiExecutionMetadata) => Promise<T>,
  ): Promise<T> {
    const metadata: AiExecutionMetadata = {
      traceId: randomUUID(),
      startedAt: new Date().toISOString(),
    };
    const started = Date.now();

    try {
      const result = await operation(metadata);
      this.logger.log(JSON.stringify({
        event: 'ai_execution_completed',
        traceId: metadata.traceId,
        operation: context.operation,
        channel: context.channel ?? 'unknown',
        durationMs: Date.now() - started,
        outcome: 'success',
      }));
      return result;
    } catch (error) {
      this.logger.error(JSON.stringify({
        event: 'ai_execution_failed',
        traceId: metadata.traceId,
        operation: context.operation,
        channel: context.channel ?? 'unknown',
        durationMs: Date.now() - started,
        errorName: error instanceof Error ? error.name : 'UnknownError',
      }));
      throw error;
    }
  }
}
