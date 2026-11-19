import { Body, Controller, Get, Param, Post, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { PlatformAdminService } from './platform-admin.service';
import { PlatformAdminGuard, PlatformAdmin } from './platform-admin.guard';
import { AiUsageService } from './ai-usage.service';
import { SupportService } from './support.service';
@Controller('admin')
export class PlatformAdminController {
 constructor(private readonly adminService:PlatformAdminService,private readonly aiUsage:AiUsageService,private readonly support:SupportService){}
 @Post('auth/login') login(@Body() body:unknown){return this.adminService.login(body);}
 @Post('auth/verify-otp') verifyOtp(@Body() body:unknown){return this.adminService.verifyLoginOtp(body);}
 @Post('auth/resend-otp') resendOtp(@Body() body:any){return this.adminService.resendLoginOtp(body);}
 @UseGuards(PlatformAdminGuard) @Get('support/inbox') supportInbox(@Req() req:{platformAdmin:PlatformAdmin}){return this.support.inbox(req.platformAdmin);}
 @UseGuards(PlatformAdminGuard) @Get('support/threads/:id') supportThread(@Req() req:{platformAdmin:PlatformAdmin},@Param('id') id:string){return this.support.thread(req.platformAdmin,id);}
 @UseGuards(PlatformAdminGuard) @Post('support/threads/:id/claim') claimSupport(@Req() req:{platformAdmin:PlatformAdmin},@Param('id') id:string){return this.support.claim(req.platformAdmin,id);}
 @UseGuards(PlatformAdminGuard) @Post('support/threads/:id/reply') replySupport(@Req() req:{platformAdmin:PlatformAdmin},@Param('id') id:string,@Body() body:unknown){return this.support.reply(req.platformAdmin,id,body);}
 @UseGuards(PlatformAdminGuard) @Post('support/threads/:id/resolve') resolveSupport(@Req() req:{platformAdmin:PlatformAdmin},@Param('id') id:string){return this.support.resolve(req.platformAdmin,id);}
 @UseGuards(PlatformAdminGuard) @Post('support/presence') supportPresence(@Req() req:{platformAdmin:PlatformAdmin},@Body() body:any){return this.support.presence(req.platformAdmin,body?.online===true);}
 @UseGuards(PlatformAdminGuard) @Get('ai-usage') aiUsageDashboard(@Req() req:{platformAdmin:PlatformAdmin},@Query('days') days?:string){return this.aiUsage.platformDashboard(req.platformAdmin,days);}
 @UseGuards(PlatformAdminGuard) @Get('overview') overview(@Req() req:{platformAdmin:PlatformAdmin}){return this.adminService.overview(req.platformAdmin);}
 @UseGuards(PlatformAdminGuard) @Get('companies') companies(@Req() req:{platformAdmin:PlatformAdmin},@Query() query:unknown){return this.adminService.companies(req.platformAdmin,query);}
 @UseGuards(PlatformAdminGuard) @Get('companies/:id') company(@Req() req:{platformAdmin:PlatformAdmin},@Param('id') id:string){return this.adminService.company(req.platformAdmin,id);}
 @UseGuards(PlatformAdminGuard) @Post('companies') createCompany(@Req() req:{platformAdmin:PlatformAdmin},@Body() body:unknown){return this.adminService.createCompany(req.platformAdmin,body);}
 @UseGuards(PlatformAdminGuard) @Patch('companies/:id/status') setCompanyStatus(@Req() req:{platformAdmin:PlatformAdmin},@Param('id') id:string,@Body() body:unknown){return this.adminService.setCompanyStatus(req.platformAdmin,id,body);}
}
