import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ConfigService } from '../config/config.service';
import { DatabaseService } from '../database/database.service';
import { OpenAiService } from '../llm/openai.service';
import { EmbeddingUsageService } from './embedding-usage.service';
import { AnswerInput,Chunk } from './contracts';

@Injectable()
export class RetrievalService {
  private readonly logger = new Logger(RetrievalService.name);
  constructor(private db:DatabaseService,private ai:OpenAiService,private config:ConfigService,private embeddingUsage:EmbeddingUsageService){}

  async search(x:AnswerInput,agencyId:string,context:{channel?:string;conversationId?:string;messageId?:string}={}):Promise<Chunk[]>{
    const f=x.filters;
    const metadataFilters:Record<string,unknown>={...(f.metadata||{})};
    if(f.location)metadataFilters.location=f.location;
    if(f.propertyType)metadataFilters.propertyType=f.propertyType;
    if(f.purpose)metadataFilters.purpose=f.purpose;
    if(f.bedrooms!==undefined)metadataFilters.bedrooms=f.bedrooms;

    try {
      const embedded=await this.ai.embedWithUsage([x.message]);
      await this.embeddingUsage.record(agencyId,embedded,`embedding-retrieval:${agencyId}:${context.messageId??randomUUID()}`,{
        operation:'query_retrieval',channel:context.channel??'unknown',
        conversationId:context.conversationId??null,messageId:context.messageId??null,
      });
      const [v]=embedded.embeddings;
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
      return r.rows.map((a:any)=>({documentId:a.document_id,title:a.title,category:a.category,language:a.language,metadata:a.metadata,content:a.content,similarity:Number(a.similarity),retrievalMethod:'semantic' as const}));
    } catch (error) {
      this.logger.warn('OpenAI query embedding unavailable; using tenant-scoped PostgreSQL full-text retrieval.');
      const r=await this.db.query<any>(`SELECT d.id AS document_id,d.title,d.category,d.language,d.metadata,c.content,
          ts_rank_cd(to_tsvector('simple',c.content),websearch_to_tsquery('simple',$1))::float AS similarity
        FROM knowledge_chunks c
        JOIN knowledge_documents d ON d.id=c.document_id
        WHERE d.agency_id=$6 AND d.is_active
          AND ($2::text IS NULL OR d.category=$2)
          AND ($3::jsonb='{}'::jsonb OR d.metadata @> $3::jsonb)
          AND ($4::uuid IS NULL OR d.knowledge_base_id=$4)
          AND ($5::numeric IS NULL OR CASE
            WHEN d.metadata->>'price' ~ '^[0-9]+([.][0-9]+)?$' THEN (d.metadata->>'price')::numeric
            ELSE NULL END <= $5::numeric)
          AND to_tsvector('simple',c.content) @@ websearch_to_tsquery('simple',$1)
        ORDER BY similarity DESC
        LIMIT $7`,
        [x.message,f.category??null,JSON.stringify(metadataFilters),f.knowledgeBaseId??null,f.maxPrice??null,agencyId,this.config.get('RAG_TOP_K')]);
      if (!r.rows.length && error instanceof Error) {
        this.logger.warn('Offline keyword retrieval returned no matching evidence.');
      }
      return r.rows.map((a:any)=>({documentId:a.document_id,title:a.title,category:a.category,language:a.language,metadata:a.metadata,content:a.content,similarity:Number(a.similarity),retrievalMethod:'keyword' as const}));
    }
  }
}
