import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import { ConfigService } from '../config/config.service';
import { ChannelCredentialVault } from './channel-credential-vault.service';

@Injectable()
export class TikTokWebhookService {
  constructor(private readonly db:DatabaseService,private readonly config:ConfigService,private readonly vault:ChannelCredentialVault){}
  async receive(rawBody:Buffer|undefined,timestamp:string|undefined,signature:string|undefined,payload:any){
    const businessId=String(payload?.business_id||payload?.business?.id||payload?.data?.business_id||payload?.account_id||'').trim();
    const connection=businessId?await this.vault.findByProviderAccount('tiktok',businessId):null;
    const legacyBusinessId=this.config.get('TIKTOK_BUSINESS_ID');
    const legacyMatches=!connection&&(!businessId||businessId===legacyBusinessId);
    const secret=connection?.credentials.webhookSecret||(legacyMatches?this.config.get('TIKTOK_WEBHOOK_SECRET'):undefined);
    const agencyId=connection?.agencyId||(legacyMatches?this.config.get('TIKTOK_AGENCY_ID'):undefined);
    if(!secret||!agencyId)throw new ServiceUnavailableException('TikTok channel is not configured for this business account');
    if(!rawBody||!timestamp||!signature||!/^\d{10}$/.test(timestamp)||!/^sha256=[a-f0-9]{64}$/i.test(signature))throw new UnauthorizedException('Missing or invalid TikTok webhook signature');
    const seconds=Number(timestamp);if(!Number.isSafeInteger(seconds)||Math.abs(Date.now()/1000-seconds)>300)throw new UnauthorizedException('TikTok webhook timestamp outside allowed window');
    const expected=createHmac('sha256',secret).update(timestamp+'.').update(rawBody).digest();const supplied=Buffer.from(signature.slice(7),'hex');
    if(supplied.length!==expected.length||!timingSafeEqual(supplied,expected))throw new UnauthorizedException('Invalid TikTok webhook signature');
    let content=payload?.content;
    if(typeof content==='string'){try{content=JSON.parse(content);}catch{throw new UnauthorizedException('Invalid TikTok webhook content JSON');}}
    if(String(payload?.event_type||payload?.event||'').toUpperCase()!=='DIRECT_MESSAGE' && !String(payload?.event||'').startsWith('im_'))return {received:true,accepted:0};
    const conversationId=String(content?.conversation_id||content?.conversation?.conversation_id||'');
    const messageId=String(content?.message_id||content?.message?.message_id||'');
    const sender=content?.from_user||content?.sender||{};
    const senderId=String(sender?.open_id||content?.sender_open_id||content?.from_open_id||'');
    const messageType=String(content?.message_type||content?.message?.message_type||'TEXT');
    const text=String(content?.text?.body||content?.message?.text?.body||content?.text||'').trim();
    if(!conversationId||!messageId||!senderId)return {received:true,accepted:0};
    const body=text||'[Customer sent a TikTok non-text message. Human review is required.]';
    const inserted=await this.db.transaction(async client=>{
      const found=await client.query("SELECT id FROM conversations WHERE agency_id=$1 AND channel='tiktok' AND channel_connection_id IS NOT DISTINCT FROM $2::uuid AND customer_contact=$3 AND status<>'closed' ORDER BY updated_at DESC LIMIT 1 FOR UPDATE",[agencyId,connection?.id||null,conversationId]);
      let localId=found.rows[0]?.id;
      if(!localId){const created=await client.query("INSERT INTO conversations(agency_id,channel,channel_connection_id,customer_name,customer_contact) VALUES($1,'tiktok',$2,$3,$4) RETURNING id",[agencyId,connection?.id||null,String(sender?.display_name||sender?.username||'')||null,conversationId]);localId=created.rows[0].id;}
      const isText=messageType==='TEXT'&&Boolean(text);
      const result=await client.query("INSERT INTO messages(agency_id,conversation_id,direction,sender_type,body,idempotency_key,delivery_status,processing_status) VALUES($1,$2,'inbound','customer',$3,$4,'stored',$5) ON CONFLICT(agency_id,idempotency_key) DO NOTHING RETURNING id",[agencyId,localId,body,'tiktok:'+messageId,isText?'pending':'not_applicable']);
      if(result.rowCount){await client.query('UPDATE conversations SET updated_at=now() WHERE id=$1 AND agency_id=$2',[localId,agencyId]);if(!isText){await client.query("INSERT INTO escalations(agency_id,conversation_id,reason) SELECT $1,$2,$3 WHERE NOT EXISTS(SELECT 1 FROM escalations WHERE agency_id=$1 AND conversation_id=$2 AND status IN ('open','claimed'))",[agencyId,localId,'TikTok non-text message requires human review']);await client.query("UPDATE conversations SET status='pending' WHERE id=$1 AND agency_id=$2",[localId,agencyId]);}}
      return Boolean(result.rowCount);
    });
    return {received:true,accepted:inserted?1:0};
  }
}
