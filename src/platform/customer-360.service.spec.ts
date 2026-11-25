import { NotFoundException } from '@nestjs/common';
import { Customer360Service } from './customer-360.service';

describe('Customer360Service', () => {
  const user: any = { id: 'user-1', agencyId: 'agency-1', role: 'agent' };

  it('lists customer groups only within the authenticated tenant', async () => {
    const db: any = { query: jest.fn().mockResolvedValue({ rows: [{ id: 'a'.repeat(32), name: 'Customer' }] }) };
    const service = new Customer360Service(db);
    await expect(service.list(user)).resolves.toHaveLength(1);
    expect(db.query.mock.calls[0][1]).toEqual(['agency-1']);
    expect(db.query.mock.calls[0][0]).toContain('WHERE c.agency_id=$1');
  });

  it('returns a not-found response for unknown or malformed customer IDs', async () => {
    const db: any = { query: jest.fn() };
    const service = new Customer360Service(db);
    await expect(service.detail(user, 'not-a-customer')).rejects.toBeInstanceOf(NotFoundException);
    expect(db.query).not.toHaveBeenCalled();
    db.query.mockResolvedValue({ rows: [], rowCount: 0 });
    await expect(service.detail(user, 'b'.repeat(32))).rejects.toBeInstanceOf(NotFoundException);
    expect(db.query).toHaveBeenCalledTimes(1);
    expect(db.query.mock.calls[0][1]).toEqual(['agency-1', 'b'.repeat(32)]);
  });
});
