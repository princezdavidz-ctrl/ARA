import { ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { ChannelConnectionsService } from './channel-connections.service';

describe('ChannelConnectionsService', () => {
  const user:any={id:'11111111-1111-4111-8111-111111111111',agencyId:'22222222-2222-4222-8222-222222222222',role:'owner',email:'owner@example.test',fullName:'Company Owner'};

  afterEach(() => { delete process.env.ARA_CHANNEL_ENCRYPTION_KEY; });

  it('rejects channel management by agents', async () => {
    const db:any={query:jest.fn(),transaction:jest.fn()};
    const service=new ChannelConnectionsService(db);
    await expect(service.create({...user,role:'agent'},{provider:'email'})).rejects.toBeInstanceOf(ForbiddenException);
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it('encrypts credentials before persistence and never returns them', async () => {
    process.env.ARA_CHANNEL_ENCRYPTION_KEY='a'.repeat(64);
    const saved:any={id:'33333333-3333-4333-8333-333333333333',provider:'email',displayName:'Support mailbox',externalAccountId:'support@example.test',externalPhoneNumberId:null,status:'pending',scopes:[],lastVerifiedAt:null,lastErrorCode:null,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
    const client:any={query:jest.fn(async(sql:string)=>sql.startsWith('INSERT INTO channel_connections')?{rows:[saved],rowCount:1}:{rows:[],rowCount:1})};
    const db:any={query:jest.fn(),transaction:jest.fn(async(fn:any)=>fn(client))};
    const service=new ChannelConnectionsService(db);
    const result=await service.create(user,{provider:'email',displayName:'Support mailbox',externalAccountId:'support@example.test',credentials:{apiKey:'secret-provider-token'}});
    const insertArgs=client.query.mock.calls[0][1];
    const ciphertext=insertArgs[5] as Buffer;
    expect(Buffer.isBuffer(ciphertext)).toBe(true);
    expect(ciphertext.subarray(0,4).toString()).toBe('ARA1');
    expect(ciphertext.includes(Buffer.from('secret-provider-token'))).toBe(false);
    expect(JSON.stringify(result)).not.toContain('secret-provider-token');
    expect(result.connection.status).toBe('pending');
  });

  it('requires a configured 32-byte encryption key', async () => {
    const service=new ChannelConnectionsService({} as any);
    expect(() => (service as any).encrypt({token:'x'})).toThrow(ServiceUnavailableException);
  });
});
