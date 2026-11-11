import { LocalLlmService } from './local-llm.service';

describe('LocalLlmService', () => {
  const config: any = {
    get: jest.fn((key: string) => ({
      LOCAL_LLM_ENABLED: true,
      LOCAL_LLM_BASE_URL: 'http://localhost:11434/',
      LOCAL_LLM_CHAT_MODEL: 'qwen2.5:7b-instruct',
      LOCAL_LLM_TIMEOUT_MS: 60000,
    }[key])),
  };

  afterEach(() => jest.restoreAllMocks());

  it('uses the local Ollama endpoint and returns structured generation usage', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        model: 'qwen2.5:7b-instruct',
        message: { content: '{"answer":"Local answer"}' },
        prompt_eval_count: 20,
        eval_count: 8,
      }),
    } as Response);
    const service = new LocalLlmService(config);
    const result = await service.generateWithUsage('system prompt', 'user prompt');

    expect(fetchSpy).toHaveBeenCalledWith('http://localhost:11434/api/chat', expect.objectContaining({
      method: 'POST',
      signal: expect.any(AbortSignal),
    }));
    expect(result).toMatchObject({
      content: '{"answer":"Local answer"}',
      model: 'qwen2.5:7b-instruct',
      inputTokens: 20,
      outputTokens: 8,
      provider: 'ollama',
    });
    expect(JSON.stringify(fetchSpy.mock.calls)).not.toContain('OPENAI_API_KEY');
  });

  it('does not call any endpoint when local fallback is disabled', async () => {
    config.get.mockImplementation((key: string) => ({
      LOCAL_LLM_ENABLED: false,
      LOCAL_LLM_BASE_URL: 'http://localhost:11434',
      LOCAL_LLM_CHAT_MODEL: 'qwen2.5:7b-instruct',
      LOCAL_LLM_TIMEOUT_MS: 60000,
    }[key]));
    const fetchSpy = jest.spyOn(global, 'fetch');
    const service = new LocalLlmService(config);

    await expect(service.generateWithUsage('system', 'user')).rejects.toThrow('Local LLM fallback is disabled');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
