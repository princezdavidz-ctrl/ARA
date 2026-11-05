import { Controller, Get, Post, Query, Req, Res } from '@nestjs/common';
import { RawBodyRequest } from '@nestjs/common';
import { Request, Response } from 'express';
import { WhatsAppWebhookService } from './whatsapp-webhook.service';

@Controller('webhooks/whatsapp')
export class WhatsAppWebhookController {
  constructor(private readonly whatsapp: WhatsAppWebhookService) {}

  @Get()
  verify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Res() response: Response,
  ) {
    const result = this.whatsapp.verifySubscription(mode, token, challenge);
    return response.status(200).type('text/plain').send(result);
  }

  @Post()
  async receive(@Req() request: RawBodyRequest<Request>, @Res() response: Response) {
    const signatureHeader = request.headers['x-hub-signature-256'];
    const signature = typeof signatureHeader === 'string' ? signatureHeader : undefined;
    const result = await this.whatsapp.receive(request.rawBody, signature, request.body);
    return response.status(200).json(result);
  }
}
