import { Controller, Get, Post, Query, Req, Res } from '@nestjs/common';
import { RawBodyRequest } from '@nestjs/common';
import { Request, Response } from 'express';
import { InstagramWebhookService } from './instagram-webhook.service';
@Controller('webhooks/instagram')
export class InstagramWebhookController {
  constructor(private readonly instagram: InstagramWebhookService) {}
  @Get()
  async verify(@Query('hub.mode') mode:string,@Query('hub.verify_token') token:string,@Query('hub.challenge') challenge:string,@Res() response:Response){
    return response.status(200).type('text/plain').send(await this.instagram.verifySubscription(mode,token,challenge));
  }
  @Post()
  async receive(@Req() request:RawBodyRequest<Request>,@Res() response:Response){
    const header=request.headers['x-hub-signature-256'];
    const result=await this.instagram.receive(request.rawBody,typeof header==='string'?header:undefined,request.body);
    return response.status(200).json(result);
  }
}
