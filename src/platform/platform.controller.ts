import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { PlatformService } from './platform.service';
import { AuthGuard, AraUser } from './auth.guard';
@Controller('platform')
export class PlatformController {
  constructor(private readonly platform:PlatformService){}
  @Post('register') register(@Body() body:unknown){return this.platform.register(body);}
  @UseGuards(AuthGuard) @Get('brand-profile') brandProfile(@Req() req:{user:AraUser}){return this.platform.brandProfile(req.user);}
  @UseGuards(AuthGuard) @Post('brand-profile') updateBrandProfile(@Req() req:{user:AraUser},@Body() body:unknown){return this.platform.updateBrandProfile(req.user,body);}
  @Post('login') login(@Body() body:unknown){return this.platform.login(body);}
  @Post('verify-otp') verifyOtp(@Body() body:unknown){return this.platform.verifyLoginOtp(body);}
  @Post('resend-otp') resendOtp(@Body() body:any){return this.platform.resendLoginOtp(body);}
  @Post('owner-password-reset') resetOwnerPassword(@Body() body:unknown){return this.platform.resetOwnerPassword(body);}
  @Post('refresh') refresh(@Body() body:any){return this.platform.refresh(String(body?.refreshToken||''));}
  @Post('logout') logout(@Body() body:any){return this.platform.logout(String(body?.refreshToken||''));}
  @UseGuards(AuthGuard) @Get('team') team(@Req() req:{user:AraUser}){return this.platform.team(req.user);}
  @UseGuards(AuthGuard) @Get('team/presence') teamPresence(@Req() req:{user:AraUser}){return this.platform.teamPresence(req.user);}
  @UseGuards(AuthGuard) @Post('team/presence') updateTeamPresence(@Req() req:{user:AraUser},@Body() body:unknown){return this.platform.updateTeamPresence(req.user,body);}
  @UseGuards(AuthGuard) @Post('team') addMember(@Req() req:{user:AraUser},@Body() body:unknown){return this.platform.addMember(req.user,body);}
  @UseGuards(AuthGuard) @Post('team/:id/deactivate') deactivate(@Req() req:{user:AraUser},@Param('id') id:string){return this.platform.deactivate(req.user,id);}
  @UseGuards(AuthGuard) @Post('conversations') createConversation(@Req() req:{user:AraUser},@Body() body:unknown){return this.platform.createConversation(req.user,body);}
  @UseGuards(AuthGuard) @Get('conversations') conversations(@Req() req:{user:AraUser}){return this.platform.conversations(req.user);}
  @UseGuards(AuthGuard) @Get('conversations/:id/messages') messages(@Req() req:{user:AraUser},@Param('id') id:string){return this.platform.messages(req.user,id);}
  @UseGuards(AuthGuard) @Post('conversations/:id/messages') addMessage(@Req() req:{user:AraUser},@Param('id') id:string,@Body() body:unknown){return this.platform.addMessage(req.user,id,body);}
  @UseGuards(AuthGuard) @Post('conversations/:id/assign') assign(@Req() req:{user:AraUser},@Param('id') id:string,@Body() body:unknown){return this.platform.assign(req.user,id,body);}
  @UseGuards(AuthGuard) @Get('approvals') approvals(@Req() req:{user:AraUser}){return this.platform.pendingApprovals(req.user);}
  @UseGuards(AuthGuard) @Post('messages/:id/approve') approveAiMessage(@Req() req:{user:AraUser},@Param('id') id:string){return this.platform.approveAiMessage(req.user,id);}
  @UseGuards(AuthGuard) @Post('messages/:id/reject') rejectAiMessage(@Req() req:{user:AraUser},@Param('id') id:string){return this.platform.rejectAiMessage(req.user,id);}
  @UseGuards(AuthGuard) @Get('escalations') escalations(@Req() req:{user:AraUser}){return this.platform.escalations(req.user);}
  @UseGuards(AuthGuard) @Post('conversations/:id/escalations') createEscalation(@Req() req:{user:AraUser},@Param('id') id:string,@Body() body:unknown){return this.platform.createEscalation(req.user,id,body);}
  @UseGuards(AuthGuard) @Post('escalations/:id/claim') claim(@Req() req:{user:AraUser},@Param('id') id:string){return this.platform.claimEscalation(req.user,id);}
  @UseGuards(AuthGuard) @Post('escalations/:id/resolve') resolve(@Req() req:{user:AraUser},@Param('id') id:string){return this.platform.resolveEscalation(req.user,id);}
}
