import { recordBlockedSubscriptionAction } from './blocked-subscription-action';

describe('recordBlockedSubscriptionAction', () => {
  const agencyId = '22222222-2222-4222-8222-222222222222';
  it('stores only tenant, subscription, action type and bounded reason metadata', async () => {
    const db: any = { query: jest.fn().mockResolvedValue({ rowCount: 1, rows: [] }) };
    await recordBlockedSubscriptionAction(db, agencyId, 'ai_response', 'AI quota reached', '33333333-3333-4333-8333-333333333333');
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO subscription_blocked_actions'),
      [agencyId, '33333333-3333-4333-8333-333333333333', 'ai_response', 'AI quota reached'],
    );
  });
  it('does not let analytics persistence failures interrupt quota enforcement', async () => {
    const db: any = { query: jest.fn().mockRejectedValue(new Error('database unavailable')) };
    await expect(recordBlockedSubscriptionAction(db, agencyId, 'seat', 'Seat limit reached')).resolves.toBeUndefined();
  });
});
