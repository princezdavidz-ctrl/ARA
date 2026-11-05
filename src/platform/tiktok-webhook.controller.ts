import { Controller, Post, Req, Res } from '@nestjs/common';
import { RawBodyRequest } from '@nestjs/common';
import { Request, Response } from 'express';
import { TikTokWebhookService } from './tiktok-webhook.service';
@Controller('webhooks/tiktok')
export class TikTokWebhookController {
  constructor(private readonly tiktok:TikTokWebhookService){}
  @Post()
  async receive(@Req() request:RawBodyRequest<Request>,@Res() response:Response){
    const timestamp=request.headers['x-ara-tiktok-timestamp'];const signature=request.headers['x-ara-tiktok-signature'];
    const result=await this.tiktok.receive(request.rawBody,typeof timestamp==='string'?timestamp:undefined,typeof signature==='string'?signature:undefined,request.body);
    return response.status(200).json(result);
  }
}
