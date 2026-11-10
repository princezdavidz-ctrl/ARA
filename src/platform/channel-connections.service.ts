import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { createCipheriv, createHash, randomBytes } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import { AraUser } from './auth.guard';

type Provider = 'whatsapp'|'email'|'instagram'|'facebook_messenger'|'tiktok';
const providers: Provider[] = ['whatsapp','email','instagram','facebook_messenger','tiktok'];
type ConnectionRow = { id:string; provider:Provider; displayName:string; externalAccountId:string; externalPhoneNumberId:string|null; status:string; scopes:string[]; lastVerifiedAt:string|null; lastErrorCode:string|null; createdAt:string; updatedAt:string; };

@Injectable()
export class ChannelConnectionsService {
  constructor(private readonly db:DatabaseService) {}

  private requireManager(user:AraUser) {
    if (!['owner','admin'].includes(user.role)) throw new ForbiddenException('Only company owners and administrators can manage channel connections');
  }
  private encryptionKey():Buffer {
    const raw=String(process.env.ARA_CHANNEL_ENCRYPTION_KEY||'').trim();
    if (!raw) throw new ServiceUnavailableException('Channel credential encryption is not configured');
    let key:Buffer;
    if (/^[0-9a-f]{64}$/i.test(raw)) key=Buffer.from(raw,'hex');
    else { try { key=Buffer.from(raw,'base64'); } catch { throw new ServiceUnavailableException('Invalid channel encryption key'); } }
    if (key.length!==32) throw new ServiceUnavailableException('ARA_CHANNEL_ENCRYPTION_KEY must encode exactly 32 bytes (64 hex characters or base64)');
    return key;
  }
  private encrypt(value:Record<string,unknown>):Buffer {
    const nonce=randomBytes(12),cipher=createCipheriv('aes-256-gcm',this.encryptionKey(),nonce);
    const ciphertext=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);
    const tag=cipher.getAuthTag();
    return Buffer.concat([Buffer.from('ARA1'),nonce,tag,ciphertext]);
  }
  private safeCredentials(input:unknown):Record<string,unknown> {
    if (!input || typeof input!=='object' || Array.isArray(input)) throw new BadRequestException('credentials must be an object');
    const json=JSON.stringify(input);
    if (Buffer.byteLength(json,'utf8')>16384) throw new BadRequestException('Credentials exceed the 16 KB limit');
    const value=JSON.parse(json);
    const keys=Object.keys(value);
    if (!keys.length || keys.length>30 || keys.some(k=>! /^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(k))) throw new BadRequestException('Provide a valid credential object');
    for (const [k,v] of Object.entries(value)) if (typeof v!=='string' || !v.trim() || v.length>8192) throw new BadRequestException('Credential values must be non-empty strings up to 8192 characters');
    return value;
  }
  private async audit(user:AraUser,action:string,id:string,details:Record<string,unknown>={}) {
    await this.db.query('INSERT INTO audit_logs(agency_id,actor_user_id,action,target_type,target_id,details) VALUES($1,$2,$3,$4,$5,$6)',
      [user.agencyId,user.id,action,'channel_connection',id,JSON.stringify(details)]);
  }
  private projection():string {
    return 'id,provider,display_name AS "displayName",external_account_id AS "externalAccountId",external_phone_number_id AS "externalPhoneNumberId",status,scopes,last_verified_at AS "lastVerifiedAt",last_error_code AS "lastErrorCode",created_at AS "createdAt",updated_at AS "updatedAt"';
  }
  async list(user:AraUser) {
    const r=await this.db.query<ConnectionRow>('SELECT '+this.projection()+' FROM channel_connections WHERE agency_id=$1 ORDER BY created_at DESC',[user.agencyId]);
    return {items:r.rows};
  }
  async create(user:AraUser,body:any) {
    this.requireManager(user);
    const provider=String(body?.provider||'') as Provider;
    const displayName=String(body?.displayName||'').trim();
    const externalAccountId=String(body?.externalAccountId||'').trim();
    const phone=body?.externalPhoneNumberId==null?null:String(body.externalPhoneNumberId).trim();
    const credentials=this.safeCredentials(body?.credentials);
    if (!providers.includes(provider)||displayName.length<2||displayName.length>120||!externalAccountId||externalAccountId.length>255||(phone&&phone.length>255)) {
      throw new BadRequestException('Provide a supported provider, displayName, externalAccountId and valid optional externalPhoneNumberId');
    }
    const encrypted=this.encrypt(credentials),keyVersion=String(process.env.ARA_CHANNEL_ENCRYPTION_KEY_VERSION||'v1').slice(0,32),verifyToken=credentials.webhookVerifyToken?createHash('sha256').update(credentials.webhookVerifyToken).digest('hex'):null;
    try {
      return await this.db.transaction(async client=>{
        const r=await client.query<ConnectionRow>('INSERT INTO channel_connections(agency_id,provider,display_name,external_account_id,external_phone_number_id,status,encrypted_credentials,credential_key_version,webhook_secret_hash,connected_by) VALUES($1,$2,$3,$4,$5,\'pending\',$6,$7,$8,$9) RETURNING '+this.projection(),
          [user.agencyId,provider,displayName,externalAccountId,phone,encrypted,keyVersion,verifyToken,user.id]);
        await client.query('INSERT INTO audit_logs(agency_id,actor_user_id,action,target_type,target_id,details) VALUES($1,$2,$3,$4,$5,$6)',
          [user.agencyId,user.id,'channel.connection_created','channel_connection',r.rows[0].id,JSON.stringify({provider})]);
        return {connection:r.rows[0],message:'Connection saved securely. Provider authorization and webhook verification are still required before activation.'};
      });
    } catch(e:any) { if(e.code==='23505') throw new ConflictException('This provider account is already connected to ARA'); throw e; }
  }
  async updateCredentials(user:AraUser,id:string,body:any) {
    this.requireManager(user);
    const credentials=this.safeCredentials(body?.credentials),encrypted=this.encrypt(credentials),keyVersion=String(process.env.ARA_CHANNEL_ENCRYPTION_KEY_VERSION||'v1').slice(0,32),verifyToken=credentials.webhookVerifyToken?createHash('sha256').update(credentials.webhookVerifyToken).digest('hex'):null;
    const r=await this.db.query<ConnectionRow>('UPDATE channel_connections SET encrypted_credentials=$3,credential_key_version=$4,webhook_secret_hash=$5,status=\'reauthorization_required\',last_error_code=NULL,updated_at=now() WHERE agency_id=$1 AND id=$2 RETURNING '+this.projection(),[user.agencyId,id,encrypted,keyVersion,verifyToken]);
    if(!r.rowCount) throw new NotFoundException('Channel connection not found');
    await this.audit(user,'channel.credentials_rotated',id,{});
    return {connection:r.rows[0]};
  }
  async setStatus(user:AraUser,id:string,body:any) {
    this.requireManager(user);
    const status=String(body?.status||'');
    if(!['disabled','pending'].includes(status)) throw new BadRequestException('Status can only be changed to disabled or pending; activation requires provider verification');
    const r=await this.db.query<ConnectionRow>('UPDATE channel_connections SET status=$3,updated_at=now() WHERE agency_id=$1 AND id=$2 RETURNING '+this.projection(),[user.agencyId,id,status]);
    if(!r.rowCount) throw new NotFoundException('Channel connection not found');
    await this.audit(user,status==='disabled'?'channel.connection_disabled':'channel.connection_requeued',id,{status});
    return {connection:r.rows[0]};
  }
}
