import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard, AraUser } from './auth.guard';
import { AfricaTalkingVoiceService } from './africas-talking-voice.service';

@Controller('platform/voice')
export class VoiceController {
  constructor(private readonly voice:AfricaTalkingVoiceService){}
  @UseGuards(AuthGuard) @Post('calls') initiate(@Req() req:{user:AraUser},@Body() body:unknown){return this.voice.initiateCall(req.user,body);}
  @UseGuards(AuthGuard) @Get('calls') list(@Req() req:{user:AraUser}){return this.voice.listCalls(req.user);}
}
