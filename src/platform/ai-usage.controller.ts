import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { AiUsageService } from './ai-usage.service';
import { AuthGuard, AraUser } from './auth.guard';
import { PlatformAdminGuard, PlatformAdmin } from './platform-admin.guard';

@Controller()
export class AiUsageController {
  constructor(private readonly usage: AiUsageService) {}

  @UseGuards(AuthGuard)
  @Get('platform/ai-usage')
  tenant(@Req() req: { user: AraUser }, @Query('days') days?: string) {
    return this.usage.tenantDashboard(req.user, days);
  }

  @UseGuards(PlatformAdminGuard)
  @Get('admin/ai-usage')
  platform(@Req() req: { platformAdmin: PlatformAdmin }, @Query('days') days?: string) {
    return this.usage.platformDashboard(req.platformAdmin, days);
  }
}
