import { AfricaTalkingSmsService } from './africas-talking-sms.service';

describe('AfricaTalkingSmsService',()=>{
  const agencyId='22222222-2222-4222-8222-222222222222';
  const connectionId='33333333-3333-4333-8333-333333333333';
  const conversationId='44444444-4444-4444-8444-444444444444';
  it('records STOP, suppresses future SMS and queues only the required system acknowledgement',async()=>{
    const calls:any[]=[];
    const client:any={query:jest.fn(async(sql:string,args:any[]=[])=>
      {calls.push({sql,args});
       if(sql.startsWith('SELECT id FROM conversations'))return {rows:[],rowCount:0};
       if(sql.startsWith('INSERT INTO conversations'))return {rows:[{id:conversationId}],rowCount:1};
       if(sql.startsWith("INSERT INTO messages")&&sql.includes("'inbound'"))return {rows:[{id:'inbound-id'}],rowCount:1};
       if(sql.startsWith("INSERT INTO messages")&&sql.includes("'outbound'"))return {rows:[{id:'ack-id'}],rowCount:1};
       return {rows:[],rowCount:1};
      })};
    const db:any={query:jest.fn().mockResolvedValue({rows:[],rowCount:1}),transaction:jest.fn(async(fn:any)=>fn(client))};
    const vault:any={findByVerifyToken:jest.fn().mockResolvedValue({id:connectionId,agencyId,provider:'africas_talking_sms',externalAccountId:'22121',externalPhoneNumberId:null,credentials:{username:'sandbox',apiKey:'secret',webhookVerifyToken:'x'.repeat(32),environment:'sandbox'},keyVersion:'v1'})};
    const service=new AfricaTalkingSmsService(db,vault,{} as any);
    const result=await service.receiveIncoming('x'.repeat(32),{from:'+254700000001',to:'22121',text:'STOP',id:'provider-inbound-1'});
    expect(result.keywordAction).toBe('opted_out');
    expect(client.query.mock.calls.some((call:any[])=>String(call[0]).includes('sms_contact_preferences'))).toBe(true);
    expect(client.query.mock.calls.some((call:any[])=>String(call[0]).includes("'outbound','system'"))).toBe(true);
    expect(client.query.mock.calls.some((call:any[])=>String(call[0]).includes("'inbound','customer'")&&String(call[0]).includes("'not_applicable'"))).toBe(true);
  });

  it('rejects callbacks with invalid phone numbers or missing provider IDs',async()=>{
    const db:any={query:jest.fn(),transaction:jest.fn()};
    const vault:any={findByVerifyToken:jest.fn().mockResolvedValue({id:connectionId,agencyId,provider:'africas_talking_sms',externalAccountId:'22121',credentials:{},keyVersion:'v1'})};
    const service=new AfricaTalkingSmsService(db,vault,{} as any);
    await expect(service.receiveIncoming('x'.repeat(32),{from:'not-a-phone',to:'22121',text:'hello',id:'provider-id'})).rejects.toThrow('Incomplete or invalid incoming SMS callback');
  });
});
