import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AnswerService } from '../rag/answer.service';
import { AnswerInput } from '../rag/contracts';

@Injectable()
export class MessageWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger=new Logger(MessageWorker.name);
  private timer:ReturnType<typeof setInterval>|undefined;
  private running=false;
  constructor(private db:DatabaseService,private answers:AnswerService){}
  onModuleInit(){this.timer=setInterval(()=>void this.tick(),1500);void this.tick();}
  onModuleDestroy(){if(this.timer)clearInterval(this.timer);}
  private async tick(){
    if(this.running)return;this.running=true;
    try{for(let i=0;i<5;i++){const job=await this.claim();if(!job)break;await this.process(job);}}
    catch(e){this.logger.error('Message worker cycle failed',e instanceof Error?e.stack:undefined);}
    finally{this.running=false;}
  }
  private async claim():Promise<any|null>{
    return this.db.transaction(async c=>{
      const r=await c.query(`SELECT m.id,m.agency_id AS "agencyId",m.conversation_id AS "conversationId",m.body
        FROM messages m JOIN conversations cv ON cv.id=m.conversation_id AND cv.agency_id=m.agency_id
        WHERE m.direction='inbound' AND m.processing_status='pending'
        ORDER BY m.created_at LIMIT 1 FOR UPDATE OF m SKIP LOCKED`);
      const job=r.rows[0];if(!job)return null;
      await c.query("UPDATE messages SET processing_status='processing' WHERE id=$1",[job.id]);
      return job;
    });
  }
  private async process(job:any){
    try{
      const result=await this.answers.answer({message:job.body,preferredLanguage:'auto',filters:{}} as AnswerInput,job.agencyId);
      await this.db.transaction(async c=>{
        await c.query(`INSERT INTO messages(agency_id,conversation_id,direction,sender_type,body,idempotency_key,delivery_status,processing_status)
          VALUES($1,$2,'outbound','ai',$3,$4,'queued','not_applicable')
          ON CONFLICT(agency_id,idempotency_key) DO NOTHING`,[job.agencyId,job.conversationId,result.answer,'ai:'+job.id]);
        await c.query("UPDATE messages SET processing_status='completed' WHERE id=$1",[job.id]);
        await c.query("UPDATE conversations SET status=$3,updated_at=now() WHERE id=$1 AND agency_id=$2",[job.conversationId,job.agencyId,result.status==='needs_human'?'pending':'open']);
        if(result.status==='needs_human')await c.query("INSERT INTO escalations(agency_id,conversation_id,reason) SELECT $1,$2,$3 WHERE NOT EXISTS (SELECT 1 FROM escalations WHERE agency_id=$1 AND conversation_id=$2 AND status IN ('open','claimed'))",[job.agencyId,job.conversationId,result.escalationReason||'AI requested human review']);
      });
    }catch(e){
      this.logger.error('Inbound message processing failed',e instanceof Error?e.stack:undefined);
      await this.db.query("UPDATE messages SET processing_status='pending' WHERE id=$1 AND processing_status='processing'",[job.id]);
    }
  }
}
