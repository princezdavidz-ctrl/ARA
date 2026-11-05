import { Module } from '@nestjs/common';
import { PlatformController } from './platform.controller';
import { PlatformService } from './platform.service';
import { AuthGuard } from './auth.guard';
import { ConfigService } from '../config/config.service';
import { DatabaseService } from '../database/database.service';
import { LeadController } from './lead.controller';
import { LeadService } from './lead.service';
@Module({ controllers: [PlatformController, LeadController], providers: [PlatformService, LeadService, AuthGuard, ConfigService, DatabaseService], exports: [AuthGuard] })
export class PlatformModule {}
