import { Controller, Post, Req, Res } from '@nestjs/common';
import { RawBodyRequest } from '@nestjs/common';
import { Request, Response } from 'express';
import { EmailWebhookService } from './email-webhook.service';

@Controller('webhooks/email')
export class EmailWebhookController {
  constructor(private readonly email: EmailWebhookService) {}
  @Post()
  async receive(@Req() request: RawBodyRequest<Request>, @Res() response: Response) {
    const timestamp=request.headers['x-ara-email-timestamp']; const signature=request.headers['x-ara-email-signature'];
    const result=await this.email.receive(request.rawBody,typeof timestamp==='string'?timestamp:undefined,typeof signature==='string'?signature:undefined,request.body);
    return response.status(200).json(result);
  }
}
