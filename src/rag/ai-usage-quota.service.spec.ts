import { AiUsageQuotaService } from './ai-usage-quota.service';

describe('AiUsageQuotaService', () => {
  const agencyId='22222222-2222-4222-8222-222222222222';
  const subscriptionId='44444444-4444-4444-8444-444444444444';
  const key='ai-response:message-1';
  const makeDb=(subscription:any,usage:any={consumed:'0',reserved:'0'},existing:any={rows:[]})=>{
    const client:any={query:jest.fn()
      .mockResolvedValueOnce({rows:subscription?[subscription]:[]})
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce({rows:[usage]})
      .mockResolvedValueOnce({rows:[{id:'reservation-1'}]})};
    const db:any={transaction:jest.fn(async(fn:any)=>fn(client)),query:jest.fn().mockResolvedValue({rows:[]})};
    return {db,client};
  };

  it('blocks tenants without a current subscription',async()=>{
    const {db}=makeDb(null);
    const service=new AiUsageQuotaService(db);
    await expect(service.reserve(agencyId,key)).resolves.toMatchObject({allowed:false});
  });

  it('blocks at the included response limit when overage is disabled',async()=>{
    const sub={id:subscriptionId,periodStart:new Date('2026-11-01'),periodEnd:new Date('2026-12-01'),includedAiResponses:10,overageAiPriceMinor:0};
    const {db}=makeDb(sub,{consumed:'10',reserved:'0'});
    const service=new AiUsageQuotaService(db);
    await expect(service.reserve(agencyId,key)).resolves.toMatchObject({allowed:false,reason:expect.stringContaining('allowance')});
  });

  it('allows billable overage when the plan has a positive overage price',async()=>{
    const sub={id:subscriptionId,periodStart:new Date('2026-11-01'),periodEnd:new Date('2026-12-01'),includedAiResponses:10,overageAiPriceMinor:25};
    const {db,client}=makeDb(sub,{consumed:'10',reserved:'0'});
    const service=new AiUsageQuotaService(db);
    await expect(service.reserve(agencyId,key)).resolves.toMatchObject({allowed:true,subscriptionId});
    expect(client.query).toHaveBeenCalledTimes(4);
  });

  it('consumes a reservation into one idempotent ai_response usage record',async()=>{
    const client:any={query:jest.fn()
      .mockResolvedValueOnce({rows:[{subscriptionId,status:'reserved'}]})
      .mockResolvedValueOnce({rows:[]})
      .mockResolvedValueOnce({rows:[]})};
    const db:any={transaction:jest.fn(async(fn:any)=>fn(client))};
    const service=new AiUsageQuotaService(db);
    await service.consume(agencyId,key);
    expect(client.query.mock.calls[1][0]).toContain("VALUES($1,$2,'ai_response',1,$3");
    expect(client.query.mock.calls[1][1]).toEqual([agencyId,subscriptionId,key]);
    expect(client.query.mock.calls[2][0]).toContain("status='consumed'");
  });
});
