import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { createDecipheriv, createHash } from 'node:crypto';
import { DatabaseService } from '../database/database.service';

export type ChannelProvider='whatsapp'|'email'|'instagram'|'facebook_messenger'|'tiktok';
export type ResolvedChannel={id:string;agencyId:string;provider:ChannelProvider;externalAccountId:string;externalPhoneNumberId:string|null;credentials:Record<string,string>;keyVersion:string;webhookVerified?:boolean};

@Injectable()
export class ChannelCredentialVault {
  constructor(private readonly db:DatabaseService){}
  private key(version:string):Buffer {
    const activeVersion=String(process.env.ARA_CHANNEL_ENCRYPTION_KEY_VERSION||'v1');
    if(version!==activeVersion) throw new ServiceUnavailableException('Channel credential key version is not available; configure the matching key before processing this connection');
    const raw=String(process.env.ARA_CHANNEL_ENCRYPTION_KEY||'').trim();
    if(!raw) throw new ServiceUnavailableException('Channel credential encryption is not configured');
    const key=/^[0-9a-f]{64}$/i.test(raw)?Buffer.from(raw,'hex'):Buffer.from(raw,'base64');
    if(key.length!==32) throw new ServiceUnavailableException('Invalid channel credential encryption key');
    return key;
  }
  private decrypt(data:Buffer,version:string):Record<string,string> {
    if(!Buffer.isBuffer(data)||data.length<32||data.subarray(0,4).toString()!=='ARA1') throw new ServiceUnavailableException('Unsupported encrypted channel credential format');
    const nonce=data.subarray(4,16),tag=data.subarray(16,32),ciphertext=data.subarray(32);
    try {
      const decipher=createDecipheriv('aes-256-gcm',this.key(version),nonce);
      decipher.setAuthTag(tag);
      const value=JSON.parse(Buffer.concat([decipher.update(ciphertext),decipher.final()]).toString('utf8'));
      if(!value||typeof value!=='object'||Array.isArray(value)) throw new Error('Invalid credentials payload');
      return value as Record<string,string>;
    } catch { throw new ServiceUnavailableException('Unable to decrypt channel credentials'); }
  }
  async getForTenantConnection(agencyId:string,id:string):Promise<ResolvedChannel|null>{
    const r=await this.db.query<any>(`SELECT id,agency_id AS "agencyId",provider,external_account_id AS "externalAccountId",external_phone_number_id AS "externalPhoneNumberId",encrypted_credentials,credential_key_version AS "keyVersion",webhook_verified_at IS NOT NULL AS "webhookVerified"
      FROM channel_connections WHERE agency_id=$1 AND id=$2 AND status IN ('pending','active','reauthorization_required') LIMIT 1`,[agencyId,id]);
    const row=r.rows[0];if(!row)return null;
    return {id:row.id,agencyId:row.agencyId,provider:row.provider,externalAccountId:row.externalAccountId,externalPhoneNumberId:row.externalPhoneNumberId,credentials:this.decrypt(row.encrypted_credentials,row.keyVersion),keyVersion:row.keyVersion,webhookVerified:Boolean(row.webhookVerified)};
  }
  async findByProviderAccount(provider:ChannelProvider,externalAccountId:string,externalPhoneNumberId?:string):Promise<ResolvedChannel|null>{
    const r=await this.db.query<any>(`SELECT id,agency_id AS "agencyId",provider,external_account_id AS "externalAccountId",external_phone_number_id AS "externalPhoneNumberId",encrypted_credentials,credential_key_version AS "keyVersion"
      FROM channel_connections WHERE provider=$1 AND status='active'
      AND (($2<>'' AND external_account_id=$2) OR ($3<>'' AND external_phone_number_id=$3))
      ORDER BY updated_at DESC LIMIT 2`,[provider,externalAccountId||'',externalPhoneNumberId||'']);
    if(r.rows.length>1) throw new ServiceUnavailableException('Ambiguous provider account mapping; refusing to route the webhook');
    const row=r.rows[0]; if(!row)return null;
    return {id:row.id,agencyId:row.agencyId,provider:row.provider,externalAccountId:row.externalAccountId,externalPhoneNumberId:row.externalPhoneNumberId,credentials:this.decrypt(row.encrypted_credentials,row.keyVersion),keyVersion:row.keyVersion};
  }
  async findByVerifyToken(provider:ChannelProvider,token:string):Promise<ResolvedChannel|null>{
    const hash=createHash('sha256').update(token).digest('hex');
    const r=await this.db.query<any>(`SELECT id,agency_id AS "agencyId",provider,external_account_id AS "externalAccountId",external_phone_number_id AS "externalPhoneNumberId",encrypted_credentials,credential_key_version AS "keyVersion"
      FROM channel_connections WHERE provider=$1 AND status IN ('pending','active','reauthorization_required') AND webhook_secret_hash=$2 ORDER BY updated_at DESC LIMIT 2`,[provider,hash]);
    if(r.rows.length>1) throw new ServiceUnavailableException('Webhook verification token maps to multiple channel connections');
    const row=r.rows[0];if(!row)return null;
    await this.db.query('UPDATE channel_connections SET webhook_verified_at=now() WHERE id=$1 AND agency_id=$2',[row.id,row.agencyId]);
    return {id:row.id,agencyId:row.agencyId,provider:row.provider,externalAccountId:row.externalAccountId,externalPhoneNumberId:row.externalPhoneNumberId,credentials:this.decrypt(row.encrypted_credentials,row.keyVersion),keyVersion:row.keyVersion,webhookVerified:true};
  }
}
