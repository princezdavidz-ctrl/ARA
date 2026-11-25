import { ConfigService } from './config.service';

describe('ConfigService legacy channel compatibility',()=>{
  const keys=['DATABASE_URL','JWT_SECRET','INGESTION_API_KEY','NODE_ENV','WHATSAPP_AGENCY_ID','WHATSAPP_PHONE_NUMBER_ID','WHATSAPP_VERIFY_TOKEN','WHATSAPP_APP_SECRET','WHATSAPP_ACCESS_TOKEN'];
  const previous:Record<string,string|undefined>={};
  beforeEach(()=>{
    for(const key of keys){previous[key]=process.env[key];delete process.env[key];}
    process.env.NODE_ENV='test';
    process.env.DATABASE_URL='postgresql://ara:secret@localhost:5432/ara_test';
    process.env.JWT_SECRET='test-only-jwt-secret-that-is-at-least-32-characters';
    process.env.INGESTION_API_KEY='test-only-ingestion-key-that-is-at-least-32-characters';
  });
  afterEach(()=>{
    for(const key of keys){if(previous[key]===undefined)delete process.env[key];else process.env[key]=previous[key]!;}
    jest.restoreAllMocks();
  });

  it('disables an incomplete legacy WhatsApp set without preventing tenant-scoped connections from booting',()=>{
    process.env.WHATSAPP_PHONE_NUMBER_ID='partial-legacy-value';
    const warning=jest.spyOn(process,'emitWarning').mockImplementation(()=>undefined);
    const config=new ConfigService();
    expect(()=>config.onModuleInit()).not.toThrow();
    expect(config.get('WHATSAPP_PHONE_NUMBER_ID')).toBeUndefined();
    expect(config.get('WHATSAPP_ACCESS_TOKEN')).toBeUndefined();
    expect(warning).toHaveBeenCalled();
  });
});
