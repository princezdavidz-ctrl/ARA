import { ForbiddenException } from '@nestjs/common';
import { SubscriptionLimitsService } from './subscription-limits.service';

describe('SubscriptionLimitsService', () => {
  const agencyId = '22222222-2222-4222-8222-222222222222';
  function clientWith(plan: any, count: number) {
    return { query: jest.fn(async (sql: string) => {
      if (sql.includes('SELECT cs.id')) return { rows: plan ? [plan] : [], rowCount: plan ? 1 : 0 };
      return { rows: [{ total: count }], rowCount: 1 };
    }) };
  }

  it('allows adding a seat below the plan limit', async () => {
    const client = clientWith({ id: 'sub-1', maxSeats: 5 }, 4);
    await expect(new SubscriptionLimitsService({} as any).assertSeatAvailable(client, agencyId)).resolves.toBeUndefined();
    expect(client.query).toHaveBeenCalledTimes(2);
  });

  it('blocks adding a seat at the plan limit', async () => {
    const client = clientWith({ id: 'sub-1', maxSeats: 5 }, 5);
    await expect(new SubscriptionLimitsService({} as any).assertSeatAvailable(client, agencyId)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('blocks seat creation when no eligible subscription exists', async () => {
    const client = clientWith(null, 0);
    await expect(new SubscriptionLimitsService({} as any).assertSeatAvailable(client, agencyId)).rejects.toBeInstanceOf(ForbiddenException);
    expect(client.query).toHaveBeenCalledTimes(1);
  });

  it('counts pending and active channel connections but excludes disabled ones', async () => {
    const client = clientWith({ id: 'sub-1', maxChannels: 2 }, 1);
    await expect(new SubscriptionLimitsService({} as any).assertChannelAvailable(client, agencyId)).resolves.toBeUndefined();
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining("status<>'disabled'"), [agencyId]);
  });

  it('blocks connecting a channel at the plan limit', async () => {
    const client = clientWith({ id: 'sub-1', maxChannels: 2 }, 2);
    await expect(new SubscriptionLimitsService({} as any).assertChannelAvailable(client, agencyId)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('blocks channel creation when no eligible subscription exists', async () => {
    const client = clientWith(null, 0);
    await expect(new SubscriptionLimitsService({} as any).assertChannelAvailable(client, agencyId)).rejects.toBeInstanceOf(ForbiddenException);
    expect(client.query).toHaveBeenCalledTimes(1);
  });
});
