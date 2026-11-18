import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { createDecipheriv } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
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
  provider?: 'openai' | 'ollama';
}

@Injectable()
export class OpenAiService {
  constructor(private config: ConfigService, private db: DatabaseService) {}
  private decryptCredentials(data: Buffer): Record<string,string> {
    const raw=String(this.config.get('ARA_CHANNEL_ENCRYPTION_KEY')||'').trim();
    const key=/^[0-9a-f]{64}$/i.test(raw)?Buffer.from(raw,'hex'):Buffer.from(raw,'base64');
    if(key.length!==32||!Buffer.isBuffer(data)||data.length<32||data.subarray(0,4).toString()!=='ARA1')throw new ServiceUnavailableException('AI provider credentials cannot be decrypted.');
    try{const decipher=createDecipheriv('aes-256-gcm',key,data.subarray(4,16));decipher.setAuthTag(data.subarray(16,32));return JSON.parse(Buffer.concat([decipher.update(data.subarray(32)),decipher.final()]).toString('utf8'));}
    catch{throw new ServiceUnavailableException('AI provider credentials cannot be decrypted.');}
  }
  private async requireClient(): Promise<OpenAI> {
    const saved=await this.db.query<any>("SELECT encrypted_credentials FROM platform_integrations WHERE provider='openai' AND is_enabled=true");
    let apiKey=String(this.config.get('OPENAI_API_KEY')||'');
    if(saved.rowCount)apiKey=String(this.decryptCredentials(saved.rows[0].encrypted_credentials).apiKey||'');
    if(!apiKey)throw new ServiceUnavailableException('AI is not configured yet. Add an OpenAI key in Super Admin AI Control.');
    return new OpenAI({apiKey,timeout:this.config.get('OPENAI_TIMEOUT_MS'),maxRetries:this.config.get('OPENAI_MAX_RETRIES')});
  }
  async embedWithUsage(texts: string[]): Promise<OpenAiEmbeddingResult> {
    const model = this.config.get('OPENAI_EMBEDDING_MODEL');
    const response = await (await this.requireClient()).embeddings.create({ model, input: texts });
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
    const response = await (await this.requireClient()).chat.completions.create({
      model: this.config.get('OPENAI_CHAT_MODEL'), temperature: 0, response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    });
    return {
      content: response.choices[0]?.message.content ?? '{}',
      model: response.model || this.config.get('OPENAI_CHAT_MODEL'),
      inputTokens: response.usage?.prompt_tokens,
      outputTokens: response.usage?.completion_tokens,
      provider: 'openai',
    };
  }
  async generate(system: string, user: string): Promise<string> {
    const response = await this.generateWithUsage(system, user);
    return response.content;
  }
}
