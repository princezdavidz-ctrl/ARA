import { Body, Controller, HttpCode, Post, Query } from '@nestjs/common';
import { AfricaTalkingSmsService } from './africas-talking-sms.service';
@Controller('webhooks/africas-talking/sms')
export class AfricaTalkingSmsWebhookController {
  constructor(private readonly sms:AfricaTalkingSmsService){}
  @HttpCode(200) @Post('incoming') incoming(@Query('token') token:string,@Body() body:any){return this.sms.receiveIncoming(token,body);}
  @HttpCode(200) @Post('delivery-report') deliveryReport(@Query('token') token:string,@Body() body:any){return this.sms.receiveDeliveryReport(token,body);}
}
