import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import { ConfigService } from '../config/config.service';
import { ChannelCredentialVault } from './channel-credential-vault.service';

@Injectable()
export class InstagramWebhookService {
  constructor(private readonly db: DatabaseService, private readonly config: ConfigService, private readonly vault: ChannelCredentialVault) {}
  async verifySubscription(mode: string, token: string, challenge: string): Promise<string> {
    const expected=this.config.get('INSTAGRAM_VERIFY_TOKEN');
    const a=Buffer.from(token||''); const b=Buffer.from(expected||'');
    const legacyValid=Boolean(expected&&a.length===b.length&&timingSafeEqual(a,b));
    const tenantConnection=!legacyValid&&token?await this.vault.findByVerifyToken('instagram',token):null;
    if(mode!=='subscribe'||(!legacyValid&&!tenantConnection)||!challenge) throw new UnauthorizedException('Instagram webhook verification failed');
    return challenge;
  }
  async receive(rawBody: Buffer|undefined, signature: string|undefined, payload: any) {
    const secret=this.config.get('INSTAGRAM_APP_SECRET');
    const legacyAgencyId=this.config.get('INSTAGRAM_AGENCY_ID');
    const legacyAccountId=this.config.get('INSTAGRAM_ACCOUNT_ID');
    if(!secret) throw new ServiceUnavailableException('Instagram Meta app signature secret is not configured');
    if(!rawBody||!signature||!/^sha256=[a-f0-9]{64}$/i.test(signature)) throw new UnauthorizedException('Missing or invalid Instagram signature');
    const expected=createHmac('sha256',secret).update(rawBody).digest(); const supplied=Buffer.from(signature.slice(7),'hex');
    if(supplied.length!==expected.length||!timingSafeEqual(supplied,expected)) throw new UnauthorizedException('Invalid Instagram webhook signature');
    if(!['instagram','page'].includes(String(payload?.object))||!Array.isArray(payload?.entry)) return {received:true,accepted:0};
    let accepted=0;
    for(const entry of payload.entry){
      const accountId=String(entry?.id||'');
      const connection=await this.vault.findByProviderAccount('instagram',accountId);
      const agencyId=connection?.agencyId||(legacyAgencyId&&legacyAccountId===accountId?legacyAgencyId:undefined);
      if(!agencyId) continue;
      for(const event of entry.messaging||[]){
        const sender=String(event?.sender?.id||''); const messageId=String(event?.message?.mid||'');
        if(!sender||!messageId||event?.message?.is_echo) continue;
        const text=String(event?.message?.text||'').trim();
        const body=text||'[Customer sent an Instagram attachment or unsupported message. Human review is required.]';
        const inserted=await this.db.transaction(async client=>{
          const found=await client.query("SELECT id FROM conversations WHERE agency_id=$1 AND channel='instagram' AND customer_contact=$2 AND status<>'closed' ORDER BY updated_at DESC LIMIT 1 FOR UPDATE",[agencyId,sender]);
          let conversationId=found.rows[0]?.id;
          if(!conversationId){const created=await client.query("INSERT INTO conversations(agency_id,channel,customer_name,customer_contact) VALUES($1,'instagram',$2,$3) RETURNING id",[agencyId,null,sender]);conversationId=created.rows[0].id;}
          const isText=Boolean(text);
          const result=await client.query("INSERT INTO messages(agency_id,conversation_id,direction,sender_type,body,idempotency_key,delivery_status,processing_status) VALUES($1,$2,'inbound','customer',$3,$4,'stored',$5) ON CONFLICT(agency_id,idempotency_key) DO NOTHING RETURNING id",[agencyId,conversationId,body,'instagram:'+messageId,isText?'pending':'not_applicable']);
          if(result.rowCount){await client.query('UPDATE conversations SET updated_at=now() WHERE id=$1 AND agency_id=$2',[conversationId,agencyId]);if(!isText){await client.query("INSERT INTO escalations(agency_id,conversation_id,reason) SELECT $1,$2,$3 WHERE NOT EXISTS(SELECT 1 FROM escalations WHERE agency_id=$1 AND conversation_id=$2 AND status IN ('open','claimed'))",[agencyId,conversationId,'Instagram attachment requires human review']);await client.query("UPDATE conversations SET status='pending' WHERE id=$1 AND agency_id=$2",[conversationId,agencyId]);}}
          return Boolean(result.rowCount);
        });
        if(inserted) accepted++;
      }
    }
    return {received:true,accepted};
  }
}
