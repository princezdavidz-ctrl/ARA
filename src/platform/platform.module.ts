import { Module } from '@nestjs/common';
import { PlatformController } from './platform.controller';
import { PlatformService } from './platform.service';
import { AuthGuard } from './auth.guard';
import { ConfigService } from '../config/config.service';
import { DatabaseService } from '../database/database.service';
@Module({ controllers: [PlatformController], providers: [PlatformService, AuthGuard, ConfigService, DatabaseService], exports: [AuthGuard] })
export class PlatformModule {}
