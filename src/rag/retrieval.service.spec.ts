import { RetrievalService } from './retrieval.service';

describe('RetrievalService offline fallback', () => {
  const agencyId = '22222222-2222-4222-8222-222222222222';
  const config: any = { get: jest.fn((key: string) => ({ RAG_TOP_K: 6 }[key])) };
  const embeddingUsage: any = { record: jest.fn().mockResolvedValue(undefined) };

  it('uses tenant-scoped PostgreSQL full-text retrieval when OpenAI embeddings fail', async () => {
    const db: any = { query: jest.fn().mockResolvedValue({ rows: [{
      document_id: '33333333-3333-4333-8333-333333333333',
      title: 'Returns policy',
      category: 'policies',
      language: 'en',
      metadata: {},
      content: 'Customers may return unused products within fourteen days.',
      similarity: 0.12,
    }] }) };
    const ai: any = { embedWithUsage: jest.fn().mockRejectedValue(new Error('provider offline')) };
    const service = new RetrievalService(db, ai, config, embeddingUsage);

    const results = await service.search({
      message: 'What is the returns policy?',
      preferredLanguage: 'en',
      filters: {},
    } as any, agencyId);

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ retrievalMethod: 'keyword', title: 'Returns policy' });
    expect(db.query).toHaveBeenCalledTimes(1);
    expect(db.query.mock.calls[0][0]).toContain('websearch_to_tsquery');
    expect(db.query.mock.calls[0][0]).toContain('d.agency_id=$6');
    expect(db.query.mock.calls[0][1][5]).toBe(agencyId);
    expect(embeddingUsage.record).not.toHaveBeenCalled();
  });
});
