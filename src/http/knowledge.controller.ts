import { Body,Controller,Get,Post,Req,UseGuards } from '@nestjs/common';
import { IngestionService } from '../rag/ingestion.service';
import { knowledgeSchema } from '../rag/contracts';
import { AuthGuard,AraUser } from '../platform/auth.guard';

@Controller('knowledge')
@UseGuards(AuthGuard)
export class KnowledgeController {
  constructor(private ingest:IngestionService){}
  @Get('bases') bases(@Req() req:{user:AraUser}){return this.ingest.listBases(req.user.agencyId);}
  @Get('templates') templates(@Req() req:{user:AraUser}){return this.ingest.templates(req.user.agencyId);}
  @Post() upsert(@Req() req:{user:AraUser},@Body() body:unknown){return this.ingest.upsert(knowledgeSchema.parse(body),req.user.agencyId);}
}
