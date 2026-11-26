import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CampaignsService } from './campaigns.service';

describe('CampaignsService', () => {
  const owner: any = { id: 'user-1', agencyId: 'agency-1', role: 'owner' };
  const agent: any = { id: 'user-2', agencyId: 'agency-1', role: 'agent' };

  it('requires management role to preview audiences', async () => {
    const service = new CampaignsService({ query: jest.fn() } as any);
    await expect(service.preview(agent, { channel: 'sms' })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('validates channels and filters before querying', async () => {
    const db: any = { query: jest.fn() };
    const service = new CampaignsService(db);
    await expect(service.preview(owner, { channel: 'voice' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.preview(owner, { channel: 'sms', filters: { arbitrary: true } })).rejects.toBeInstanceOf(BadRequestException);
    expect(db.query).not.toHaveBeenCalled();
  });

  it('counts only opted-in SMS recipients', async () => {
    const db: any = { query: jest.fn().mockResolvedValue({ rows: [{ id: 'conversation-1', contact: '+254700000000' }] }) };
    const service = new CampaignsService(db);
    await expect(service.preview(owner, { channel: 'sms' })).resolves.toMatchObject({ eligibleRecipients: 1, consentRequired: true });
    expect(db.query.mock.calls[0][0]).toContain("p.consent_status='opted_in'");
    expect(db.query.mock.calls[0][1]).toEqual(['agency-1', 'sms']);
  });

  it('requires email subject and valid future scheduling', async () => {
    const db: any = { query: jest.fn() };
    const service = new CampaignsService(db);
    await expect(service.create(owner, { name: 'News', channel: 'email', body: 'Hello' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.create(owner, { name: 'News', channel: 'email', subject: 'Update', body: 'Hello', scheduledAt: 'invalid' })).rejects.toBeInstanceOf(BadRequestException);
    expect(db.query).not.toHaveBeenCalled();
  });

  it('returns not found when campaign does not belong to tenant', async () => {
    const db: any = { query: jest.fn().mockResolvedValue({ rowCount: 0, rows: [] }) };
    const service = new CampaignsService(db);
    await expect(service.detail(owner, 'missing')).rejects.toBeInstanceOf(NotFoundException);
    expect(db.query.mock.calls[0][1]).toEqual(['missing', 'agency-1']);
  });
});
