import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { SupportService } from '../platform/support.service';
@Controller('public/support')
export class PublicSupportController {
  constructor(private readonly support:SupportService){}
  @Post('requests') create(@Body() body:unknown){return this.support.createPublicThread(body);}
  @Get('requests/:id/messages') messages(@Param('id') id:string,@Query('token') token:string,@Query('after') after?:string){return this.support.publicMessages(id,token,after);}
  @Post('requests/:id/messages') addMessage(@Param('id') id:string,@Body() body:unknown){return this.support.addPublicMessage(id,body);}
}
