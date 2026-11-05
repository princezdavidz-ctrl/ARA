import { Injectable } from '@nestjs/common';
import { ConfigService } from '../config/config.service';
import { DatabaseService } from '../database/database.service';
import { OpenAiService } from '../llm/openai.service';
import { AnswerInput,Chunk } from './contracts';
@Injectable()
export class RetrievalService {
  constructor(private db:DatabaseService,private ai:OpenAiService,private config:ConfigService){}
  async search(x:AnswerInput,agencyId:string):Promise<Chunk[]>{
    const [v]=await this.ai.embed([x.message]);const f=x.filters;
    const r=await this.db.query<any>(`SELECT d.id document_id,d.title,d.category,d.language,d.metadata,c.content,(1-(c.embedding <=> $1::vector))::float similarity
      FROM knowledge_chunks c JOIN knowledge_documents d ON d.id=c.document_id
      WHERE d.agency_id=$9 AND d.is_active
      AND ($2::text IS NULL OR d.category=$2)
      AND ($3::text IS NULL OR lower(d.metadata->>'location')=lower($3))
      AND ($4::text IS NULL OR lower(d.metadata->>'propertyType')=lower($4))
      AND ($5::text IS NULL OR lower(d.metadata->>'purpose')=lower($5))
      AND ($6::int IS NULL OR (d.metadata->>'bedrooms')::int=$6)
      AND ($7::numeric IS NULL OR (d.metadata->>'price')::numeric<=$7)
      ORDER BY c.embedding <=> $1::vector LIMIT $8`,
      [`[${v.join(',')}]`,f.category??null,f.location??null,f.propertyType??null,f.purpose??null,f.bedrooms??null,f.maxPrice??null,this.config.get('RAG_TOP_K'),agencyId]);
    return r.rows.map((a:any)=>({documentId:a.document_id,title:a.title,category:a.category,language:a.language,metadata:a.metadata,content:a.content,similarity:Number(a.similarity)}));
  }
}
