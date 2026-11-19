import { BadRequestException, Body, Controller, Param, Post, Req, UseGuards, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { ApiKeyGuard } from './api-key.guard';

@Controller('public/v1')
@UseGuards(ApiKeyGuard)
export class PublicApiController {
  constructor(private readonly db:DatabaseService) {}

  @Post('conversations')
  async createConversation(@Req() req:any,@Body() body:any){
    const agencyId=req.araApiKey.agencyId;
    const channel=String(body?.channel||'web');
    const customerName=String(body?.customerName||'').trim().slice(0,160)||null;
    const customerContact=String(body?.customerContact||'').trim().slice(0,255)||null;
    if(!['web','whatsapp','email','instagram','tiktok','other'].includes(channel))throw new BadRequestException('Unsupported conversation channel.');
    const result=await this.db.query(`INSERT INTO conversations(agency_id,channel,customer_name,customer_contact)
      VALUES($1,$2,$3,$4) RETURNING id,channel,status,created_at AS "createdAt"`,[agencyId,channel,customerName,customerContact]);
    return result.rows[0];
  }

  @Post('conversations/:id/messages')
  async createInboundMessage(@Req() req:any,@Param('id') id:string,@Body() body:any){
    const agencyId=req.araApiKey.agencyId;
    const message=String(body?.message||'').trim();
    const idempotencyKey=String(body?.idempotencyKey||'').trim().slice(0,160)||null;
    if(!message||message.length>12000)throw new BadRequestException('Message must be between 1 and 12000 characters.');
    const conversation=await this.db.query('SELECT id FROM conversations WHERE id=$1 AND agency_id=$2',[id,agencyId]);
    if(!conversation.rowCount)throw new NotFoundException('Conversation not found.');
    const result=await this.db.query(`INSERT INTO messages(agency_id,conversation_id,direction,sender_type,body,idempotency_key,delivery_status,processing_status)
      VALUES($1,$2,'inbound','customer',$3,$4,'stored','pending')
      ON CONFLICT(agency_id,idempotency_key) DO UPDATE SET idempotency_key=EXCLUDED.idempotency_key
      RETURNING id,conversation_id AS "conversationId",direction,processing_status AS "processingStatus",created_at AS "createdAt"`,
      [agencyId,id,message,idempotencyKey]);
    await this.db.query("UPDATE conversations SET status='open',updated_at=now() WHERE id=$1 AND agency_id=$2",[id,agencyId]);
    return result.rows[0];
  }
}
