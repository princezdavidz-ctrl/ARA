import { Body, Controller, HttpCode, Post, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { AfricaTalkingVoiceService } from './africas-talking-voice.service';

@Controller('webhooks/africas-talking/voice')
export class AfricaTalkingVoiceWebhookController {
  constructor(private readonly voice:AfricaTalkingVoiceService){}
  @Post('callback') async callback(@Query('token') token:string,@Body() body:any,@Res() response:Response){
    const xml=await this.voice.handleCallback(token,body);
    return response.status(200).type('text/plain').send(xml);
  }
  @HttpCode(200) @Post('events') events(@Query('token') token:string,@Body() body:any){return this.voice.handleEvent(token,body);}
}
