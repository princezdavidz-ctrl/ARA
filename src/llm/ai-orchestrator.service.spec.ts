import { AiOrchestratorService } from './ai-orchestrator.service';

describe('AiOrchestratorService', () => {
  let service: AiOrchestratorService;

  beforeEach(() => {
    service = new AiOrchestratorService();
  });

  it('passes a unique trace identifier to each operation', async () => {
    const operation = jest.fn().mockResolvedValue({ answer: 'ok' });
    const first = await service.execute({ agencyId: 'tenant-a', operation: 'answer_generation' }, operation);
    const second = await service.execute({ agencyId: 'tenant-a', operation: 'answer_generation' }, operation);

    expect(first).toEqual({ answer: 'ok' });
    expect(second).toEqual({ answer: 'ok' });
    expect(operation.mock.calls[0][0].traceId).toBeTruthy();
    expect(operation.mock.calls[1][0].traceId).not.toBe(operation.mock.calls[0][0].traceId);
  });

  it('rethrows provider failures so the caller can apply its safe fallback', async () => {
    const failure = new Error('provider unavailable');
    await expect(service.execute(
      { agencyId: 'tenant-a', operation: 'answer_generation' },
      async () => { throw failure; },
    )).rejects.toBe(failure);
  });
});
