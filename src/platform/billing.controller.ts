import { Body,Controller,Get,Param,Patch,Post,Query,Req,Res,UseGuards } from '@nestjs/common';
import { RawBodyRequest } from '@nestjs/common';
import { Request,Response } from 'express';
import { BillingService } from './billing.service';
import { MpesaService } from './mpesa.service';
import { AuthGuard,AraUser } from './auth.guard';
import { PlatformAdminGuard,PlatformAdmin } from './platform-admin.guard';

@Controller()
export class BillingController {
  constructor(private readonly billing:BillingService,private readonly mpesa:MpesaService){}

  @UseGuards(PlatformAdminGuard) @Get('admin/billing/plans')
  listPlans(@Req() req:{platformAdmin:PlatformAdmin}){return this.billing.listPlans(req.platformAdmin);}

  @UseGuards(PlatformAdminGuard) @Post('admin/billing/plans')
  createPlan(@Req() req:{platformAdmin:PlatformAdmin},@Body() body:unknown){return this.billing.createPlan(req.platformAdmin,body);}

  @UseGuards(PlatformAdminGuard) @Patch('admin/billing/plans/:id')
  updatePlan(@Req() req:{platformAdmin:PlatformAdmin},@Param('id') id:string,@Body() body:unknown){return this.billing.updatePlan(req.platformAdmin,id,body);}

  @UseGuards(PlatformAdminGuard) @Post('admin/billing/companies/:agencyId/subscription')
  assignSubscription(@Req() req:{platformAdmin:PlatformAdmin},@Param('agencyId') agencyId:string,@Body() body:unknown){return this.billing.assignSubscription(req.platformAdmin,agencyId,body);}

  @UseGuards(PlatformAdminGuard) @Post('admin/billing/subscriptions/:id/invoice')
  generateInvoice(@Req() req:{platformAdmin:PlatformAdmin},@Param('id') id:string){return this.billing.generateInvoice(req.platformAdmin,id);}

  @UseGuards(PlatformAdminGuard) @Get('admin/billing/invoices')
  listInvoices(@Req() req:{platformAdmin:PlatformAdmin},@Query() query:unknown){return this.billing.listAdminInvoices(req.platformAdmin,query);}

  @UseGuards(PlatformAdminGuard) @Get('admin/billing/usage')
  platformUsage(@Req() req:{platformAdmin:PlatformAdmin}){return this.billing.platformUsageSummary(req.platformAdmin);}

  @UseGuards(AuthGuard) @Get('platform/billing')
  tenantSummary(@Req() req:{user:AraUser}){return this.billing.tenantSummary(req.user);}

  @UseGuards(AuthGuard) @Get('platform/billing/invoices/:id')
  tenantInvoice(@Req() req:{user:AraUser},@Param('id') id:string){return this.billing.tenantInvoice(req.user,id);}

  @UseGuards(AuthGuard) @Post('platform/billing/cancel')
  requestCancellation(@Req() req:{user:AraUser}){return this.billing.requestCancellation(req.user);}

  @UseGuards(AuthGuard) @Post('platform/billing/invoices/:id/mpesa')
  initiateMpesa(@Req() req:{user:AraUser},@Param('id') id:string,@Body() body:{phoneNumber?:string}){
    return this.mpesa.initiate(req.user,id,String(body?.phoneNumber||''));
  }

  @Post('webhooks/mpesa/stk')
  async mpesaCallback(@Body() body:unknown,@Res() response:Response){
    const result=await this.mpesa.callback(body);
    return response.status(200).json(result);
  }

  @Post('webhooks/billing/:provider')
  async paymentWebhook(@Param('provider') provider:string,@Req() request:RawBodyRequest<Request>,@Res() response:Response){
    const timestamp=request.headers['x-ara-billing-timestamp'];
    const signature=request.headers['x-ara-billing-signature'];
    const result=await this.billing.paymentWebhook(provider,request.rawBody,typeof timestamp==='string'?timestamp:undefined,typeof signature==='string'?signature:undefined,request.body);
    return response.status(200).json(result);
  }
}
