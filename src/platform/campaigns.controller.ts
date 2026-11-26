import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard, AraUser } from './auth.guard';
import { CampaignsService } from './campaigns.service';

@Controller('platform/campaigns')
@UseGuards(AuthGuard)
export class CampaignsController {
  constructor(private readonly campaigns: CampaignsService) {}

  @Get()
  list(@Req() req: { user: AraUser }) { return this.campaigns.list(req.user); }

  @Post('preview')
  preview(@Req() req: { user: AraUser }, @Body() body: unknown) { return this.campaigns.preview(req.user, body); }

  @Post()
  create(@Req() req: { user: AraUser }, @Body() body: unknown) { return this.campaigns.create(req.user, body); }

  @Post('consent')
  recordConsent(@Req() req: { user: AraUser }, @Body() body: unknown) { return this.campaigns.recordConsent(req.user, body); }

  @Get(':id')
  detail(@Req() req: { user: AraUser }, @Param('id') id: string) { return this.campaigns.detail(req.user, id); }

  @Post(':id/send')
  send(@Req() req: { user: AraUser }, @Param('id') id: string) { return this.campaigns.send(req.user, id); }

  @Post(':id/cancel')
  cancel(@Req() req: { user: AraUser }, @Param('id') id: string) { return this.campaigns.cancel(req.user, id); }
}
