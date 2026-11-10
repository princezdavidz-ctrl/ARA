import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard, AraUser } from './auth.guard';
import { ChannelConnectionsService } from './channel-connections.service';
@Controller('platform/channels')
@UseGuards(AuthGuard)
export class ChannelConnectionsController {
  constructor(private readonly channels:ChannelConnectionsService) {}
  @Get() list(@Req() req:{user:AraUser}) { return this.channels.list(req.user); }
  @Post() create(@Req() req:{user:AraUser},@Body() body:unknown) { return this.channels.create(req.user,body); }
  @Post(':id/verify') verifyAndActivate(@Req() req:{user:AraUser},@Param('id') id:string) { return this.channels.verifyAndActivate(req.user,id); }
  @Patch(':id/credentials') updateCredentials(@Req() req:{user:AraUser},@Param('id') id:string,@Body() body:unknown) { return this.channels.updateCredentials(req.user,id,body); }
  @Patch(':id/status') setStatus(@Req() req:{user:AraUser},@Param('id') id:string,@Body() body:unknown) { return this.channels.setStatus(req.user,id,body); }
}
