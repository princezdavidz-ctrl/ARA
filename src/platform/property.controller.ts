import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard, AraUser } from './auth.guard';
import { PropertyService } from './property.service';
import { propertyCreateSchema, propertyQuerySchema, propertyUpdateSchema } from './property.contracts';

@Controller('platform/properties')
@UseGuards(AuthGuard)
export class PropertyController {
  constructor(private readonly properties:PropertyService) {}

  @Get()
  list(@Req() req:{user:AraUser},@Query() query:unknown) {
    return this.properties.list(req.user.agencyId,propertyQuerySchema.parse(query));
  }

  @Post()
  create(@Req() req:{user:AraUser},@Body() body:unknown) {
    return this.properties.create(req.user.agencyId,propertyCreateSchema.parse(body));
  }

  @Patch(':id')
  update(@Req() req:{user:AraUser},@Param('id') id:string,@Body() body:unknown) {
    return this.properties.update(req.user.agencyId,id,propertyUpdateSchema.parse(body));
  }

  @Post(':id/status')
  status(@Req() req:{user:AraUser},@Param('id') id:string,@Body() body:{status?:string}) {
    const status=body?.status;
    if(!['available','reserved','let','sold','inactive'].includes(String(status))) throw new BadRequestException('Invalid property status');
    return this.properties.setStatus(req.user.agencyId,id,status as 'available'|'reserved'|'let'|'sold'|'inactive');
  }
}
