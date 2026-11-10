import { AnswerService } from './answer.service';

describe('AnswerService',()=>{
  const orchestrator:any={execute:jest.fn((_context:any,operation:any)=>operation({traceId:'test-trace',startedAt:new Date(0).toISOString()}))};
  const agencyId='22222222-2222-4222-8222-222222222222';
  const documentId='33333333-3333-4333-8333-333333333333';
  const hit:any={documentId,title:'Verified company policy',category:'policies',language:'en',metadata:{},content:'The verified company policy is to respond within two business days.',similarity:0.92};
  const generated={content:JSON.stringify({
    answer:'The company responds within two business days.',
    language:'en',status:'answered',confidence:'high',
    citations:[{documentId,title:hit.title}],escalationReason:null
  }),model:'gpt-4o-mini',inputTokens:120,outputTokens:35};

  it('records tenant-scoped token usage and holds draft-only answers for staff review',async()=>{
    const search:any={search:jest.fn().mockResolvedValue([hit])};
    const ai:any={generateWithUsage:jest.fn().mockResolvedValue(generated)};
    const db:any={query:jest.fn().mockResolvedValue({rows:[{
      industry:'healthcare',display_name:'Example Clinic',default_language:'en',
      agent_name:'Clinic Assistant',system_instructions:'Use plain language.',
      response_mode:'draft_only',confidence_threshold:0.72,
      escalate_sensitive_topics:true,enabled:true
    }]})};
    const config:any={get:jest.fn((key:string)=>({
      RAG_MIN_SIMILARITY:0.3,
      AI_INPUT_USD_PER_1M_TOKENS:0.15,
      AI_OUTPUT_USD_PER_1M_TOKENS:0.6,
    }[key]))};
    const service=new AnswerService(search,ai,config,db,orchestrator);
    const context={channel:'whatsapp',conversationId:'conversation-1',messageId:'message-1'};
    const result=await service.answer({message:'What is the response time?',preferredLanguage:'en',filters:{}} as any,agencyId,context);
    expect(result.status).toBe('needs_human');
    expect(result.escalationReason).toContain('human approval');
    expect(ai.generateWithUsage.mock.calls[0][0]).toContain('industry is healthcare');
    expect(ai.generateWithUsage.mock.calls[0][0]).toContain('Use plain language.');
    const writes=db.query.mock.calls.filter((call:any[])=>String(call[0]).includes('INSERT INTO usage_records'));
    expect(writes).toHaveLength(2);
    expect(writes[0][1][0]).toBe(agencyId);
    expect(writes[0][1][1]).toBe('token_input');
    expect(writes[0][1][2]).toBe(120);
    expect(writes[0][1][3]).toBe('ai-input:message-1');
    expect(JSON.parse(writes[0][1][4])).toMatchObject({
      provider:'openai',model:'gpt-4o-mini',traceId:'test-trace',
      channel:'whatsapp',conversationId:'conversation-1',messageId:'message-1',
      tokenType:'input',estimatedCostUsd:0.000018,pricingSource:'environment_config'
    });
    expect(JSON.stringify(writes)).not.toContain('What is the response time?');
  });

  it('does not call retrieval, embeddings or generation when tenant AI is disabled',async()=>{
    const search:any={search:jest.fn()};
    const ai:any={generateWithUsage:jest.fn()};
    const db:any={query:jest.fn().mockResolvedValue({rows:[{
      industry:'general',default_language:'en',enabled:false
    }]})};
    const config:any={get:jest.fn().mockReturnValue(0.3)};
    const service=new AnswerService(search,ai,config,db,orchestrator);
    const result=await service.answer({message:'Can you help me?',preferredLanguage:'auto',filters:{}} as any,agencyId);

    expect(result.status).toBe('needs_human');
    expect(result.confidence).toBe('low');
    expect(result.escalationReason).toBe('Company AI assistant is disabled.');
    expect(search.search).not.toHaveBeenCalled();
    expect(ai.generateWithUsage).not.toHaveBeenCalled();
  });

  it('does not call the model when tenant knowledge has no relevant evidence',async()=>{
    const search:any={search:jest.fn().mockResolvedValue([])};
    const ai:any={generateWithUsage:jest.fn()};
    const db:any={query:jest.fn().mockResolvedValue({rows:[{industry:'general',default_language:'sw'}]})};
    const config:any={get:jest.fn().mockReturnValue(0.3)};
    const service=new AnswerService(search,ai,config,db,orchestrator);
    const result=await service.answer({message:'Nina swali',preferredLanguage:'auto',filters:{}} as any,agencyId);
    expect(result.status).toBe('needs_human');
    expect(result.language).toBe('sw');
    expect(ai.generateWithUsage).not.toHaveBeenCalled();
  });

  it('skips token records when provider usage is absent',async()=>{
    const search:any={search:jest.fn().mockResolvedValue([hit])};
    const ai:any={generateWithUsage:jest.fn().mockResolvedValue({...generated,inputTokens:undefined,outputTokens:undefined})};
    const db:any={query:jest.fn().mockResolvedValue({rows:[{industry:'general',default_language:'en'}]})};
    const config:any={get:jest.fn().mockReturnValue(undefined)};
    const service=new AnswerService(search,ai,config,db,orchestrator);
    await service.answer({message:'Question',preferredLanguage:'en',filters:{}} as any,agencyId);
    expect(db.query.mock.calls.some((call:any[])=>String(call[0]).includes('INSERT INTO usage_records'))).toBe(false);
  });
});
