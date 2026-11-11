import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import { ConfigService } from '../config/config.service';
import { AraUser } from './auth.guard';
import { PlatformAdmin } from './platform-admin.guard';

type PlanInput={
  code:string;name:string;description?:string|null;currency:string;
  monthlyPriceMinor:number;includedMessages:number;includedAiResponses:number;
  maxChannels:number;maxSeats:number;overageMessagePriceMinor:number;overageAiPriceMinor:number;
};

@Injectable()
export class BillingService {
  constructor(private readonly db:DatabaseService,private readonly config:ConfigService){}

  private requireAdmin(admin:PlatformAdmin,roles=['super_admin','billing_admin']){
    if(!roles.includes(admin.role))throw new ForbiddenException('Insufficient platform billing permissions');
  }
  private requireBillingManager(user:AraUser){
    if(!['owner','admin'].includes(user.role))throw new ForbiddenException('Only company owners and administrators can manage billing');
  }
  private uuid(value:string){if(!/^[0-9a-f-]{36}$/i.test(value))throw new BadRequestException('Invalid resource ID');}
  private planInput(body:any):PlanInput{
    const code=String(body?.code||'').trim().toLowerCase();
    const name=String(body?.name||'').trim();
    const currency=String(body?.currency||'KES').trim().toUpperCase();
    const integer=(value:any,fallback=0)=>value===undefined?fallback:Number(value);
    const plan:PlanInput={
      code,name,description:body?.description==null?null:String(body.description).trim(),
      currency,monthlyPriceMinor:integer(body?.monthlyPriceMinor),
      includedMessages:integer(body?.includedMessages),includedAiResponses:integer(body?.includedAiResponses),
      maxChannels:integer(body?.maxChannels,1),maxSeats:integer(body?.maxSeats,1),
      overageMessagePriceMinor:integer(body?.overageMessagePriceMinor),
      overageAiPriceMinor:integer(body?.overageAiPriceMinor)
    };
    const values=[plan.monthlyPriceMinor,plan.includedMessages,plan.includedAiResponses,plan.maxChannels,plan.maxSeats,plan.overageMessagePriceMinor,plan.overageAiPriceMinor];
    if(!/^[a-z0-9][a-z0-9_-]{1,49}$/.test(code)||name.length<2||name.length>120||!/^[A-Z]{3}$/.test(currency)||values.some(v=>!Number.isSafeInteger(v)||v<0)||plan.maxSeats<1) {
      throw new BadRequestException('Provide a valid plan code/name/currency and non-negative integer limits and prices');
    }
    return plan;
  }

  async listPlans(admin:PlatformAdmin){
    this.requireAdmin(admin,['super_admin','billing_admin','platform_support','security_auditor']);
    const result=await this.db.query('SELECT id,code,name,description,currency,monthly_price_minor AS "monthlyPriceMinor",included_messages AS "includedMessages",included_ai_responses AS "includedAiResponses",max_channels AS "maxChannels",max_seats AS "maxSeats",overage_message_price_minor AS "overageMessagePriceMinor",overage_ai_price_minor AS "overageAiPriceMinor",is_active AS "isActive",created_at AS "createdAt",updated_at AS "updatedAt" FROM subscription_plans ORDER BY monthly_price_minor,code');
    return {items:result.rows};
  }

  async createPlan(admin:PlatformAdmin,body:any){
    this.requireAdmin(admin);
    const p=this.planInput(body);
    const result=await this.db.query('INSERT INTO subscription_plans(code,name,description,currency,monthly_price_minor,included_messages,included_ai_responses,max_channels,max_seats,overage_message_price_minor,overage_ai_price_minor) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id,code,name,description,currency,monthly_price_minor AS "monthlyPriceMinor",included_messages AS "includedMessages",included_ai_responses AS "includedAiResponses",max_channels AS "maxChannels",max_seats AS "maxSeats",overage_message_price_minor AS "overageMessagePriceMinor",overage_ai_price_minor AS "overageAiPriceMinor",is_active AS "isActive"',
      [p.code,p.name,p.description,p.currency,p.monthlyPriceMinor,p.includedMessages,p.includedAiResponses,p.maxChannels,p.maxSeats,p.overageMessagePriceMinor,p.overageAiPriceMinor]);
    await this.db.query('INSERT INTO platform_audit_logs(platform_admin_id,action,target_type,target_id,details) VALUES($1,$2,$3,$4,$5)',[admin.id,'billing.plan_created','subscription_plan',result.rows[0].id,JSON.stringify({code:p.code})]);
    return result.rows[0];
  }

  async updatePlan(admin:PlatformAdmin,id:string,body:any){
    this.requireAdmin(admin);this.uuid(id);
    const current=await this.db.query<any>('SELECT * FROM subscription_plans WHERE id=$1',[id]);
    if(!current.rowCount)throw new NotFoundException('Subscription plan not found');
    const row=current.rows[0];
    const p=this.planInput({
      code:body?.code??row.code,name:body?.name??row.name,description:body?.description??row.description,currency:body?.currency??row.currency,
      monthlyPriceMinor:body?.monthlyPriceMinor??row.monthly_price_minor,includedMessages:body?.includedMessages??row.included_messages,
      includedAiResponses:body?.includedAiResponses??row.included_ai_responses,maxChannels:body?.maxChannels??row.max_channels,
      maxSeats:body?.maxSeats??row.max_seats,overageMessagePriceMinor:body?.overageMessagePriceMinor??row.overage_message_price_minor,
      overageAiPriceMinor:body?.overageAiPriceMinor??row.overage_ai_price_minor
    });
    if(body?.isActive!==undefined&&typeof body.isActive!=='boolean')throw new BadRequestException('isActive must be boolean');
    const active=body?.isActive===undefined?row.is_active:body.isActive;
    const result=await this.db.query('UPDATE subscription_plans SET code=$2,name=$3,description=$4,currency=$5,monthly_price_minor=$6,included_messages=$7,included_ai_responses=$8,max_channels=$9,max_seats=$10,overage_message_price_minor=$11,overage_ai_price_minor=$12,is_active=$13,updated_at=now() WHERE id=$1 RETURNING id,code,name,description,currency,monthly_price_minor AS "monthlyPriceMinor",included_messages AS "includedMessages",included_ai_responses AS "includedAiResponses",max_channels AS "maxChannels",max_seats AS "maxSeats",overage_message_price_minor AS "overageMessagePriceMinor",overage_ai_price_minor AS "overageAiPriceMinor",is_active AS "isActive"',
      [id,p.code,p.name,p.description,p.currency,p.monthlyPriceMinor,p.includedMessages,p.includedAiResponses,p.maxChannels,p.maxSeats,p.overageMessagePriceMinor,p.overageAiPriceMinor,active]);
    await this.db.query('INSERT INTO platform_audit_logs(platform_admin_id,action,target_type,target_id,details) VALUES($1,$2,$3,$4,$5)',[admin.id,'billing.plan_updated','subscription_plan',id,JSON.stringify({isActive:active})]);
    return result.rows[0];
  }

  async assignSubscription(admin:PlatformAdmin,agencyId:string,body:any){
    this.requireAdmin(admin);this.uuid(agencyId);
    const planId=String(body?.planId||'');this.uuid(planId);
    const status=String(body?.status||'active');
    const interval=String(body?.billingInterval||'month');
    if(!['active','trialing'].includes(status)||!['month','year'].includes(interval))throw new BadRequestException('status must be active or trialing; billingInterval must be month or year');
    const start=body?.currentPeriodStart?new Date(body.currentPeriodStart):new Date();
    const end=body?.currentPeriodEnd?new Date(body.currentPeriodEnd):new Date(start);
    if(!body?.currentPeriodEnd){if(interval==='year')end.setFullYear(end.getFullYear()+1);else end.setMonth(end.getMonth()+1);}
    if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||end<=start)throw new BadRequestException('Invalid subscription billing period');
    const trialEndsAt=body?.trialEndsAt?new Date(body.trialEndsAt):null;
    if(trialEndsAt&&(!Number.isFinite(trialEndsAt.getTime())||trialEndsAt<start||trialEndsAt>end))throw new BadRequestException('trialEndsAt must fall within the subscription period');
    if(status==='trialing'&&!trialEndsAt)throw new BadRequestException('trialEndsAt is required for a trialing subscription');
    return this.db.transaction(async client=>{
      const agency=await client.query('SELECT id FROM agencies WHERE id=$1 FOR UPDATE',[agencyId]);
      if(!agency.rowCount)throw new NotFoundException('Company not found');
      const plan=await client.query<any>('SELECT * FROM subscription_plans WHERE id=$1 AND is_active=true',[planId]);
      if(!plan.rowCount)throw new NotFoundException('Active subscription plan not found');
      const old=await client.query("UPDATE company_subscriptions SET status='cancelled',cancel_at_period_end=false,updated_at=now() WHERE agency_id=$1 AND status IN ('active','trialing','past_due') RETURNING id",[agencyId]);
      const unitPrice=BigInt(plan.rows[0].monthly_price_minor)*(interval==='year'?12n:1n);
      const result=await client.query('INSERT INTO company_subscriptions(agency_id,plan_id,status,billing_interval,currency,unit_price_minor,current_period_start,current_period_end,trial_ends_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id,agency_id AS "agencyId",plan_id AS "planId",status,billing_interval AS "billingInterval",currency,unit_price_minor AS "unitPriceMinor",current_period_start AS "currentPeriodStart",current_period_end AS "currentPeriodEnd",trial_ends_at AS "trialEndsAt"',
        [agencyId,planId,status,interval,plan.rows[0].currency,unitPrice.toString(),start.toISOString(),end.toISOString(),trialEndsAt?.toISOString()||null]);
      await client.query('INSERT INTO platform_audit_logs(platform_admin_id,agency_id,action,target_type,target_id,details) VALUES($1,$2,$3,$4,$5,$6)',[admin.id,agencyId,'billing.subscription_assigned','company_subscription',result.rows[0].id,JSON.stringify({planId,status,interval,replacedSubscriptions:old.rowCount})]);
      return result.rows[0];
    });
  }

  async generateInvoice(admin:PlatformAdmin,subscriptionId:string){
    this.requireAdmin(admin);this.uuid(subscriptionId);
    return this.db.transaction(async client=>{
      const s=await client.query<any>('SELECT cs.*,p.name AS plan_name,p.included_messages,p.included_ai_responses,p.overage_message_price_minor,p.overage_ai_price_minor FROM company_subscriptions cs JOIN subscription_plans p ON p.id=cs.plan_id WHERE cs.id=$1 FOR UPDATE OF cs',[subscriptionId]);
      if(!s.rowCount)throw new NotFoundException('Subscription not found');
      const sub=s.rows[0];
      const existing=await client.query('SELECT id,invoice_number,status,total_minor AS "totalMinor" FROM billing_invoices WHERE subscription_id=$1 AND period_start=$2 AND period_end=$3',[subscriptionId,sub.current_period_start,sub.current_period_end]);
      if(existing.rows[0])return {...existing.rows[0],existing:true};
      const usage=await client.query<any>(`SELECT
        COALESCE(sum(quantity) FILTER(WHERE metric IN ('message_in','message_out')),0)::text AS messages,
        COALESCE(sum(quantity) FILTER(WHERE metric='ai_response'),0)::text AS ai_responses
        FROM usage_records WHERE subscription_id=$1 AND occurred_at >= $2 AND occurred_at < $3`,
        [subscriptionId,sub.current_period_start,sub.current_period_end]);
      const messages=BigInt(usage.rows[0].messages||'0'),aiResponses=BigInt(usage.rows[0].ai_responses||'0');
      const includedMessages=BigInt(sub.included_messages),includedAi=BigInt(sub.included_ai_responses);
      const overMessages=messages>includedMessages?messages-includedMessages:0n;
      const overAi=aiResponses>includedAi?aiResponses-includedAi:0n;
      const base=BigInt(sub.unit_price_minor),messageUnit=BigInt(sub.overage_message_price_minor),aiUnit=BigInt(sub.overage_ai_price_minor);
      const messageAmount=overMessages*messageUnit,aiAmount=overAi*aiUnit,total=base+messageAmount+aiAmount;
      const invoiceNumber='ARA-'+new Date(sub.current_period_start).toISOString().slice(0,10).replace(/-/g,'')+'-'+randomBytes(3).toString('hex').toUpperCase();
      const invoice=await client.query<any>('INSERT INTO billing_invoices(agency_id,subscription_id,invoice_number,status,currency,subtotal_minor,tax_minor,total_minor,period_start,period_end,due_at) VALUES($1,$2,$3,\'open\',$4,$5,0,$5,$6,$7,now()+interval \'7 days\') RETURNING id,agency_id AS "agencyId",invoice_number AS "invoiceNumber",status,currency,subtotal_minor AS "subtotalMinor",tax_minor AS "taxMinor",total_minor AS "totalMinor",period_start AS "periodStart",period_end AS "periodEnd",due_at AS "dueAt"',
        [sub.agency_id,subscriptionId,invoiceNumber,sub.currency,total.toString(),sub.current_period_start,sub.current_period_end]);
      const lines=[
        {metric:'subscription',description:sub.plan_name+' subscription',quantity:1n,unit:base,amount:base},
        ...(overMessages>0n?[{metric:'message_overage',description:'Message overage',quantity:overMessages,unit:messageUnit,amount:messageAmount}]:[]),
        ...(overAi>0n?[{metric:'ai_response_overage',description:'AI response overage',quantity:overAi,unit:aiUnit,amount:aiAmount}]:[])
      ];
      for(const line of lines)await client.query('INSERT INTO billing_invoice_items(agency_id,invoice_id,metric,description,quantity,unit_price_minor,amount_minor) VALUES($1,$2,$3,$4,$5,$6,$7)',[sub.agency_id,invoice.rows[0].id,line.metric,line.description,line.quantity.toString(),line.unit.toString(),line.amount.toString()]);
      await client.query('INSERT INTO platform_audit_logs(platform_admin_id,agency_id,action,target_type,target_id,details) VALUES($1,$2,$3,$4,$5,$6)',[admin.id,sub.agency_id,'billing.invoice_generated','billing_invoice',invoice.rows[0].id,JSON.stringify({messages:messages.toString(),aiResponses:aiResponses.toString(),totalMinor:total.toString()})]);
      return {...invoice.rows[0],items:lines.map(x=>({metric:x.metric,description:x.description,quantity:x.quantity.toString(),unitPriceMinor:x.unit.toString(),amountMinor:x.amount.toString()}))};
    });
  }

  async listAdminInvoices(admin:PlatformAdmin,query:any){
    this.requireAdmin(admin,['super_admin','billing_admin','platform_support','security_auditor']);
    const limit=Math.min(100,Math.max(1,Number(query?.limit)||25)),offset=Math.max(0,Number(query?.offset)||0);
    const result=await this.db.query('SELECT i.id,i.agency_id AS "agencyId",a.name AS "companyName",i.invoice_number AS "invoiceNumber",i.status,i.currency,i.total_minor AS "totalMinor",i.period_start AS "periodStart",i.period_end AS "periodEnd",i.due_at AS "dueAt",i.created_at AS "createdAt" FROM billing_invoices i JOIN agencies a ON a.id=i.agency_id ORDER BY i.created_at DESC LIMIT $1 OFFSET $2',[limit,offset]);
    return {items:result.rows,limit,offset};
  }

  async platformUsageSummary(admin:PlatformAdmin){
    this.requireAdmin(admin,['super_admin','billing_admin','platform_support','security_auditor']);
    const result=await this.db.query<any>(`SELECT a.id AS "agencyId",a.name AS "companyName",
        cs.id AS "subscriptionId",cs.status,p.name AS "planName",cs.currency,
        cs.current_period_start AS "periodStart",cs.current_period_end AS "periodEnd",
        p.included_messages AS "includedMessages",p.included_ai_responses AS "includedAiResponses",
        p.max_seats AS "maxSeats",p.max_channels AS "maxChannels",
        p.overage_message_price_minor AS "overageMessagePriceMinor",p.overage_ai_price_minor AS "overageAiPriceMinor",
        COALESCE(u.messages,0)::text AS messages,COALESCE(u.ai_responses,0)::text AS "aiResponses",
        COALESCE(seats.total,0)::int AS "activeSeats",COALESCE(channels.total,0)::int AS "activeChannels",
        COALESCE(reserved.total,0)::text AS "reservedMessages",
        COALESCE(blocked.total,0)::int AS "blockedActionsTotal",
        COALESCE(blocked.breakdown,'{}'::jsonb) AS "blockedActionsByType"
      FROM agencies a
      JOIN LATERAL (
        SELECT * FROM company_subscriptions
        WHERE agency_id=a.id AND status IN ('active','trialing','past_due')
          AND current_period_start<=now() AND current_period_end>now()
          AND (status<>'trialing' OR trial_ends_at IS NULL OR trial_ends_at>now())
        ORDER BY created_at DESC LIMIT 1
      ) cs ON true
      JOIN subscription_plans p ON p.id=cs.plan_id
      LEFT JOIN LATERAL (
        SELECT sum(quantity) FILTER(WHERE metric IN ('message_in','message_out')) AS messages,
          sum(quantity) FILTER(WHERE metric='ai_response') AS ai_responses
        FROM usage_records WHERE subscription_id=cs.id
          AND occurred_at>=cs.current_period_start AND occurred_at<cs.current_period_end
      ) u ON true
      LEFT JOIN LATERAL (SELECT count(*) AS total FROM agency_users WHERE agency_id=a.id AND is_active=true) seats ON true
      LEFT JOIN LATERAL (SELECT count(*) AS total FROM channel_connections WHERE agency_id=a.id AND status<>'disabled') channels ON true
      LEFT JOIN LATERAL (SELECT count(*) AS total FROM message_usage_reservations WHERE subscription_id=cs.id AND status='reserved' AND expires_at>now()) reserved ON true
      LEFT JOIN LATERAL (
        SELECT COALESCE(sum(x.action_count),0)::int AS total, COALESCE(jsonb_object_agg(x.action_type,x.action_count),'{}'::jsonb) AS breakdown
        FROM (SELECT action_type,count(*)::int AS action_count FROM subscription_blocked_actions
          WHERE agency_id=a.id AND occurred_at>=cs.current_period_start AND occurred_at<cs.current_period_end
          GROUP BY action_type) x
      ) blocked ON true
      ORDER BY a.name`);
    const items=result.rows.map((r:any)=>{
      const messages=BigInt(r.messages||'0'),ai=BigInt(r.aiResponses||'0'),messageLimit=BigInt(r.includedMessages||0),aiLimit=BigInt(r.includedAiResponses||0);
      const messageOver=messages>messageLimit?messages-messageLimit:0n,aiOver=ai>aiLimit?ai-aiLimit:0n;
      const messageCost=messageOver*BigInt(r.overageMessagePriceMinor||0),aiCost=aiOver*BigInt(r.overageAiPriceMinor||0);
      return {...r,messageRemaining:(messageLimit>messages+BigInt(r.reservedMessages||'0')?messageLimit-messages-BigInt(r.reservedMessages||'0'):0n).toString(),
        aiRemaining:(aiLimit>ai?aiLimit-ai:0n).toString(),messageOverage:messageOver.toString(),aiOverage:aiOver.toString(),
        estimatedOverageMinor:(messageCost+aiCost).toString(),blockedActionsTotal:Number(r.blockedActionsTotal||0),blockedActionsByType:r.blockedActionsByType||{}};
    });
    return {items,tenantCount:items.length,generatedAt:new Date().toISOString()};
  }

  async tenantSummary(user:AraUser){
    this.requireBillingManager(user);
    await this.db.query("UPDATE company_subscriptions SET status='expired',updated_at=now() WHERE agency_id=$1 AND status IN ('trialing','active','past_due') AND current_period_end<=now()",[user.agencyId]);
    const subscription=await this.db.query<any>(`SELECT cs.id,cs.status,cs.billing_interval AS "billingInterval",cs.currency,cs.unit_price_minor AS "unitPriceMinor",cs.current_period_start AS "currentPeriodStart",cs.current_period_end AS "currentPeriodEnd",cs.cancel_at_period_end AS "cancelAtPeriodEnd",p.code AS "planCode",p.name AS "planName",p.included_messages AS "includedMessages",p.included_ai_responses AS "includedAiResponses",p.max_channels AS "maxChannels",p.max_seats AS "maxSeats",p.overage_message_price_minor AS "overageMessagePriceMinor",p.overage_ai_price_minor AS "overageAiPriceMinor"
      FROM company_subscriptions cs JOIN subscription_plans p ON p.id=cs.plan_id
      WHERE cs.agency_id=$1 AND cs.status IN ('trialing','active','past_due') ORDER BY cs.created_at DESC LIMIT 1`,[user.agencyId]);
    const current=subscription.rows[0]||null;
    let usage:any={messages:'0',aiResponses:'0',humanHandoffs:'0',reservedMessages:'0'};
    let capacity:any={activeSeats:0,activeChannels:0};
    let blockedActions:any={total:0,byType:{}};
    if(current){
      const [u,c,b]=await Promise.all([
        this.db.query<any>(`SELECT
          COALESCE(sum(quantity) FILTER(WHERE metric IN ('message_in','message_out')),0)::text AS messages,
          COALESCE(sum(quantity) FILTER(WHERE metric='ai_response'),0)::text AS "aiResponses",
          COALESCE(sum(quantity) FILTER(WHERE metric='human_handoff'),0)::text AS "humanHandoffs"
          FROM usage_records WHERE subscription_id=$1 AND occurred_at >= $2 AND occurred_at < $3`,
          [current.id,current.currentPeriodStart,current.currentPeriodEnd]),
        this.db.query<any>(`SELECT
          (SELECT count(*)::int FROM agency_users WHERE agency_id=$1 AND is_active=true) AS "activeSeats",
          (SELECT count(*)::int FROM channel_connections WHERE agency_id=$1 AND status<>'disabled') AS "activeChannels",
          (SELECT count(*)::text FROM message_usage_reservations WHERE subscription_id=$2 AND status='reserved' AND expires_at>now()) AS "reservedMessages"`,
          [user.agencyId,current.id]),
        this.db.query<any>(`SELECT COALESCE(sum(x.action_count),0)::int AS total, COALESCE(jsonb_object_agg(x.action_type,x.action_count),'{}'::jsonb) AS "byType"
          FROM (SELECT action_type,count(*)::int AS action_count FROM subscription_blocked_actions
            WHERE agency_id=$1 AND occurred_at >= $2 AND occurred_at < $3 GROUP BY action_type) x`,
          [user.agencyId,current.currentPeriodStart,current.currentPeriodEnd])
      ]);
      usage={...u.rows[0],reservedMessages:c.rows[0].reservedMessages||'0'};
      capacity={activeSeats:Number(c.rows[0].activeSeats||0),activeChannels:Number(c.rows[0].activeChannels||0)};
      blockedActions={total:Number(b.rows[0]?.total||0),byType:b.rows[0]?.byType||{}};
    }
    const messagesUsed=BigInt(usage.messages||'0'),aiUsed=BigInt(usage.aiResponses||'0');
    const messageIncluded=BigInt(current?.includedMessages||0),aiIncluded=BigInt(current?.includedAiResponses||0);
    const reserved=BigInt(usage.reservedMessages||'0');
    const messageOverage=messagesUsed>messageIncluded?messagesUsed-messageIncluded:0n;
    const aiOverage=aiUsed>aiIncluded?aiUsed-aiIncluded:0n;
    const messageOverageMinor=messageOverage*BigInt(current?.overageMessagePriceMinor||0);
    const aiOverageMinor=aiOverage*BigInt(current?.overageAiPriceMinor||0);
    const allowances={
      messages:{included:messageIncluded.toString(),used:messagesUsed.toString(),reserved:reserved.toString(),remaining:(messageIncluded>messagesUsed+reserved?messageIncluded-messagesUsed-reserved:0n).toString(),overage:messageOverage.toString(),overageAmountMinor:messageOverageMinor.toString()},
      aiResponses:{included:aiIncluded.toString(),used:aiUsed.toString(),remaining:(aiIncluded>aiUsed?aiIncluded-aiUsed:0n).toString(),overage:aiOverage.toString(),overageAmountMinor:aiOverageMinor.toString()},
      estimatedOverageMinor:(messageOverageMinor+aiOverageMinor).toString(),
      blockedActionsTracking:'available'
    };
    const invoices=await this.db.query('SELECT id,invoice_number AS "invoiceNumber",status,currency,total_minor AS "totalMinor",due_at AS "dueAt",created_at AS "createdAt" FROM billing_invoices WHERE agency_id=$1 ORDER BY created_at DESC LIMIT 20',[user.agencyId]);
    return {subscription:current,usage,capacity,allowances,blockedActions,invoices:invoices.rows};
  }

  async tenantInvoice(user:AraUser,id:string){
    this.requireBillingManager(user);this.uuid(id);
    const invoice=await this.db.query<any>('SELECT id,invoice_number AS "invoiceNumber",status,currency,subtotal_minor AS "subtotalMinor",tax_minor AS "taxMinor",total_minor AS "totalMinor",period_start AS "periodStart",period_end AS "periodEnd",due_at AS "dueAt",paid_at AS "paidAt" FROM billing_invoices WHERE id=$1 AND agency_id=$2',[id,user.agencyId]);
    if(!invoice.rowCount)throw new NotFoundException('Invoice not found');
    const items=await this.db.query('SELECT metric,description,quantity,unit_price_minor AS "unitPriceMinor",amount_minor AS "amountMinor" FROM billing_invoice_items WHERE invoice_id=$1 AND agency_id=$2 ORDER BY created_at',[id,user.agencyId]);
    const payments=await this.db.query('SELECT provider,provider_payment_ref AS "paymentReference",status,amount_minor AS "amountMinor",currency,created_at AS "createdAt" FROM billing_payments WHERE invoice_id=$1 AND agency_id=$2 ORDER BY created_at',[id,user.agencyId]);
    return {...invoice.rows[0],items:items.rows,payments:payments.rows};
  }

  async requestCancellation(user:AraUser){
    this.requireBillingManager(user);
    const r=await this.db.query("UPDATE company_subscriptions SET cancel_at_period_end=true,updated_at=now() WHERE agency_id=$1 AND status IN ('active','trialing','past_due') RETURNING id,status,current_period_end AS \"currentPeriodEnd\"",[user.agencyId]);
    if(!r.rowCount)throw new NotFoundException('No active subscription to cancel');
    await this.db.query("INSERT INTO audit_logs(agency_id,actor_user_id,action,target_type,target_id,details) VALUES($1,$2,'billing.cancellation_requested','company_subscription',$3,'{}'::jsonb)",[user.agencyId,user.id,r.rows[0].id]);
    return {subscription:r.rows[0],message:'Cancellation is scheduled for the end of the current billing period.'};
  }

  async recordUsage(agencyId:string,metric:string,idempotencyKey:string,quantity=1,metadata:Record<string,unknown>={}){
    if(!['message_in','message_out','ai_response','human_handoff','channel_connected','token_input','token_output'].includes(metric))throw new BadRequestException('Unsupported usage metric');
    if(!idempotencyKey||idempotencyKey.length>255||!Number.isSafeInteger(quantity)||quantity<=0)throw new BadRequestException('Invalid usage record');
    await this.db.query(`INSERT INTO usage_records(agency_id,subscription_id,metric,quantity,idempotency_key,metadata)
      VALUES($1,(SELECT id FROM company_subscriptions WHERE agency_id=$1 AND status IN ('active','trialing','past_due') AND current_period_start<=now() AND current_period_end>now() ORDER BY created_at DESC LIMIT 1),$2,$3,$4,$5)
      ON CONFLICT(agency_id,idempotency_key) DO NOTHING`,
      [agencyId,metric,quantity,idempotencyKey,JSON.stringify(metadata)]);
  }

  async paymentWebhook(provider:string,rawBody:Buffer|undefined,timestamp:string|undefined,signature:string|undefined,payload:any){
    const normalizedProvider=provider.toLowerCase();
    if(!/^[a-z][a-z0-9_-]{1,39}$/.test(normalizedProvider))throw new BadRequestException('Invalid payment provider');
    const secret=this.config.get('BILLING_WEBHOOK_SECRET');
    if(!secret)throw new ServiceUnavailableException('Billing webhook is not configured');
    if(!rawBody||!timestamp||!signature||!/^\d{10}$/.test(timestamp)||!/^sha256=[a-f0-9]{64}$/i.test(signature))throw new UnauthorizedException('Missing or invalid billing webhook signature');
    const seconds=Number(timestamp);
    if(!Number.isSafeInteger(seconds)||Math.abs(Date.now()/1000-seconds)>300)throw new UnauthorizedException('Billing webhook timestamp outside allowed window');
    const expected=createHmac('sha256',secret).update(timestamp+'.').update(rawBody).digest();
    const supplied=Buffer.from(signature.slice(7),'hex');
    if(supplied.length!==expected.length||!timingSafeEqual(supplied,expected))throw new UnauthorizedException('Invalid billing webhook signature');
    const eventId=String(payload?.eventId||'').trim(),invoiceId=String(payload?.invoiceId||'').trim(),agencyId=String(payload?.agencyId||'').trim();
    const paymentRef=String(payload?.paymentRef||'').trim(),status=String(payload?.status||'').trim();
    const amount=Number(payload?.amountMinor),currency=String(payload?.currency||'').toUpperCase();
    if(!eventId||eventId.length>255||!paymentRef||paymentRef.length>255||!['succeeded','failed','refunded'].includes(status)||!Number.isSafeInteger(amount)||amount<=0||!(/^[A-Z]{3}$/.test(currency)))throw new BadRequestException('Invalid normalized billing payment event');
    this.uuid(invoiceId);this.uuid(agencyId);
    return this.db.transaction(async client=>{
      const event=await client.query('INSERT INTO billing_provider_events(provider,provider_event_id,agency_id,event_type,payload) VALUES($1,$2,$3,$4,$5) ON CONFLICT(provider,provider_event_id) DO NOTHING RETURNING id',[normalizedProvider,eventId,agencyId,status,JSON.stringify(payload)]);
      if(!event.rowCount)return {received:true,duplicate:true};
      const invoice=await client.query<any>('SELECT id,agency_id,status,currency,total_minor FROM billing_invoices WHERE id=$1 AND agency_id=$2 FOR UPDATE',[invoiceId,agencyId]);
      if(!invoice.rowCount)throw new NotFoundException('Invoice not found for payment event');
      if(invoice.rows[0].currency!==currency||BigInt(invoice.rows[0].total_minor)<BigInt(amount))throw new BadRequestException('Payment amount or currency does not match the invoice');
      const payment=await client.query('INSERT INTO billing_payments(agency_id,invoice_id,provider,provider_payment_ref,status,amount_minor,currency,provider_payload) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(provider,provider_payment_ref) DO UPDATE SET status=EXCLUDED.status,amount_minor=EXCLUDED.amount_minor,currency=EXCLUDED.currency,provider_payload=EXCLUDED.provider_payload,updated_at=now() WHERE billing_payments.agency_id=EXCLUDED.agency_id AND billing_payments.invoice_id=EXCLUDED.invoice_id RETURNING id',[agencyId,invoiceId,normalizedProvider,paymentRef,status,amount,currency,JSON.stringify(payload)]);
      if(!payment.rowCount)throw new ConflictException('Provider payment reference is already linked to another invoice or company');
      const net=await client.query<any>("SELECT COALESCE(sum(CASE WHEN status='succeeded' THEN amount_minor WHEN status='refunded' THEN -amount_minor ELSE 0 END),0)::text AS amount FROM billing_payments WHERE invoice_id=$1 AND agency_id=$2",[invoiceId,agencyId]);
      const isPaid=BigInt(net.rows[0].amount||'0')>=BigInt(invoice.rows[0].total_minor);
      await client.query("UPDATE billing_invoices SET status=$3,paid_at=CASE WHEN $3='paid' THEN COALESCE(paid_at,now()) ELSE NULL END WHERE id=$1 AND agency_id=$2",[invoiceId,agencyId,isPaid?'paid':'open']);
      await client.query("UPDATE billing_provider_events SET status='processed',processed_at=now() WHERE id=$1",[event.rows[0].id]);
      return {received:true,duplicate:false,invoiceId,status:isPaid?'paid':'open'};
    });
  }
}
