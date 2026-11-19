import { UnauthorizedException } from '@nestjs/common';
import { PlatformService } from './platform.service';

describe('PlatformService company login without workspace ID',()=>{
  const rows=[
    {id:'user-1',agencyId:'agency-1',email:'owner@example.com',password_hash:'hash-1',companyName:'Northstar Ltd'},
    {id:'user-2',agencyId:'agency-2',email:'owner@example.com',password_hash:'hash-2',companyName:'Bluebird Studio'}
  ];
  const setup=()=>{
    const db:any={query:jest.fn().mockResolvedValue({rows})};
    const otp:any={issue:jest.fn().mockResolvedValue({challengeId:'challenge-1',email:'owner@example.com'})};
    const service:any=new PlatformService(db,{} as any,{} as any,otp,{} as any,{} as any,{} as any);
    service.verifyPassword=jest.fn(async(password:string,hash:string)=>password==='correct-password'&&(hash==='hash-1'||hash==='hash-2'));
    return {service,db,otp};
  };

  it('starts email verification when the credentials identify one company',async()=>{
    const {service,db,otp}=setup();
    db.query.mockResolvedValue({rows:[rows[0]]});
    const result=await service.login({email:'OWNER@example.com',password:'correct-password'});
    expect(result.challengeId).toBe('challenge-1');
    expect(otp.issue).toHaveBeenCalledWith('owner@example.com','user-1','company_auth');
    expect(db.query.mock.calls[0][0]).not.toContain('a.slug');
  });

  it('asks the authenticated user to choose when credentials match multiple companies',async()=>{
    const {service,otp}=setup();
    const result=await service.login({email:'owner@example.com',password:'correct-password'});
    expect(result.requiresWorkspaceSelection).toBe(true);
    expect(result.workspaces).toEqual([
      {agencyId:'agency-1',companyName:'Northstar Ltd'},
      {agencyId:'agency-2',companyName:'Bluebird Studio'}
    ]);
    expect(otp.issue).not.toHaveBeenCalled();
  });

  it('issues OTP only for the company explicitly selected by the user',async()=>{
    const {service,otp}=setup();
    const result=await service.login({email:'owner@example.com',password:'correct-password',agencyId:'agency-2'});
    expect(result.challengeId).toBe('challenge-1');
    expect(otp.issue).toHaveBeenCalledWith('owner@example.com','user-2','company_auth');
  });

  it('rejects credentials that do not match an active company account',async()=>{
    const {service,otp}=setup();
    await expect(service.login({email:'owner@example.com',password:'wrong-password'})).rejects.toBeInstanceOf(UnauthorizedException);
    expect(otp.issue).not.toHaveBeenCalled();
  });
});
