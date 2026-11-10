import { UnauthorizedException } from '@nestjs/common';
import { BillingService } from './billing.service';

describe('BillingService',()=>{
  const admin:any={id:'11111111-1111-4111-8111-111111111111',email:'billing@example.test',fullName:'Billing Admin',role:'super_admin'};
  const agencyId='22222222-2222-4222-8222-222222222222';
  const subscriptionId='33333333-3333-4333-8333-333333333333';
  const periodStart=new Date('2026-11-01T00:00:00.000Z');
  const periodEnd=new Date('2026-12-01T00:00:00.000Z');

  it('creates invoices with base subscription and message/AI overages',async()=>{
    const invoiceId='44444444-4444-4444-8444-444444444444';
    const sub:any={id:subscriptionId,agency_id:agencyId,plan_name:'Growth',included_messages:100,included_ai_responses:30,overage_message_price_minor:'5',overage_ai_price_minor:'10',unit_price_minor:'1000',currency:'KES',current_period_start:periodStart,current_period_end:periodEnd};
    const invoice:any={id:invoiceId,agencyId,invoiceNumber:'ARA-20261101-ABC123',status:'open',currency:'KES',subtotalMinor:'1300',taxMinor:0,totalMinor:'1300',periodStart,periodEnd,dueAt:new Date()};
    const client:any={query:jest.fn(async(sql:string)=>{
      if(sql.includes('SELECT cs.*'))return {rows:[sub],rowCount:1};
      if(sql.includes('SELECT id,invoice_number'))return {rows:[],rowCount:0};
      if(sql.includes('COALESCE(sum(quantity) FILTER'))return {rows:[{messages:'120',ai_responses:'50'}],rowCount:1};
      if(sql.includes('INSERT INTO billing_invoices'))return {rows:[invoice],rowCount:1};
      return {rows:[],rowCount:1};
    })};
    const db:any={query:jest.fn(),transaction:jest.fn(async(fn:any)=>fn(client))};
    const service=new BillingService(db,{get:jest.fn()} as any);
    const result=await service.generateInvoice(admin,subscriptionId);
    expect(result.totalMinor).toBe('1300');
    expect(result.items).toHaveLength(3);
    expect(result.items[1].amountMinor).toBe('100');
    expect(result.items[2].amountMinor).toBe('200');
  });

  it('records usage idempotently against the current subscription period',async()=>{
    const db:any={query:jest.fn().mockResolvedValue({rowCount:1,rows:[]})};
    const service=new BillingService(db,{get:jest.fn()} as any);
    await service.recordUsage(agencyId,'message_in','message-in:message-1');
    expect(db.query).toHaveBeenCalledTimes(1);
    expect(db.query.mock.calls[0][0]).toContain('ON CONFLICT(agency_id,idempotency_key) DO NOTHING');
    expect(db.query.mock.calls[0][1]).toEqual([agencyId,'message_in',1,'message-in:message-1','{}']);
  });

  it('rejects invalid plan pricing and quota values',async()=>{
    const db:any={query:jest.fn()};
    const service=new BillingService(db,{get:jest.fn()} as any);
    await expect(service.createPlan(admin,{code:'invalid code',name:'Bad plan',currency:'KES',monthlyPriceMinor:-1})).rejects.toThrow('valid plan');
    expect(db.query).not.toHaveBeenCalled();
  });

  it('rejects payment callbacks with an invalid HMAC signature',async()=>{
    const db:any={query:jest.fn(),transaction:jest.fn()};
    const config:any={get:jest.fn().mockReturnValue('test-billing-secret')};
    const service=new BillingService(db,config);
    const raw=Buffer.from(JSON.stringify({eventId:'evt-1'}));
    const timestamp=String(Math.floor(Date.now()/1000));
    await expect(service.paymentWebhook('mpesa',raw,timestamp,'sha256='+'0'.repeat(64),{})).rejects.toBeInstanceOf(UnauthorizedException);
    expect(db.transaction).not.toHaveBeenCalled();
  });

});
