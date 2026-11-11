import { MessageUsageQuotaService } from './message-usage-quota.service';

describe('MessageUsageQuotaService', () => {
  const agencyId = '22222222-2222-4222-8222-222222222222';
  const subscriptionId = '33333333-3333-4333-8333-333333333333';

  function setup(overrides: { included?: string; overage?: string; consumed?: string; reserved?: string; existing?: any } = {}) {
    const sub = { id: subscriptionId, periodStart: new Date('2026-11-01T00:00:00Z'), periodEnd: new Date('2026-12-01T00:00:00Z'), includedMessages: overrides.included ?? '10', overageMessagePriceMinor: overrides.overage ?? '0' };
    const client = { query: jest.fn(async (sql: string) => {
      if (sql.includes('SELECT cs.id')) return { rows: [sub], rowCount: 1 };
      if (sql.includes('SELECT status,expires_at')) return { rows: overrides.existing ? [overrides.existing] : [], rowCount: overrides.existing ? 1 : 0 };
      if (sql.includes('SELECT\n        COALESCE')) return { rows: [{ consumed: overrides.consumed ?? '0', reserved: overrides.reserved ?? '0' }], rowCount: 1 };
      return { rows: [], rowCount: 1 };
    }) };
    const db = { transaction: jest.fn(async (fn: any) => fn(client)), query: jest.fn().mockResolvedValue({ rows: [], rowCount: 1 }) };
    return { service: new MessageUsageQuotaService(db as any), db, client };
  }

  it('blocks new messages after included allowance when overage is disabled', async () => {
    const { service, client, db } = setup({ included: '10', consumed: '10', overage: '0' });
    const result = await service.reserve(agencyId, 'message_in', 'message-in:blocked');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('allowance');
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO subscription_blocked_actions'), [agencyId, subscriptionId, 'message_in', expect.any(String)]);
    expect(client.query).not.toHaveBeenCalledWith(expect.stringContaining('INSERT INTO message_usage_reservations'), expect.anything());
  });

  it('allows billable overage when the plan has a positive message overage price', async () => {
    const { service, client } = setup({ included: '10', consumed: '10', overage: '5' });
    const result = await service.reserve(agencyId, 'message_out', 'message-out:billable');
    expect(result).toEqual({ allowed: true, subscriptionId });
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO message_usage_reservations'), [agencyId, subscriptionId, 'message_out', 'message-out:billable']);
  });

  it('counts active reservations together with consumed messages', async () => {
    const { service } = setup({ included: '10', consumed: '9', reserved: '1', overage: '0' });
    const result = await service.reserve(agencyId, 'message_in', 'message-in:blocked-by-reservation');
    expect(result.allowed).toBe(false);
  });

  it('does not reserve the same still-active idempotency key twice', async () => {
    const { service, client } = setup({ existing: { status: 'reserved', expiresAt: new Date(Date.now() + 60_000) } });
    const result = await service.reserve(agencyId, 'message_in', 'message-in:retry');
    expect(result).toEqual({ allowed: true, subscriptionId });
    expect(client.query).not.toHaveBeenCalledWith(expect.stringContaining('INSERT INTO message_usage_reservations'), expect.anything());
  });

  it('consumes a reservation into an idempotent usage record', async () => {
    const { service, client } = setup();
    client.query.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT subscription_id')) return { rows: [{ subscriptionId, metric: 'message_in', status: 'reserved' }], rowCount: 1 };
      return { rows: [], rowCount: 1 };
    });
    await service.consume(agencyId, 'message-in:consume');
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO usage_records'), [agencyId, subscriptionId, 'message_in', 'message-in:consume']);
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining("status='consumed'"), [agencyId, 'message-in:consume']);
  });

  it('releases a reservation after a failed outbound attempt', async () => {
    const { service, db } = setup();
    await service.release(agencyId, 'message-out:failed');
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining("status='released'"), [agencyId, 'message-out:failed']);
  });
});
