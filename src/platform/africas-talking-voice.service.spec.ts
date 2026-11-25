import { AfricaTalkingVoiceService } from './africas-talking-voice.service';

describe('AfricaTalkingVoiceService',()=>{
  const agencyId='22222222-2222-4222-8222-222222222222';
  const connectionId='33333333-3333-4333-8333-333333333333';
  const conversationId='44444444-4444-4444-8444-444444444444';
  const callId='55555555-5555-4555-8555-555555555555';
  const connection={id:connectionId,agencyId,provider:'africas_talking_voice',externalAccountId:'+254700000001',externalPhoneNumberId:null,credentials:{username:'sandbox',apiKey:'secret',webhookVerifyToken:'x'.repeat(32),environment:'sandbox',transferNumber:'+254700000002'},keyVersion:'v1'};
  it('creates an inbound call conversation and returns a human transfer VoiceXML response',async()=>{
    const client:any={query:jest.fn(async(sql:string)=>{
      if(sql.startsWith('SELECT id,agency_id AS'))return {rows:[],rowCount:0};
      if(sql.startsWith("INSERT INTO conversations"))return {rows:[{id:conversationId}],rowCount:1};
      if(sql.startsWith("INSERT INTO voice_calls"))return {rows:[{id:callId,agencyId,connectionId,conversationId,providerSessionId:'ATV-session-1',clientRequestId:'inbound:ATV-session-1',direction:'inbound',callerNumber:'+254700000003',destinationNumber:'+254700000001',status:'bridged'}],rowCount:1};
      return {rows:[],rowCount:1};
    })};
    const db:any={query:jest.fn(),transaction:jest.fn(async(fn:any)=>fn(client))};
    const vault:any={findByVerifyToken:jest.fn().mockResolvedValue(connection)};
    const service=new AfricaTalkingVoiceService(db,vault);
    const xml=await service.handleCallback('x'.repeat(32),{sessionId:'ATV-session-1',callerNumber:'+254700000003',destinationNumber:'+254700000001',direction:'Inbound',isActive:'1'});
    expect(xml).toContain('<Response>');
    expect(xml).toContain('<Dial phoneNumbers="+254700000002" />');
    expect(client.query.mock.calls.some((call:any[])=>String(call[0]).includes('voice_call_events'))).toBe(true);
  });

  it('rejects a callback for a different destination number',async()=>{
    const db:any={query:jest.fn(),transaction:jest.fn()};
    const vault:any={findByVerifyToken:jest.fn().mockResolvedValue(connection)};
    const service=new AfricaTalkingVoiceService(db,vault);
    await expect(service.handleCallback('x'.repeat(32),{sessionId:'ATV-session-2',callerNumber:'+254700000003',destinationNumber:'+254700000099',direction:'Inbound',isActive:'1'})).rejects.toThrow('Inbound call destination does not match this voice connection.');
  });
});
