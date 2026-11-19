import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { SupportService } from '../platform/support.service';
const requestWindows = new Map<string,number[]>();
@Controller('public/support')
export class PublicSupportController {
  constructor(private readonly support:SupportService){}
  @Post('requests') create(@Req() req:{ip?:string},@Body() body:unknown){const ip=req.ip||'unknown',now=Date.now(),recent=(requestWindows.get(ip)||[]).filter(t=>now-t<60000);if(recent.length>=5)throw new (require('@nestjs/common').HttpException)('Please wait before starting another support request.',429);recent.push(now);requestWindows.set(ip,recent);return this.support.createPublicThread(body);}
  @Get('requests/:id/messages') messages(@Param('id') id:string,@Query('token') token:string,@Query('after') after?:string){return this.support.publicMessages(id,token,after);}
  @Post('requests/:id/messages') addMessage(@Param('id') id:string,@Body() body:unknown){return this.support.addPublicMessage(id,body);}
}
