import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AraUser } from './auth.guard';
import { leadCreateSchema, leadNoteSchema, leadStatusSchema, leadUpdateSchema } from './lead.contracts';

@Injectable()
export class LeadService {
  constructor(private readonly db: DatabaseService) {}

  private async audit(u: AraUser, action: string, id: string, details: Record<string, unknown> = {}) {
    await this.db.query(
      'INSERT INTO audit_logs(agency_id,actor_user_id,action,target_type,target_id,details) VALUES($1,$2,$3,\'lead\',$4,$5)',
      [u.agencyId, u.id, action, id, JSON.stringify(details)],
    );
  }

  async list(u: AraUser, q: {status?:string;assignedUserId?:string;source?:string;search?:string;dueFollowUp?:boolean;limit:number;offset:number}) {
    const result = await this.db.query(
      `SELECT l.id,l.contact_name AS "contactName",l.email,l.phone,l.source,l.status,
        l.interested_purpose AS "interestedPurpose",l.property_id AS "propertyId",
        l.conversation_id AS "conversationId",l.county,l.town,l.budget_min::text AS "budgetMin",
        l.budget_max::text AS "budgetMax",l.assigned_user_id AS "assignedUserId",
        u.full_name AS "assignedUserName",l.follow_up_at AS "followUpAt",
        l.created_at AS "createdAt",l.updated_at AS "updatedAt"
       FROM leads l LEFT JOIN agency_users u ON u.id=l.assigned_user_id AND u.agency_id=l.agency_id
       WHERE l.agency_id=$1 AND ($2::text IS NULL OR l.status=$2)
        AND ($3::uuid IS NULL OR l.assigned_user_id=$3)
        AND ($4::text IS NULL OR l.source=$4)
        AND ($5::text IS NULL OR concat_ws(' ',l.contact_name,l.email,l.phone,l.county,l.town) ILIKE '%'||$5||'%')
        AND (NOT $6::boolean OR (l.follow_up_at IS NOT NULL AND l.follow_up_at <= now()))
       ORDER BY l.follow_up_at ASC NULLS LAST,l.updated_at DESC LIMIT $7 OFFSET $8`,
      [u.agencyId,q.status??null,q.assignedUserId??null,q.source??null,q.search??null,q.dueFollowUp??false,q.limit,q.offset],
    );
    return result.rows;
  }

  async get(u: AraUser, id: string) {
    const result = await this.db.query(
      `SELECT l.id,l.contact_name AS "contactName",l.email,l.phone,l.source,l.status,
        l.interested_purpose AS "interestedPurpose",l.property_id AS "propertyId",
        l.conversation_id AS "conversationId",l.county,l.town,l.budget_min::text AS "budgetMin",
        l.budget_max::text AS "budgetMax",l.assigned_user_id AS "assignedUserId",
        l.follow_up_at AS "followUpAt",l.created_at AS "createdAt",l.updated_at AS "updatedAt"
       FROM leads l WHERE l.id=$1 AND l.agency_id=$2`, [id,u.agencyId]);
    if (!result.rowCount) throw new NotFoundException('Lead not found');
    const notes = await this.db.query(
      `SELECT n.id,n.body,n.author_user_id AS "authorUserId",a.full_name AS "authorName",n.created_at AS "createdAt"
       FROM lead_notes n LEFT JOIN agency_users a ON a.id=n.author_user_id AND a.agency_id=n.agency_id
       WHERE n.lead_id=$1 AND n.agency_id=$2 ORDER BY n.created_at`, [id,u.agencyId]);
    return {...result.rows[0],notes:notes.rows};
  }

  async create(u: AraUser, body: unknown) {
    const parsed = leadCreateSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const v = parsed.data;
    if (v.assignedUserId) this.assertAssignmentPermission(u);
    if (v.assignedUserId) await this.ensureActiveAssignee(u.agencyId,v.assignedUserId);
    const result = await this.db.query(
      `INSERT INTO leads(agency_id,contact_name,email,phone,source,interested_purpose,property_id,conversation_id,
        county,town,budget_min,budget_max,assigned_user_id,follow_up_at,created_by)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING id,contact_name AS "contactName",email,phone,source,status,assigned_user_id AS "assignedUserId",
        follow_up_at AS "followUpAt",created_at AS "createdAt"`,
      [u.agencyId,v.contactName,v.email??null,v.phone??null,v.source,v.interestedPurpose??null,v.propertyId??null,
       v.conversationId??null,v.county??null,v.town??null,v.budgetMin??null,v.budgetMax??null,
       v.assignedUserId??null,v.followUpAt??null,u.id],
    );
    await this.audit(u,'lead.created',result.rows[0].id,{source:v.source});
    return result.rows[0];
  }

  async update(u: AraUser, id: string, body: unknown) {
    const parsed = leadUpdateSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const v = parsed.data;
    if (Object.prototype.hasOwnProperty.call(v,'assignedUserId')) {
      this.assertAssignmentPermission(u);
      if (v.assignedUserId) await this.ensureActiveAssignee(u.agencyId,v.assignedUserId);
    }
    const current = await this.db.query('SELECT * FROM leads WHERE id=$1 AND agency_id=$2',[id,u.agencyId]);
    if (!current.rowCount) throw new NotFoundException('Lead not found');
    const r = current.rows[0];
    const merged = {
      contactName:v.contactName??r.contact_name,email:Object.prototype.hasOwnProperty.call(v,'email')?v.email:r.email,
      phone:Object.prototype.hasOwnProperty.call(v,'phone')?v.phone:r.phone,source:v.source??r.source,
      interestedPurpose:Object.prototype.hasOwnProperty.call(v,'interestedPurpose')?v.interestedPurpose:r.interested_purpose,
      propertyId:Object.prototype.hasOwnProperty.call(v,'propertyId')?v.propertyId:r.property_id,
      conversationId:Object.prototype.hasOwnProperty.call(v,'conversationId')?v.conversationId:r.conversation_id,
      county:Object.prototype.hasOwnProperty.call(v,'county')?v.county:r.county,
      town:Object.prototype.hasOwnProperty.call(v,'town')?v.town:r.town,
      budgetMin:Object.prototype.hasOwnProperty.call(v,'budgetMin')?v.budgetMin:r.budget_min,
      budgetMax:Object.prototype.hasOwnProperty.call(v,'budgetMax')?v.budgetMax:r.budget_max,
      assignedUserId:Object.prototype.hasOwnProperty.call(v,'assignedUserId')?v.assignedUserId:r.assigned_user_id,
      followUpAt:Object.prototype.hasOwnProperty.call(v,'followUpAt')?v.followUpAt:r.follow_up_at,
    };
    if (!merged.email && !merged.phone) throw new BadRequestException('A lead must have an email address or phone number');
    const result = await this.db.query(
      `UPDATE leads SET contact_name=$3,email=$4,phone=$5,source=$6,interested_purpose=$7,property_id=$8,
        conversation_id=$9,county=$10,town=$11,budget_min=$12,budget_max=$13,assigned_user_id=$14,
        follow_up_at=$15,updated_at=now() WHERE id=$1 AND agency_id=$2
       RETURNING id,contact_name AS "contactName",email,phone,source,status,assigned_user_id AS "assignedUserId",
        follow_up_at AS "followUpAt",updated_at AS "updatedAt"`,
      [id,u.agencyId,merged.contactName,merged.email,merged.phone,merged.source,merged.interestedPurpose,
       merged.propertyId,merged.conversationId,merged.county,merged.town,merged.budgetMin,merged.budgetMax,
       merged.assignedUserId,merged.followUpAt],
    );
    await this.audit(u,'lead.updated',id,{fields:Object.keys(v)});
    return result.rows[0];
  }

  async setStatus(u: AraUser,id:string,body:unknown) {
    const parsed=leadStatusSchema.safeParse(body);
    if(!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const r=await this.db.query(
      'UPDATE leads SET status=$3,updated_at=now() WHERE id=$1 AND agency_id=$2 RETURNING id,status,updated_at AS "updatedAt"',
      [id,u.agencyId,parsed.data.status]);
    if(!r.rowCount) throw new NotFoundException('Lead not found');
    await this.audit(u,'lead.status_changed',id,{status:parsed.data.status});
    return r.rows[0];
  }

  async addNote(u: AraUser,id:string,body:unknown) {
    const parsed=leadNoteSchema.safeParse(body);
    if(!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const r=await this.db.query(
      `INSERT INTO lead_notes(agency_id,lead_id,author_user_id,body)
       SELECT $1,id,$3,$4 FROM leads WHERE id=$2 AND agency_id=$1
       RETURNING id,lead_id AS "leadId",body,created_at AS "createdAt"`,
      [u.agencyId,id,u.id,parsed.data.body]);
    if(!r.rowCount) throw new NotFoundException('Lead not found');
    await this.db.query('UPDATE leads SET updated_at=now() WHERE id=$1 AND agency_id=$2',[id,u.agencyId]);
    await this.audit(u,'lead.note_added',id);
    return r.rows[0];
  }

  private assertAssignmentPermission(u:AraUser) {
    if (!['owner','admin','manager'].includes(u.role)) throw new ForbiddenException('Only owners, admins and managers can assign leads');
  }

  private async ensureActiveAssignee(agencyId:string,userId:string) {
    const r=await this.db.query('SELECT id FROM agency_users WHERE id=$1 AND agency_id=$2 AND is_active=true',[userId,agencyId]);
    if (!r.rowCount) throw new BadRequestException('Assigned user must be an active member of this agency');
  }
}
