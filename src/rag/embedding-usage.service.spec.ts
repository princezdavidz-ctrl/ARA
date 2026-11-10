import { EmbeddingUsageService } from './embedding-usage.service';

describe('EmbeddingUsageService', () => {
  const agencyId = '22222222-2222-4222-8222-222222222222';

  it('records tenant-scoped embedding input tokens with optional cost and safe metadata', async () => {
    const db: any = { query: jest.fn().mockResolvedValue({ rowCount: 1 }) };
    const config: any = { get: jest.fn().mockReturnValue(0.02) };
    const service = new EmbeddingUsageService(db, config);

    await service.record(agencyId, {
      embeddings: [[0.1, 0.2]], model: 'text-embedding-3-small', inputTokens: 250,
    }, 'embedding-ingestion:agency:content-hash', {
      operation: 'document_ingestion', knowledgeBaseId: 'knowledge-base-1',
    });

    expect(db.query).toHaveBeenCalledTimes(1);
    const [sql, values] = db.query.mock.calls[0];
    expect(sql).toContain('ON CONFLICT(agency_id,idempotency_key) DO NOTHING');
    expect(values.slice(0, 3)).toEqual([agencyId, 250, 'embedding-ingestion:agency:content-hash']);
    expect(JSON.parse(values[3])).toMatchObject({
      provider: 'openai', model: 'text-embedding-3-small',
      operation: 'document_ingestion', tokenType: 'embedding_input',
      knowledgeBaseId: 'knowledge-base-1', estimatedCostUsd: 0.000005,
      pricingSource: 'environment_config',
    });
    expect(JSON.stringify(values)).not.toContain('customer document text');
  });

  it('does not write when provider token usage is missing or zero', async () => {
    const db: any = { query: jest.fn() };
    const service = new EmbeddingUsageService(db, { get: jest.fn() } as any);
    await service.record(agencyId, { embeddings: [[0.1]], model: 'embedding-model' }, 'key-1', {
      operation: 'query_retrieval',
    });
    await service.record(agencyId, { embeddings: [[0.1]], model: 'embedding-model', inputTokens: 0 }, 'key-2', {
      operation: 'query_retrieval',
    });
    expect(db.query).not.toHaveBeenCalled();
  });

  it('does not fail the RAG operation when usage persistence fails', async () => {
    const db: any = { query: jest.fn().mockRejectedValue(new Error('database unavailable')) };
    const service = new EmbeddingUsageService(db, { get: jest.fn().mockReturnValue(undefined) } as any);
    await expect(service.record(agencyId, {
      embeddings: [[0.1]], model: 'embedding-model', inputTokens: 10,
    }, 'key-3', { operation: 'query_retrieval' })).resolves.toBeUndefined();
  });
});
