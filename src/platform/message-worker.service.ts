import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AnswerService } from '../rag/answer.service';
import { AnswerInput } from '../rag/contracts';

interface MessageJob {
  id: string;
  agencyId: string;
  conversationId: string;
  body: string;
  attempts: number;
}

@Injectable()
export class MessageWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MessageWorker.name);
  private timer: ReturnType<typeof setInterval> | undefined;
  private running = false;

  constructor(private readonly db: DatabaseService, private readonly answers: AnswerService) {}

  onModuleInit(): void {
    this.timer = setInterval(() => void this.tick(), 1500);
    void this.tick();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      for (let i = 0; i < 5; i++) {
        const job = await this.claim();
        if (!job) break;
        await this.process(job);
      }
    } catch (error) {
      this.logger.error('Message worker cycle failed', error instanceof Error ? error.stack : undefined);
    } finally {
      this.running = false;
    }
  }

  private async claim(): Promise<MessageJob | null> {
    return this.db.transaction(async (client) => {
      const result = await client.query<MessageJob>(`SELECT m.id, m.agency_id AS "agencyId",
          m.conversation_id AS "conversationId", m.body, m.processing_attempts AS attempts
        FROM messages m
        JOIN conversations cv ON cv.id = m.conversation_id AND cv.agency_id = m.agency_id
        WHERE m.direction = 'inbound'
          AND (m.processing_status = 'pending'
            OR (m.processing_status = 'processing' AND m.processing_started_at < now() - interval '5 minutes'))
        ORDER BY m.created_at
        LIMIT 1
        FOR UPDATE OF m SKIP LOCKED`);
      const job = result.rows[0];
      if (!job) return null;
      const nextAttempt = Number(job.attempts) + 1;
      if (nextAttempt > 5) {
        await client.query(`UPDATE messages SET processing_status = 'failed', processing_started_at = NULL
          WHERE id = $1`, [job.id]);
        return null;
      }
      await client.query(`UPDATE messages SET processing_status = 'processing',
          processing_started_at = now(), processing_attempts = $2
        WHERE id = $1`, [job.id, nextAttempt]);
      return { ...job, attempts: nextAttempt };
    });
  }

  private async process(job: MessageJob): Promise<void> {
    try {
      const result = await this.answers.answer(
        { message: job.body, preferredLanguage: 'auto', filters: {} } as AnswerInput,
        job.agencyId,
      );
      await this.db.transaction(async (client) => {
        await client.query(`INSERT INTO messages
            (agency_id, conversation_id, direction, sender_type, body, idempotency_key, delivery_status, processing_status)
          VALUES ($1, $2, 'outbound', 'ai', $3, $4, 'queued', 'not_applicable')
          ON CONFLICT (agency_id, idempotency_key) DO NOTHING`,
        [job.agencyId, job.conversationId, result.answer, 'ai:' + job.id]);
        await client.query(`UPDATE messages SET processing_status = 'completed', processing_started_at = NULL
          WHERE id = $1`, [job.id]);
        await client.query(`UPDATE conversations SET status = $3, updated_at = now()
          WHERE id = $1 AND agency_id = $2`,
        [job.conversationId, job.agencyId, result.status === 'needs_human' ? 'pending' : 'open']);
        if (result.status === 'needs_human') {
          await client.query(`INSERT INTO escalations (agency_id, conversation_id, reason)
            SELECT $1, $2, $3
            WHERE NOT EXISTS (
              SELECT 1 FROM escalations
              WHERE agency_id = $1 AND conversation_id = $2 AND status IN ('open', 'claimed')
            )`, [job.agencyId, job.conversationId, result.escalationReason || 'AI requested human review']);
        }
      });
    } catch (error) {
      this.logger.error(`Inbound message ${job.id} failed on attempt ${job.attempts}`,
        error instanceof Error ? error.stack : undefined);
      const status = job.attempts >= 5 ? 'failed' : 'pending';
      await this.db.query(`UPDATE messages SET processing_status = $2, processing_started_at = NULL
        WHERE id = $1 AND processing_status = 'processing'`, [job.id, status]);
    }
  }
}
