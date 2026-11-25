import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AraUser } from './auth.guard';

@Injectable()
export class Customer360Service {
  constructor(private readonly db: DatabaseService) {}

  private identityExpression(alias = 'c') {
    return `COALESCE(NULLIF(regexp_replace(lower(trim(${alias}.customer_contact)), '[^a-z0-9@+]', '', 'g'), ''), 'conversation:' || ${alias}.id::text)`;
  }

  async list(user: AraUser) {
    const identity = this.identityExpression('c');
    const result = await this.db.query(`
      WITH normalized AS (
        SELECT c.id,c.agency_id,c.channel,c.customer_name,c.customer_contact,c.status,c.created_at,c.updated_at,
               ${identity} AS identity_key
        FROM conversations c WHERE c.agency_id=$1
      ), ranked AS (
        SELECT n.*,row_number() OVER(PARTITION BY identity_key ORDER BY updated_at DESC,created_at DESC) AS rn
        FROM normalized n
      ), grouped AS (
        SELECT identity_key,count(*)::int AS "conversationCount",
               count(*) FILTER(WHERE status<>'closed')::int AS "openConversationCount",
               array_agg(DISTINCT channel ORDER BY channel) AS channels,
               max(updated_at) AS "lastContactAt"
        FROM normalized GROUP BY identity_key
      )
      SELECT md5(g.identity_key) AS id,
             COALESCE(NULLIF(r.customer_name,''),NULLIF(r.customer_contact,''),'Customer') AS name,
             r.customer_contact AS contact,g."conversationCount",g."openConversationCount",
             g.channels,g."lastContactAt",
             (SELECT m.body FROM messages m WHERE m.agency_id=$1 AND m.conversation_id=r.id ORDER BY m.created_at DESC LIMIT 1) AS "lastMessage"
      FROM grouped g JOIN ranked r ON r.identity_key=g.identity_key AND r.rn=1
      ORDER BY g."lastContactAt" DESC LIMIT 200
    `, [user.agencyId]);
    return result.rows;
  }

  async detail(user: AraUser, id: string) {
    if (!/^[a-f0-9]{32}$/.test(id)) throw new NotFoundException('Customer not found');
    const identity = this.identityExpression('c');
    const profile = await this.db.query(`
      SELECT md5(${identity}) AS id,
             COALESCE(NULLIF(c.customer_name,''),NULLIF(c.customer_contact,''),'Customer') AS name,
             c.customer_contact AS contact,
             count(*) OVER()::int AS "conversationCount",
             count(*) FILTER(WHERE c.status<>'closed') OVER()::int AS "openConversationCount",
             max(c.updated_at) OVER() AS "lastContactAt"
      FROM conversations c
      WHERE c.agency_id=$1 AND md5(${identity})=$2
      ORDER BY c.updated_at DESC LIMIT 1
    `, [user.agencyId, id]);
    if (!profile.rowCount) throw new NotFoundException('Customer not found');

    const conversations = await this.db.query(`
      SELECT c.id,c.channel,c.status,c.customer_name AS "customerName",
             c.customer_contact AS "customerContact",c.created_at AS "createdAt",
             c.updated_at AS "updatedAt",
             (SELECT count(*)::int FROM messages m WHERE m.agency_id=$1 AND m.conversation_id=c.id) AS "messageCount",
             (SELECT m.body FROM messages m WHERE m.agency_id=$1 AND m.conversation_id=c.id ORDER BY m.created_at DESC LIMIT 1) AS "lastMessage"
      FROM conversations c
      WHERE c.agency_id=$1 AND md5(${identity})=$2
      ORDER BY c.updated_at DESC LIMIT 100
    `, [user.agencyId, id]);
    const channels = [...new Set(conversations.rows.map((row: any) => row.channel))].sort();
    return { customer: { ...profile.rows[0], channels }, conversations: conversations.rows };
  }
}
