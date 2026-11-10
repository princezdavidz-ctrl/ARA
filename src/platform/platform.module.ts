import { Module } from '@nestjs/common';
import { PlatformController } from './platform.controller';
import { PlatformService } from './platform.service';
import { AuthGuard } from './auth.guard';
import { ConfigService } from '../config/config.service';
import { DatabaseService } from '../database/database.service';
import { LeadController } from './lead.controller';
import { LeadService } from './lead.service';
import { PlatformAdminController } from './platform-admin.controller';
import { PlatformAdminService } from './platform-admin.service';
import { PlatformAdminGuard } from './platform-admin.guard';
@Module({ controllers: [PlatformController, LeadController, PlatformAdminController], providers: [PlatformService, LeadService, PlatformAdminService, AuthGuard, PlatformAdminGuard, ConfigService, DatabaseService], exports: [AuthGuard] })
export class PlatformModule {}
