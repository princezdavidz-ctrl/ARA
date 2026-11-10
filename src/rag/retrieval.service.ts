import { Injectable } from '@nestjs/common';
import { ConfigService } from '../config/config.service';
import { DatabaseService } from '../database/database.service';
import { OpenAiService } from '../llm/openai.service';
import { AnswerInput,Chunk } from './contracts';

@Injectable()
export class RetrievalService {
  constructor(private db:DatabaseService,private ai:OpenAiService,private config:ConfigService){}

  async search(x:AnswerInput,agencyId:string):Promise<Chunk[]>{
    const [v]=await this.ai.embed([x.message]);
    const f=x.filters;
    const metadataFilters:Record<string,unknown>={...(f.metadata||{})};
    if(f.location)metadataFilters.location=f.location;
    if(f.propertyType)metadataFilters.propertyType=f.propertyType;
    if(f.purpose)metadataFilters.purpose=f.purpose;
    if(f.bedrooms!==undefined)metadataFilters.bedrooms=f.bedrooms;
    const r=await this.db.query<any>(`SELECT d.id AS document_id,d.title,d.category,d.language,d.metadata,c.content,
        (1-(c.embedding <=> $1::vector))::float AS similarity
      FROM knowledge_chunks c
      JOIN knowledge_documents d ON d.id=c.document_id
      WHERE d.agency_id=$6 AND d.is_active
        AND ($2::text IS NULL OR d.category=$2)
        AND ($3::jsonb='{}'::jsonb OR d.metadata @> $3::jsonb)
        AND ($4::uuid IS NULL OR d.knowledge_base_id=$4)
        AND ($5::numeric IS NULL OR CASE
          WHEN d.metadata->>'price' ~ '^[0-9]+([.][0-9]+)?$' THEN (d.metadata->>'price')::numeric
          ELSE NULL END <= $5::numeric)
      ORDER BY c.embedding <=> $1::vector
      LIMIT $7`,
      [`[${v.join(',')}]`,f.category??null,JSON.stringify(metadataFilters),f.knowledgeBaseId??null,f.maxPrice??null,agencyId,this.config.get('RAG_TOP_K')]);
    return r.rows.map((a:any)=>({documentId:a.document_id,title:a.title,category:a.category,language:a.language,metadata:a.metadata,content:a.content,similarity:Number(a.similarity)}));
  }
}
