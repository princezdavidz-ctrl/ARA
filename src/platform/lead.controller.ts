import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard, AraUser } from './auth.guard';
import { LeadService } from './lead.service';
import { leadQuerySchema } from './lead.contracts';
import { BadRequestException } from '@nestjs/common';

@Controller('platform/leads')
@UseGuards(AuthGuard)
export class LeadController {
  constructor(private readonly leads: LeadService) {}

  @Get()
  list(@Req() req:{user:AraUser},@Query() query:Record<string,unknown>) {
    const parsed=leadQuerySchema.safeParse(query);
    if(!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.leads.list(req.user,parsed.data);
  }

  @Post()
  create(@Req() req:{user:AraUser},@Body() body:unknown) { return this.leads.create(req.user,body); }

  @Get(':id')
  get(@Req() req:{user:AraUser},@Param('id') id:string) { return this.leads.get(req.user,id); }

  @Patch(':id')
  update(@Req() req:{user:AraUser},@Param('id') id:string,@Body() body:unknown) { return this.leads.update(req.user,id,body); }

  @Post(':id/status')
  setStatus(@Req() req:{user:AraUser},@Param('id') id:string,@Body() body:unknown) { return this.leads.setStatus(req.user,id,body); }

  @Post(':id/notes')
  addNote(@Req() req:{user:AraUser},@Param('id') id:string,@Body() body:unknown) { return this.leads.addNote(req.user,id,body); }
}
