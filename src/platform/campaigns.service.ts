import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AraUser } from './auth.guard';

type CampaignChannel = 'email'|'sms'|'whatsapp'|'instagram'|'tiktok';
const channels: CampaignChannel[] = ['email','sms','whatsapp','instagram','tiktok'];

@Injectable()
export class CampaignsService {
  constructor(private readonly db: DatabaseService) {}

  private requireManager(user: AraUser) {
    if (!['owner','admin','manager'].includes(user.role)) throw new ForbiddenException('Only owners, administrators and managers can manage campaigns.');
  }

  private validateFilters(input: unknown): Record<string, unknown> {
    if (input === undefined || input === null) return {};
    if (typeof input !== 'object' || Array.isArray(input)) throw new BadRequestException('Audience filters must be an object.');
    const value = input as Record<string, unknown>;
    const allowed = ['status','lastContactDays','search'];
    if (Object.keys(value).some(key => !allowed.includes(key))) throw new BadRequestException('Unsupported audience filter.');
    if (value.status !== undefined && !['open','pending','closed','any'].includes(String(value.status))) throw new BadRequestException('Invalid conversation status filter.');
    if (value.lastContactDays !== undefined && (typeof value.lastContactDays !== 'number' || !Number.isInteger(value.lastContactDays) || value.lastContactDays < 1 || value.lastContactDays > 3650)) throw new BadRequestException('lastContactDays must be an integer between 1 and 3650.');
    if (value.search !== undefined && (typeof value.search !== 'string' || value.search.length > 100)) throw new BadRequestException('Search filter must be 100 characters or fewer.');
    return value;
  }

  private async targets(agencyId: string, channel: CampaignChannel, filters: Record<string, unknown>) {
    const args: unknown[] = [agencyId, channel];
    const where = [
      'c.agency_id=$1',
      'c.channel=$2',
      "c.customer_contact IS NOT NULL",
      "btrim(c.customer_contact)<>''"
    ];
    if (filters.status && filters.status !== 'any') { args.push(filters.status); where.push('c.status=$'+args.length); }
    if (filters.lastContactDays) { args.push(filters.lastContactDays); where.push('c.updated_at >= now()-($'+args.length+'::int * interval \'1 day\')'); }
    if (filters.search) { args.push('%'+String(filters.search).replace(/[\\%_]/g, '\\$&')+'%'); where.push('(COALESCE(c.customer_name,\'\') ILIKE $'+args.length+' OR c.customer_contact ILIKE $'+args.length+')'); }
    if (channel === 'sms') {
      where.push("EXISTS (SELECT 1 FROM sms_contact_preferences p WHERE p.agency_id=c.agency_id AND p.phone_number=c.customer_contact AND p.consent_status='opted_in')");
    } else {
      const contactKey = channel === 'email' ? 'lower(trim(c.customer_contact))' : 'lower(trim(c.customer_contact))';
      where.push("EXISTS (SELECT 1 FROM campaign_contact_consents p WHERE p.agency_id=c.agency_id AND p.channel=$2 AND p.contact_key="+contactKey+" AND p.consent_status='opted_in')");
    }
    const result = await this.db.query(
      `SELECT DISTINCT ON (lower(trim(c.customer_contact))) c.id,c.customer_contact AS contact,c.customer_name AS name,c.updated_at AS "lastContactAt"
       FROM conversations c WHERE ${where.join(' AND ')}
       ORDER BY lower(trim(c.customer_contact)),c.updated_at DESC LIMIT 10000`,
      args,
    );
    return result.rows;
  }

  async preview(user: AraUser, body: any) {
    this.requireManager(user);
    const channel = String(body?.channel || '') as CampaignChannel;
    if (!channels.includes(channel)) throw new BadRequestException('Unsupported campaign channel.');
    const filters = this.validateFilters(body?.filters);
    const rows = await this.targets(user.agencyId, channel, filters);
    return { channel, eligibleRecipients: rows.length, consentRequired: true, filters };
  }

  async create(user: AraUser, body: any) {
    this.requireManager(user);
    const name = String(body?.name || '').trim();
    const channel = String(body?.channel || '') as CampaignChannel;
    const subject = String(body?.subject || '').trim().slice(0, 500) || null;
    const content = String(body?.body || '').trim();
    const filters = this.validateFilters(body?.filters);
    if (name.length < 2 || name.length > 120) throw new BadRequestException('Campaign name must be 2–120 characters.');
    if (!channels.includes(channel)) throw new BadRequestException('Unsupported campaign channel.');
    if (!content || content.length > 12000) throw new BadRequestException('Campaign message must be 1–12,000 characters.');
    if (channel === 'email' && !subject) throw new BadRequestException('Email campaigns require a subject.');
    const scheduledAt = body?.scheduledAt ? new Date(body.scheduledAt) : null;
    if (body?.scheduledAt && (!scheduledAt || Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now())) throw new BadRequestException('scheduledAt must be a valid future date.');
    const status = scheduledAt ? 'scheduled' : 'draft';
    const result = await this.db.query(
      `INSERT INTO campaigns(agency_id,name,channel,subject,body,filters,status,scheduled_at,created_by)
       VALUES($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9)
       RETURNING id,name,channel,subject,filters,status,scheduled_at AS "scheduledAt",created_at AS "createdAt"`,
      [user.agencyId,name,channel,subject,content,JSON.stringify(filters),status,scheduledAt,user.id],
    );
    return result.rows[0];
  }

  async list(user: AraUser) {
    return (await this.db.query(
      `SELECT c.id,c.name,c.channel,c.subject,c.status,c.scheduled_at AS "scheduledAt",c.created_at AS "createdAt",
        count(r.id)::int AS "recipientCount",
        count(r.id) FILTER(WHERE r.status IN ('sent','delivered'))::int AS "sentCount",
        count(r.id) FILTER(WHERE r.status='failed')::int AS "failedCount"
       FROM campaigns c LEFT JOIN campaign_recipients r ON r.campaign_id=c.id AND r.agency_id=c.agency_id
       WHERE c.agency_id=$1 GROUP BY c.id ORDER BY c.created_at DESC LIMIT 200`,
      [user.agencyId],
    )).rows;
  }

  async detail(user: AraUser, id: string) {
    const campaign = await this.db.query(
      `SELECT id,name,channel,subject,body,filters,status,scheduled_at AS "scheduledAt",created_at AS "createdAt",queued_at AS "queuedAt"
       FROM campaigns WHERE id=$1 AND agency_id=$2`,
      [id,user.agencyId],
    );
    if (!campaign.rowCount) throw new NotFoundException('Campaign not found.');
    const recipients = await this.db.query(
      `SELECT r.id,r.contact,r.status,r.failure_reason AS "failureReason",r.created_at AS "createdAt",
        c.customer_name AS "customerName",r.conversation_id AS "conversationId"
       FROM campaign_recipients r JOIN conversations c ON c.id=r.conversation_id AND c.agency_id=r.agency_id
       WHERE r.campaign_id=$1 AND r.agency_id=$2 ORDER BY r.created_at DESC LIMIT 500`,
      [id,user.agencyId],
    );
    return { campaign: campaign.rows[0], recipients: recipients.rows };
  }

  async recordConsent(user: AraUser, body: any) {
    this.requireManager(user);
    const channel = String(body?.channel || '') as CampaignChannel;
    const contact = String(body?.contact || '').trim();
    const status = String(body?.status || '');
    const source = String(body?.source || '').trim().slice(0, 200);
    if (!channels.includes(channel) || channel === 'sms') throw new BadRequestException('Consent endpoint supports email, WhatsApp, Instagram and TikTok; SMS consent is managed by STOP/START replies.');
    if (!contact || contact.length > 320 || !['opted_in','opted_out'].includes(status) || source.length < 2) throw new BadRequestException('Provide a contact, consent status and consent source.');
    const key = channel === 'email' ? contact.toLowerCase() : contact.toLowerCase();
    await this.db.query(
      `INSERT INTO campaign_contact_consents(agency_id,channel,contact_key,consent_status,source,updated_by)
       VALUES($1,$2,$3,$4,$5,$6)
       ON CONFLICT(agency_id,channel,contact_key) DO UPDATE SET consent_status=EXCLUDED.consent_status,source=EXCLUDED.source,updated_by=EXCLUDED.updated_by,updated_at=now()`,
      [user.agencyId,channel,key,status,source,user.id],
    );
    return { channel, contact, status, updated: true };
  }

  async send(user: AraUser, id: string) {
    this.requireManager(user);
    return this.db.transaction(async client => {
      const locked = await client.query(
        `SELECT id,name,channel,subject,body,filters,status,scheduled_at AS "scheduledAt" FROM campaigns WHERE id=$1 AND agency_id=$2 FOR UPDATE`,
        [id,user.agencyId],
      );
      const campaign = locked.rows[0];
      if (!campaign) throw new NotFoundException('Campaign not found.');
      if (!['draft','scheduled'].includes(campaign.status)) throw new BadRequestException('Only draft or scheduled campaigns can be queued.');
      if (campaign.status === 'scheduled' && campaign.scheduledAt && new Date(campaign.scheduledAt).getTime() > Date.now()) throw new BadRequestException('This campaign is scheduled for a future time and cannot be sent early.');
      const channel = campaign.channel as CampaignChannel;
      const filters = this.validateFilters(campaign.filters);
      const args: unknown[] = [user.agencyId,channel];
      const where = ['c.agency_id=$1','c.channel=$2',"c.customer_contact IS NOT NULL","btrim(c.customer_contact)<>''"];
      if (filters.status && filters.status !== 'any') { args.push(filters.status); where.push('c.status=$'+args.length); }
      if (filters.lastContactDays) { args.push(filters.lastContactDays); where.push('c.updated_at >= now()-($'+args.length+'::int * interval \'1 day\')'); }
      if (filters.search) { args.push('%'+String(filters.search).replace(/[\\%_]/g, '\\$&')+'%'); where.push('(COALESCE(c.customer_name,\'\') ILIKE $'+args.length+' OR c.customer_contact ILIKE $'+args.length+')'); }
      if (channel === 'sms') where.push("EXISTS (SELECT 1 FROM sms_contact_preferences p WHERE p.agency_id=c.agency_id AND p.phone_number=c.customer_contact AND p.consent_status='opted_in')");
      else where.push("EXISTS (SELECT 1 FROM campaign_contact_consents p WHERE p.agency_id=c.agency_id AND p.channel=$2 AND p.contact_key=lower(trim(c.customer_contact)) AND p.consent_status='opted_in')");
      const targets = await client.query(
        `SELECT DISTINCT ON (lower(trim(c.customer_contact))) c.id,c.customer_contact AS contact
         FROM conversations c WHERE ${where.join(' AND ')}
         ORDER BY lower(trim(c.customer_contact)),c.updated_at DESC LIMIT 10000`,
        args,
      );
      if (!targets.rowCount) throw new BadRequestException('No eligible recipients. Confirm channel connections and recorded opt-in consent.');
      let queued = 0;
      for (const target of targets.rows) {
        const recipient = await client.query(
          `INSERT INTO campaign_recipients(agency_id,campaign_id,conversation_id,contact,status)
           VALUES($1,$2,$3,$4,'queued') ON CONFLICT(campaign_id,conversation_id) DO NOTHING RETURNING id`,
          [user.agencyId,id,target.id,target.contact],
        );
        if (!recipient.rowCount) continue;
        const message = await client.query(
          `INSERT INTO messages(agency_id,conversation_id,direction,sender_type,body,subject,idempotency_key,delivery_status,processing_status,approval_status)
           VALUES($1,$2,'outbound','campaign',$3,$4,$5,'queued','not_applicable','approved')
           ON CONFLICT(agency_id,idempotency_key) DO NOTHING RETURNING id`,
          [user.agencyId,target.id,campaign.body,campaign.subject,'campaign:'+id+':'+target.id],
        );
        if (!message.rowCount) {
          await client.query("UPDATE campaign_recipients SET status='skipped',failure_reason='Message already queued' WHERE id=$1",[recipient.rows[0].id]);
          continue;
        }
        await client.query('UPDATE campaign_recipients SET message_id=$2 WHERE id=$1',[recipient.rows[0].id,message.rows[0].id]);
        queued++;
      }
      if (!queued) throw new BadRequestException('No new eligible recipients were queued.');
      await client.query("UPDATE campaigns SET status='queued',queued_at=now(),updated_at=now() WHERE id=$1 AND agency_id=$2",[id,user.agencyId]);
      return { campaignId:id,status:'queued',queuedRecipients:queued,channel };
    });
  }

  async cancel(user: AraUser, id: string) {
    this.requireManager(user);
    const result = await this.db.query(
      "UPDATE campaigns SET status='cancelled',updated_at=now() WHERE id=$1 AND agency_id=$2 AND status IN ('draft','scheduled','paused') RETURNING id,status",
      [id,user.agencyId],
    );
    if (!result.rowCount) throw new NotFoundException('Draft, scheduled or paused campaign not found.');
    return result.rows[0];
  }
}
