import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { AuthGuard, AraUser } from './auth.guard';
import { Customer360Service } from './customer-360.service';

@Controller('platform/customers')
@UseGuards(AuthGuard)
export class Customer360Controller {
  constructor(private readonly customers: Customer360Service) {}

  @Get()
  list(@Req() req: { user: AraUser }) {
    return this.customers.list(req.user);
  }

  @Get(':id')
  detail(@Req() req: { user: AraUser }, @Param('id') id: string) {
    return this.customers.detail(req.user, id);
  }
}
