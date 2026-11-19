import { ForbiddenException } from '@nestjs/common';
import { PlatformService } from './platform.service';

describe('PlatformService AI reply approvals',()=>{
  const user:any={id:'user-1',agencyId:'agency-1',role:'manager'};
  const pending={id:'message-1',conversationId:'conversation-1',approvalStatus:'approved',deliveryStatus:'queued'};
  const setup=()=>{
    const client:any={query:jest.fn().mockResolvedValue({rows:[pending],rowCount:1})};
    const db:any={query:jest.fn().mockResolvedValue({rows:[]}),transaction:jest.fn(async(fn:any)=>fn(client))};
    const service=new PlatformService(db,{} as any,{} as any,{} as any);
    return {service,db,client};
  };
  it('lists only pending AI drafts belonging to the authenticated tenant',async()=>{
    const {service,db}=setup();
    await service.pendingApprovals(user);
    expect(db.query.mock.calls[0][0]).toContain("m.agency_id=$1");
    expect(db.query.mock.calls[0][0]).toContain("m.approval_status='pending'");
    expect(db.query.mock.calls[0][1]).toEqual(['agency-1']);
  });
  it('approves a pending AI draft and audits the company reviewer',async()=>{
    const {service,client}=setup();
    await service.approveAiMessage(user,'message-1');
    expect(client.query.mock.calls[0][0]).toContain("approval_status='approved'");
    expect(client.query.mock.calls[0][0]).toContain("delivery_status='queued'");
    expect(client.query.mock.calls[0][1]).toEqual(['message-1','agency-1','user-1']);
    expect(client.query.mock.calls[1][0]).toContain('ai_reply.approved');
  });
  it('rejects a pending AI draft without queueing it for delivery',async()=>{
    const {service,client}=setup();
    await service.rejectAiMessage(user,'message-1');
    expect(client.query.mock.calls[0][0]).toContain("approval_status='rejected'");
    expect(client.query.mock.calls[0][0]).toContain("delivery_status='failed'");
    expect(client.query.mock.calls[1][0]).toContain('ai_reply.rejected');
  });
  it('does not allow an agent role to approve drafts',async()=>{
    const {service}=setup();
    await expect(service.approveAiMessage({...user,role:'agent'},'message-1')).rejects.toBeInstanceOf(ForbiddenException);
  });
});
