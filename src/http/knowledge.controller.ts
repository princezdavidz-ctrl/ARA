import { Body,Controller,Post,Req,UseGuards } from '@nestjs/common';
import { IngestionService } from '../rag/ingestion.service';
import { knowledgeSchema } from '../rag/contracts';
import { AuthGuard,AraUser } from '../platform/auth.guard';
@Controller('knowledge')
@UseGuards(AuthGuard)
export class KnowledgeController {
  constructor(private ingest:IngestionService){}
  @Post() async upsert(@Req() req:{user:AraUser},@Body() body:unknown){return this.ingest.upsert(knowledgeSchema.parse(body),req.user.agencyId);}
}
