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
import { ChannelConnectionsController } from './channel-connections.controller';
import { ChannelConnectionsService } from './channel-connections.service';
import { ChannelCredentialVault } from './channel-credential-vault.service';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { MpesaService } from './mpesa.service';
@Module({ controllers: [PlatformController, LeadController, PlatformAdminController, ChannelConnectionsController, BillingController], providers: [PlatformService, LeadService, PlatformAdminService, ChannelConnectionsService, ChannelCredentialVault, BillingService, MpesaService, AuthGuard, PlatformAdminGuard, ConfigService, DatabaseService], exports: [AuthGuard, ChannelCredentialVault, BillingService] })
export class PlatformModule {}
