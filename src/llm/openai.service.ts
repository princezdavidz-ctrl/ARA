import { Injectable, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import OpenAI from 'openai';
import { ConfigService } from '../config/config.service';

@Injectable()
export class OpenAiService implements OnModuleInit {
  private client?: OpenAI;
  constructor(private config: ConfigService) {}
  onModuleInit(): void {
    const apiKey = this.config.get('OPENAI_API_KEY');
    if (apiKey) this.client = new OpenAI({ apiKey });
  }
  private requireClient(): OpenAI {
    if (!this.client) throw new ServiceUnavailableException('AI is not configured yet. Add OPENAI_API_KEY to the deployment environment.');
    return this.client;
  }
  async embed(texts: string[]): Promise<number[][]> {
    const response = await this.requireClient().embeddings.create({
      model: this.config.get('OPENAI_EMBEDDING_MODEL'), input: texts,
    });
    return response.data.sort((a, b) => a.index - b.index).map(item => item.embedding);
  }
  async generate(system: string, user: string): Promise<string> {
    const response = await this.requireClient().chat.completions.create({
      model: this.config.get('OPENAI_CHAT_MODEL'), temperature: 0, response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    });
    return response.choices[0]?.message.content ?? '{}';
  }
}