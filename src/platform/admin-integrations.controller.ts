import { Body,Controller,Get,Param,Post,Req,UseGuards } from '@nestjs/common';
import { PlatformAdminGuard,PlatformAdmin } from './platform-admin.guard';
import { AdminIntegrationsService } from './admin-integrations.service';
@Controller('admin')
@UseGuards(PlatformAdminGuard)
export class AdminIntegrationsController {
 constructor(private readonly service:AdminIntegrationsService){}
 @Get('integrations/mpesa') mpesaStatus(@Req() req:{platformAdmin:PlatformAdmin}){return this.service.mpesaStatus(req.platformAdmin);}
 @Post('integrations/mpesa') saveMpesa(@Req() req:{platformAdmin:PlatformAdmin},@Body() body:unknown){return this.service.saveMpesa(req.platformAdmin,body);}
 @Get('companies/:id/channels') companyChannels(@Req() req:{platformAdmin:PlatformAdmin},@Param('id') id:string){return this.service.listCompanyChannels(req.platformAdmin,id);}
 @Post('companies/:id/channels') addCompanyChannel(@Req() req:{platformAdmin:PlatformAdmin},@Param('id') id:string,@Body() body:unknown){return this.service.addCompanyChannel(req.platformAdmin,id,body);}
}
