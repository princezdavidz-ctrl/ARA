import { BadRequestException, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import { OpenAiService } from '../llm/openai.service';
import { KnowledgeInput } from './contracts';
import { chunkText } from './text-chunker';

@Injectable()
export class IngestionService {
  constructor(private db:DatabaseService,private ai:OpenAiService){}

  private async resolveKnowledgeBase(agencyId:string,requestedId?:string):Promise<string>{
    if(requestedId){
      const selected=await this.db.query<{id:string}>('SELECT id FROM knowledge_bases WHERE agency_id=$1 AND id=$2',[agencyId,requestedId]);
      if(!selected.rowCount) throw new BadRequestException('Knowledge base not found for this company');
      return selected.rows[0].id;
    }
    const existing=await this.db.query<{id:string}>('SELECT id FROM knowledge_bases WHERE agency_id=$1 AND is_default=true ORDER BY created_at LIMIT 1',[agencyId]);
    if(existing.rows[0])return existing.rows[0].id;
    const settings=await this.db.query<{industry:string}>('SELECT industry FROM company_settings WHERE agency_id=$1',[agencyId]);
    const industry=settings.rows[0]?.industry||'general';
    const created=await this.db.query<{id:string}>(
      "INSERT INTO knowledge_bases(agency_id,name,industry,is_default) VALUES($1,'Company Knowledge',$2,true) RETURNING id",
      [agencyId,industry],
    );
    return created.rows[0].id;
  }

  async listBases(agencyId:string){
    const result=await this.db.query('SELECT id,name,industry,description,is_default AS "isDefault",created_at AS "createdAt",updated_at AS "updatedAt" FROM knowledge_bases WHERE agency_id=$1 ORDER BY is_default DESC,created_at',[agencyId]);
    return {items:result.rows};
  }

  async templates(agencyId:string){
    const settings=await this.db.query<{industry:string}>('SELECT industry FROM company_settings WHERE agency_id=$1',[agencyId]);
    const industry=settings.rows[0]?.industry||'general';
    const result=await this.db.query(
      'SELECT industry,category,display_name AS "displayName",description,metadata_schema AS "metadataSchema",sort_order AS "sortOrder" FROM knowledge_category_templates WHERE industry IN ($1,\'general\') ORDER BY CASE WHEN industry=$1 THEN 0 ELSE 1 END,sort_order,display_name',
      [industry],
    );
    return {industry,items:result.rows};
  }

  async upsert(x:KnowledgeInput,agencyId:string){
    const parts=chunkText(x.content);
    if(!parts.length)throw new BadRequestException('No indexable content');
    const knowledgeBaseId=await this.resolveKnowledgeBase(agencyId,x.knowledgeBaseId);
    const hash=createHash('sha256').update(JSON.stringify({...x,knowledgeBaseId})).digest('hex');
    const old=x.sourceRef
      ?await this.db.query<{id:string;content_hash:string}>('SELECT id,content_hash FROM knowledge_documents WHERE agency_id=$1 AND knowledge_base_id=$2 AND category=$3 AND source_ref=$4',[agencyId,knowledgeBaseId,x.category,x.sourceRef])
      :{rows:[] as {id:string;content_hash:string}[]};
    if(old.rows[0]?.content_hash===hash)return{documentId:old.rows[0].id,knowledgeBaseId,chunks:0,unchanged:true};
    const vectors=await this.ai.embed(parts);
    return this.db.transaction(async c=>{
      let id:string;
      if(old.rows[0]){
        id=old.rows[0].id;
        await c.query('UPDATE knowledge_documents SET knowledge_base_id=$1,title=$2,language=$3,content=$4,metadata=$5,content_hash=$6,is_active=true,updated_at=now() WHERE id=$7 AND agency_id=$8',[knowledgeBaseId,x.title,x.language,x.content,JSON.stringify(x.metadata),hash,id,agencyId]);
        await c.query('DELETE FROM knowledge_chunks WHERE document_id=$1',[id]);
      }else{
        const r=await c.query<{id:string}>('INSERT INTO knowledge_documents(agency_id,knowledge_base_id,title,category,language,content,source_ref,metadata,content_hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id',[agencyId,knowledgeBaseId,x.title,x.category,x.language,x.content,x.sourceRef??null,JSON.stringify(x.metadata),hash]);
        id=r.rows[0].id;
      }
      for(let i=0;i<parts.length;i++)await c.query('INSERT INTO knowledge_chunks(document_id,chunk_index,content,embedding) VALUES($1,$2,$3,$4::vector)',[id,i,parts[i],`[${vectors[i].join(',')}]`]);
      return{documentId:id,knowledgeBaseId,chunks:parts.length,unchanged:false};
    });
  }

  async deactivate(category:string,sourceRef:string,agencyId:string,knowledgeBaseId?:string){
    const r=await this.db.query('UPDATE knowledge_documents SET is_active=false,updated_at=now() WHERE agency_id=$1 AND category=$2 AND source_ref=$3 AND ($4::uuid IS NULL OR knowledge_base_id=$4)',[agencyId,category,sourceRef,knowledgeBaseId||null]);
    return(r.rowCount??0)>0;
  }
}
