import { Injectable, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import OpenAI from 'openai';
import { ConfigService } from '../config/config.service';

export interface OpenAiEmbeddingResult {
  embeddings: number[][];
  model: string;
  inputTokens?: number;
}

export interface OpenAiGenerationResult {
  content: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
}

@Injectable()
export class OpenAiService implements OnModuleInit {
  private client?: OpenAI;
  constructor(private config: ConfigService) {}
  onModuleInit(): void {
    const apiKey = this.config.get('OPENAI_API_KEY');
    if (apiKey) this.client = new OpenAI({
      apiKey,
      timeout: this.config.get('OPENAI_TIMEOUT_MS'),
      maxRetries: this.config.get('OPENAI_MAX_RETRIES'),
    });
  }
  private requireClient(): OpenAI {
    if (!this.client) throw new ServiceUnavailableException('AI is not configured yet. Add OPENAI_API_KEY to the deployment environment.');
    return this.client;
  }
  async embedWithUsage(texts: string[]): Promise<OpenAiEmbeddingResult> {
    const model = this.config.get('OPENAI_EMBEDDING_MODEL');
    const response = await this.requireClient().embeddings.create({ model, input: texts });
    return {
      embeddings: response.data.sort((a, b) => a.index - b.index).map(item => item.embedding),
      model: response.model || model,
      inputTokens: response.usage?.prompt_tokens,
    };
  }
  async embed(texts: string[]): Promise<number[][]> {
    const response = await this.embedWithUsage(texts);
    return response.embeddings;
  }
  async generateWithUsage(system: string, user: string): Promise<OpenAiGenerationResult> {
    const response = await this.requireClient().chat.completions.create({
      model: this.config.get('OPENAI_CHAT_MODEL'), temperature: 0, response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    });
    return {
      content: response.choices[0]?.message.content ?? '{}',
      model: response.model || this.config.get('OPENAI_CHAT_MODEL'),
      inputTokens: response.usage?.prompt_tokens,
      outputTokens: response.usage?.completion_tokens,
    };
  }
  async generate(system: string, user: string): Promise<string> {
    const response = await this.generateWithUsage(system, user);
    return response.content;
  }
}
