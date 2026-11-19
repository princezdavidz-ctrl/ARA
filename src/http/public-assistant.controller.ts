import { Body, Controller, HttpException, HttpStatus, Post, Req, ServiceUnavailableException } from '@nestjs/common';
import { z } from 'zod';
import { OpenAiService } from '../llm/openai.service';
import { LocalLlmService } from '../llm/local-llm.service';

const requestSchema = z.object({ message: z.string().trim().min(2).max(1200) });
const windows = new Map<string, number[]>();

@Controller('public')
export class PublicAssistantController {
  constructor(private readonly ai: OpenAiService, private readonly localAi: LocalLlmService) {}

  @Post('assistant')
  async ask(@Req() req: { ip?: string; headers?: Record<string, string | string[] | undefined> }, @Body() body: unknown) {
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) throw new HttpException('Please enter a message between 2 and 1,200 characters.', HttpStatus.BAD_REQUEST);
    const ip = req.ip || 'unknown';
    const now = Date.now();
    const recent = (windows.get(ip) || []).filter((time) => now - time < 60_000);
    if (recent.length >= 8) throw new HttpException('Please wait a moment before asking another question.', HttpStatus.TOO_MANY_REQUESTS);
    recent.push(now);
    windows.set(ip, recent);
    if (windows.size > 5000) for (const [key, times] of windows) if (!times.some((time) => now - time < 60_000)) windows.delete(key);

    const system = [
      'You are the ARA Website Assistant, helping visitors understand ARA (Autonomous Respond Agent).',
      'Answer only questions about ARA public product and how to get started. ARA is a multi-company customer communication platform. Each company has a separate workspace, connects supported channels such as WhatsApp Business, Instagram, TikTok Business and email, and supplies its own approved company knowledge. The AI uses that knowledge to draft evidence-grounded customer replies. The platform supports human-supervised approval and escalation when evidence is missing or a request is sensitive. Company users manage conversations, integrations, knowledge and AI usage in the Company CRM.',
      'New companies register at https://ara-company-crm.onrender.com/?mode=register; existing users sign in at https://ara-company-crm.onrender.com/?mode=login.',
      'Do not claim a provider connection, feature, price, availability, integration approval, or service-level guarantee unless explicitly stated. Do not ask for passwords, access tokens, API keys, payment details or private customer data. For account-specific matters, direct visitors to their company workspace or ARA support. If unrelated, politely explain your scope. Reply in English or Kiswahili according to the visitor language. Be concise, friendly and clear. Return valid JSON only: {"answer":"..."}.'
    ].join(' ');
    const prompt = JSON.stringify({ question: parsed.data.message });
    try {
      let result;
      try {
        result = await this.ai.generateWithUsage(system, prompt);
      } catch (primaryError) {
        // Ollama is the configured fallback for public product questions too.
        result = await this.localAi.generateWithUsage(system, prompt);
      }
      const value = JSON.parse(result.content) as { answer?: unknown };
      if (typeof value.answer !== 'string' || !value.answer.trim()) throw new Error('Invalid assistant response');
      return { answer: value.answer.trim().slice(0, 3000), provider: result.provider || 'openai' };
    } catch {
      throw new ServiceUnavailableException('The website assistant is temporarily unavailable. Please try again shortly or use the contact options on this website.');
    }
  }
}
