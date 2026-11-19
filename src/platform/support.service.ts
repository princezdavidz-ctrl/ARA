import { BadRequestException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { DatabaseService } from '../database/database.service';

type Staff = { id:string; email:string; fullName:string; role:string };
@Injectable()
export class SupportService {
  constructor(private readonly db:DatabaseService) {}
  private hash(value:string){return createHash('sha256').update(value).digest('hex');}
  private requireStaff(staff:Staff){if(!['super_admin','platform_support'].includes(staff.role))throw new ForbiddenException('Support staff access required');}
  async createPublicThread(body:any){
    const name=String(body?.name||'').trim().slice(0,120),email=String(body?.email||'').trim().toLowerCase(),message=String(body?.message||'').trim(),language=body?.language==='sw'?'sw':'en';
    if(name.length<2||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||message.length<2||message.length>12000)throw new BadRequestException('Enter your name, a valid email and a message.');
    const token=randomBytes(32).toString('base64url');
    const thread=await this.db.query('INSERT INTO ara_support_threads(visitor_token_hash,visitor_name,visitor_email,language) VALUES($1,$2,$3,$4) RETURNING id,status,language,created_at AS "createdAt"', [this.hash(token),name,email,language]);
    await this.db.query("INSERT INTO ara_support_messages(thread_id,sender_type,body) VALUES($1,'visitor',$2)",[thread.rows[0].id,message]);
    const online=await this.db.query('SELECT count(*)::int AS count FROM ara_support_staff_presence p JOIN platform_admin_users a ON a.id=p.staff_id WHERE p.is_online=true AND p.last_seen_at>now()-interval \'90 seconds\' AND a.is_active=true AND a.role IN (\'super_admin\',\'platform_support\')');
    return {...thread.rows[0],visitorToken:token,staffOnline:Number(online.rows[0]?.count||0)>0};
  }
  private async verifyVisitor(id:string,token:string){
    if(!/^[0-9a-f-]{36}$/i.test(id)||token.length<32)throw new UnauthorizedException('Invalid support session');
    const row=await this.db.query('SELECT id FROM ara_support_threads WHERE id=$1 AND visitor_token_hash=$2',[id,this.hash(token)]);
    if(!row.rowCount)throw new UnauthorizedException('Invalid support session');
  }
  async publicMessages(id:string,token:string,after?:string){
    await this.verifyVisitor(id,token);
    const rows=await this.db.query('SELECT id,sender_type AS "senderType",body,created_at AS "createdAt" FROM ara_support_messages WHERE thread_id=$1 AND ($2::timestamptz IS NULL OR created_at>$2) ORDER BY created_at LIMIT 100',[id,after||null]);
    const thread=await this.db.query('SELECT status FROM ara_support_threads WHERE id=$1',[id]);
    return {messages:rows.rows,status:thread.rows[0]?.status||'resolved'};
  }
  async addPublicMessage(id:string,body:any){
    const token=String(body?.visitorToken||''),message=String(body?.message||'').trim();
    await this.verifyVisitor(id,token);
    if(message.length<1||message.length>12000)throw new BadRequestException('Message must be 1–12,000 characters.');
    const status=await this.db.query("SELECT status FROM ara_support_threads WHERE id=$1",[id]);
    if(status.rows[0]?.status==='resolved')throw new ForbiddenException('This support conversation is closed.');
    await this.db.query("INSERT INTO ara_support_messages(thread_id,sender_type,body) VALUES($1,'visitor',$2)",[id,message]);
    await this.db.query('UPDATE ara_support_threads SET updated_at=now(),last_message_at=now() WHERE id=$1',[id]);
    return {accepted:true};
  }
  async inbox(staff:Staff){
    this.requireStaff(staff);
    const r=await this.db.query(`SELECT t.id,t.visitor_name AS "visitorName",t.visitor_email AS "visitorEmail",t.language,t.status,t.assigned_staff_id AS "assignedStaffId",t.created_at AS "createdAt",t.last_message_at AS "lastMessageAt",
      (SELECT m.body FROM ara_support_messages m WHERE m.thread_id=t.id ORDER BY m.created_at DESC LIMIT 1) AS "lastMessage",
      (SELECT count(*)::int FROM ara_support_messages m WHERE m.thread_id=t.id AND m.sender_type='visitor' AND m.created_at>coalesce((SELECT max(sm.created_at) FROM ara_support_messages sm WHERE sm.thread_id=t.id AND sm.sender_type='staff'),'-infinity'::timestamptz)) AS "unreadCount"
      FROM ara_support_threads t WHERE t.status<>'resolved' ORDER BY CASE WHEN t.status='waiting' THEN 0 ELSE 1 END,t.last_message_at DESC LIMIT 200`);
    const presence=await this.db.query('SELECT count(*)::int AS count FROM ara_support_staff_presence p JOIN platform_admin_users a ON a.id=p.staff_id WHERE p.is_online=true AND p.last_seen_at>now()-interval \'90 seconds\' AND a.is_active=true AND a.role IN (\'super_admin\',\'platform_support\')');
    return {items:r.rows,staffOnline:Number(presence.rows[0]?.count||0)};
  }
  async thread(staff:Staff,id:string){this.requireStaff(staff);const r=await this.db.query('SELECT id,visitor_name AS "visitorName",visitor_email AS "visitorEmail",language,status,assigned_staff_id AS "assignedStaffId" FROM ara_support_threads WHERE id=$1',[id]);if(!r.rowCount)throw new NotFoundException('Support conversation not found');const messages=await this.db.query('SELECT id,sender_type AS "senderType",body,created_at AS "createdAt" FROM ara_support_messages WHERE thread_id=$1 ORDER BY created_at',[id]);return {...r.rows[0],messages:messages.rows};}
  async claim(staff:Staff,id:string){this.requireStaff(staff);const r=await this.db.query("UPDATE ara_support_threads SET status='claimed',assigned_staff_id=$2,updated_at=now() WHERE id=$1 AND status<>'resolved' AND (assigned_staff_id IS NULL OR assigned_staff_id=$2) RETURNING id,status,assigned_staff_id AS \"assignedStaffId\"",[id,staff.id]);if(!r.rowCount)throw new ForbiddenException('This conversation is already assigned to another staff member.');return r.rows[0];}
  async reply(staff:Staff,id:string,body:any){this.requireStaff(staff);const message=String(body?.message||'').trim();if(message.length<1||message.length>12000)throw new BadRequestException('Message must be 1–12,000 characters.');const thread=await this.db.query("SELECT id,status,assigned_staff_id FROM ara_support_threads WHERE id=$1",[id]);if(!thread.rowCount)throw new NotFoundException('Support conversation not found');if(thread.rows[0].status==='resolved')throw new ForbiddenException('This conversation is closed.');if(thread.rows[0].assigned_staff_id&&thread.rows[0].assigned_staff_id!==staff.id)throw new ForbiddenException('This conversation belongs to another staff member.');await this.db.query("UPDATE ara_support_threads SET status='claimed',assigned_staff_id=$2,updated_at=now(),last_message_at=now() WHERE id=$1",[id,staff.id]);const r=await this.db.query("INSERT INTO ara_support_messages(thread_id,sender_type,sender_id,body) VALUES($1,'staff',$2,$3) RETURNING id,sender_type AS \"senderType\",body,created_at AS \"createdAt\"",[id,staff.id,message]);return r.rows[0];}
  async resolve(staff:Staff,id:string){this.requireStaff(staff);const r=await this.db.query("UPDATE ara_support_threads SET status='resolved',updated_at=now() WHERE id=$1 AND status<>'resolved' AND (assigned_staff_id IS NULL OR assigned_staff_id=$2) RETURNING id,status",[id,staff.id]);if(!r.rowCount)throw new ForbiddenException('This conversation cannot be resolved by your account.');return r.rows[0];}
  async presence(staff:Staff,online:boolean){this.requireStaff(staff);await this.db.query('INSERT INTO ara_support_staff_presence(staff_id,is_online,last_seen_at) VALUES($1,$2,now()) ON CONFLICT(staff_id) DO UPDATE SET is_online=EXCLUDED.is_online,last_seen_at=now()',[staff.id,online]);return {online};}
}
