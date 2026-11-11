import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '../config/config.service';
import { OpenAiGenerationResult } from './openai.service';

@Injectable()
export class LocalLlmService {
  private readonly logger = new Logger(LocalLlmService.name);
  constructor(private readonly config: ConfigService) {}

  async generateWithUsage(system: string, user: string): Promise<OpenAiGenerationResult> {
    if (!this.config.get('LOCAL_LLM_ENABLED')) {
      throw new ServiceUnavailableException('Local LLM fallback is disabled.');
    }
    const baseUrl = this.config.get('LOCAL_LLM_BASE_URL').replace(/\/$/, '');
    const model = this.config.get('LOCAL_LLM_CHAT_MODEL');
    let response: Response;
    try {
      response = await fetch(baseUrl + '/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          stream: false,
          format: 'json',
          messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
          options: { temperature: 0 },
        }),
        signal: AbortSignal.timeout(this.config.get('LOCAL_LLM_TIMEOUT_MS')),
      });
    } catch (error) {
      this.logger.warn('Local LLM request failed: ' + (error instanceof Error ? error.name : 'UnknownError'));
      throw new ServiceUnavailableException('Local LLM is unavailable.');
    }
    if (!response.ok) {
      this.logger.warn('Local LLM returned HTTP ' + response.status);
      throw new ServiceUnavailableException('Local LLM returned an unsuccessful response.');
    }
    const payload = await response.json() as {
      model?: string;
      message?: { content?: string };
      prompt_eval_count?: number;
      eval_count?: number;
    };
    const content = payload.message?.content;
    if (typeof content !== 'string' || !content.trim()) {
      throw new ServiceUnavailableException('Local LLM returned an empty response.');
    }
    return {
      content,
      model: payload.model || model,
      inputTokens: Number.isSafeInteger(payload.prompt_eval_count) ? payload.prompt_eval_count : undefined,
      outputTokens: Number.isSafeInteger(payload.eval_count) ? payload.eval_count : undefined,
      provider: 'ollama',
    };
  }
}
