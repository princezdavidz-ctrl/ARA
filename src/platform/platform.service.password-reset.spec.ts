import { BadRequestException } from '@nestjs/common';
import { PlatformService } from './platform.service';

describe('PlatformService company password recovery',()=>{
  const makeService=(db:any,otp:any)=>{
    const service:any=new PlatformService(db,{} as any,{} as any,otp,{} as any,{} as any,{} as any);
    service.hashPassword=jest.fn().mockResolvedValue('scrypt$reset-hash');
    return service;
  };

  it('returns an account-neutral response when the email has no active company account',async()=>{
    const db:any={query:jest.fn().mockResolvedValue({rows:[],rowCount:0})};
    const otp:any={issue:jest.fn()};
    const service=makeService(db,otp);
    const result=await service.requestCompanyPasswordReset({email:'unknown@example.com'});
    expect(result.message).toContain('If an active ARA account exists');
    expect(result.challengeId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(otp.issue).not.toHaveBeenCalled();
  });

  it('issues a reset code for an active company account',async()=>{
    const db:any={query:jest.fn().mockResolvedValue({rows:[{id:'user-1'}],rowCount:1})};
    const otp:any={issue:jest.fn().mockResolvedValue({challengeId:'challenge-1',email:'owner@example.com',expiresIn:300})};
    const service=makeService(db,otp);
    const result=await service.requestCompanyPasswordReset({email:'OWNER@example.com'});
    expect(otp.issue).toHaveBeenCalledWith('owner@example.com','user-1','company_password_reset');
    expect(result.message).toContain('If an active ARA account exists');
  });

  it('rejects weak new passwords before consuming a reset code',async()=>{
    const db:any={query:jest.fn()};
    const otp:any={verify:jest.fn()};
    const service=makeService(db,otp);
    await expect(service.resetCompanyPassword({challengeId:'id',code:'123456',newPassword:'short'})).rejects.toBeInstanceOf(BadRequestException);
    expect(otp.verify).not.toHaveBeenCalled();
  });

  it('verifies the email code, resets matching company accounts and revokes sessions',async()=>{
    const tx:any={query:jest.fn()
      .mockResolvedValueOnce({rows:[{id:'user-1',agencyId:'agency-1'},{id:'user-2',agencyId:'agency-2'}],rowCount:2})
      .mockResolvedValue({rows:[],rowCount:1})};
    const db:any={transaction:jest.fn(async(fn:any)=>fn(tx))};
    const otp:any={verify:jest.fn().mockResolvedValue({principalId:'user-1',email:'owner@example.com'})};
    const service=makeService(db,otp);
    const result=await service.resetCompanyPassword({challengeId:'challenge-1',code:'123456',newPassword:'a-very-strong-new-password'});
    expect(otp.verify).toHaveBeenCalledWith('challenge-1','123456','company_password_reset');
    expect(tx.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE agency_users SET password_hash'),['scrypt$reset-hash',['user-1','user-2']]);
    expect(tx.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE refresh_sessions'),[['user-1','user-2']]);
    expect(result.success).toBe(true);
  });
});
