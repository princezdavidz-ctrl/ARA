import { ServiceUnavailableException } from '@nestjs/common';
import { createCipheriv, randomBytes } from 'node:crypto';
import { ChannelCredentialVault } from './channel-credential-vault.service';

describe('ChannelCredentialVault',()=>{
  const key='b'.repeat(64);
  beforeEach(()=>{process.env.ARA_CHANNEL_ENCRYPTION_KEY=key;process.env.ARA_CHANNEL_ENCRYPTION_KEY_VERSION='v1';});
  afterEach(()=>{delete process.env.ARA_CHANNEL_ENCRYPTION_KEY;delete process.env.ARA_CHANNEL_ENCRYPTION_KEY_VERSION;});
  function encrypted(value:Record<string,string>){
    const nonce=randomBytes(12),cipher=createCipheriv('aes-256-gcm',Buffer.from(key,'hex'),nonce);
    const data=Buffer.concat([cipher.update(JSON.stringify(value)),cipher.final()]);
    return Buffer.concat([Buffer.from('ARA1'),nonce,cipher.getAuthTag(),data]);
  }
  it('resolves a Meta account to its tenant and decrypts its credentials',async()=>{
    const db:any={query:jest.fn().mockResolvedValue({rows:[{id:'c1',agencyId:'agency-a',provider:'whatsapp',externalAccountId:'waba-1',externalPhoneNumberId:'phone-1',keyVersion:'v1',encrypted_credentials:encrypted({accessToken:'secret'})}]})};
    const vault=new ChannelCredentialVault(db);
    const result=await vault.findByProviderAccount('whatsapp','waba-1','phone-1');
    expect(result?.agencyId).toBe('agency-a');
    expect(result?.credentials.accessToken).toBe('secret');
    expect(db.query.mock.calls[0][1]).toEqual(['whatsapp','waba-1','phone-1']);
  });
  it('fails closed when provider account mapping is ambiguous',async()=>{
    const row={id:'c1',agencyId:'agency-a',provider:'instagram',externalAccountId:'ig-1',externalPhoneNumberId:null,keyVersion:'v1',encrypted_credentials:encrypted({accessToken:'secret'})};
    const db:any={query:jest.fn().mockResolvedValue({rows:[row,{...row,id:'c2',agencyId:'agency-b'}]})};
    const vault=new ChannelCredentialVault(db);
    await expect(vault.findByProviderAccount('instagram','ig-1')).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
