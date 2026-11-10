import { AnswerService } from './answer.service';

describe('AnswerService',()=>{
  const orchestrator:any={execute:jest.fn((_context:any,operation:any)=>operation({traceId:'test-trace',startedAt:new Date(0).toISOString()}))};
  const agencyId='22222222-2222-4222-8222-222222222222';
  const documentId='33333333-3333-4333-8333-333333333333';
  const hit:any={documentId,title:'Verified company policy',category:'policies',language:'en',metadata:{},content:'The verified company policy is to respond within two business days.',similarity:0.92};

  it('uses company policy and holds draft-only answers for staff review',async()=>{
    const search:any={search:jest.fn().mockResolvedValue([hit])};
    const ai:any={generate:jest.fn().mockResolvedValue(JSON.stringify({
      answer:'The company responds within two business days.',
      language:'en',status:'answered',confidence:'high',
      citations:[{documentId,title:hit.title}],escalationReason:null
    }))};
    const db:any={query:jest.fn().mockResolvedValue({rows:[{
      industry:'healthcare',display_name:'Example Clinic',default_language:'en',
      agent_name:'Clinic Assistant',system_instructions:'Use plain language.',
      response_mode:'draft_only',confidence_threshold:0.72,
      escalate_sensitive_topics:true,enabled:true
    }]})};
    const config:any={get:jest.fn().mockReturnValue(0.3)};
    const service=new AnswerService(search,ai,config,db,orchestrator);
    const result=await service.answer({message:'What is the response time?',preferredLanguage:'en',filters:{}} as any,agencyId);
    expect(result.status).toBe('needs_human');
    expect(result.escalationReason).toContain('human approval');
    expect(ai.generate.mock.calls[0][0]).toContain('industry is healthcare');
    expect(ai.generate.mock.calls[0][0]).toContain('Use plain language.');
  });

  it('does not call retrieval, embeddings or generation when tenant AI is disabled',async()=>{
    const search:any={search:jest.fn()};
    const ai:any={generate:jest.fn()};
    const db:any={query:jest.fn().mockResolvedValue({rows:[{
      industry:'general',default_language:'en',enabled:false
    }]})};
    const config:any={get:jest.fn().mockReturnValue(0.3)};
    const service=new AnswerService(search,ai,config,db);
    const result=await service.answer({message:'Can you help me?',preferredLanguage:'auto',filters:{}} as any,agencyId);

    expect(result.status).toBe('needs_human');
    expect(result.confidence).toBe('low');
    expect(result.escalationReason).toBe('Company AI assistant is disabled.');
    expect(search.search).not.toHaveBeenCalled();
    expect(ai.generate).not.toHaveBeenCalled();
  });

  it('does not call the model when tenant knowledge has no relevant evidence',async()=>{
    const search:any={search:jest.fn().mockResolvedValue([])};
    const ai:any={generate:jest.fn()};
    const db:any={query:jest.fn().mockResolvedValue({rows:[{industry:'general',default_language:'sw'}]})};
    const config:any={get:jest.fn().mockReturnValue(0.3)};
    const service=new AnswerService(search,ai,config,db);
    const result=await service.answer({message:'Nina swali',preferredLanguage:'auto',filters:{}} as any,agencyId);
    expect(result.status).toBe('needs_human');
    expect(result.language).toBe('sw');
    expect(ai.generate).not.toHaveBeenCalled();
  });
});
