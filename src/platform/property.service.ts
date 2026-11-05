import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { IngestionService } from '../rag/ingestion.service';
import { PropertyCreate } from './property.contracts';

@Injectable()
export class PropertyService {
  constructor(private readonly db: DatabaseService, private readonly ingestion: IngestionService) {}

  async list(agencyId: string, filters: {purpose?:string;county?:string;town?:string;status?:string;limit:number}) {
    const result = await this.db.query(
      `SELECT id,source_ref AS "sourceRef",title,description,purpose,property_type AS "propertyType",
        county,town,area,price::text AS price,currency,bedrooms,bathrooms,size_sqm::text AS "sizeSqm",
        language,status,created_at AS "createdAt",updated_at AS "updatedAt"
       FROM properties WHERE agency_id=$1
        AND ($2::text IS NULL OR purpose=$2)
        AND ($3::text IS NULL OR lower(county)=lower($3))
        AND ($4::text IS NULL OR lower(coalesce(town,''))=lower($4))
        AND ($5::text IS NULL OR status=$5)
       ORDER BY updated_at DESC LIMIT $6`,
      [agencyId,filters.purpose??null,filters.county??null,filters.town??null,filters.status??'available',filters.limit],
    );
    return result.rows;
  }

  async create(agencyId: string, input: PropertyCreate) {
    const content = this.toKnowledgeText(input);
    const indexed = await this.ingestion.upsert({
      title: input.title,
      category: 'property_listing',
      language: input.language,
      content,
      sourceRef: input.sourceRef,
      metadata: {
        purpose: input.purpose, propertyType: input.propertyType, county: input.county,
        location: [input.area,input.town,input.county].filter(Boolean).join(', '),
        price: input.price, currency: 'KES', bedrooms: input.bedrooms,
        bathrooms: input.bathrooms, sizeSqm: input.sizeSqm,
      },
    }, agencyId);
    try {
      const result = await this.db.query(
        `INSERT INTO properties(agency_id,source_ref,title,description,purpose,property_type,county,town,area,price,
          bedrooms,bathrooms,size_sqm,language)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         ON CONFLICT(agency_id,source_ref) DO UPDATE SET title=EXCLUDED.title,description=EXCLUDED.description,
          purpose=EXCLUDED.purpose,property_type=EXCLUDED.property_type,county=EXCLUDED.county,town=EXCLUDED.town,
          area=EXCLUDED.area,price=EXCLUDED.price,bedrooms=EXCLUDED.bedrooms,bathrooms=EXCLUDED.bathrooms,
          size_sqm=EXCLUDED.size_sqm,language=EXCLUDED.language,updated_at=now()
         RETURNING id,source_ref AS "sourceRef",title,purpose,property_type AS "propertyType",county,town,area,
          price::text AS price,currency,bedrooms,bathrooms,size_sqm::text AS "sizeSqm",language,status`,
        [agencyId,input.sourceRef,input.title,input.description,input.purpose,input.propertyType,input.county,
          input.town??null,input.area??null,input.price,input.bedrooms??null,input.bathrooms??null,input.sizeSqm??null,input.language],
      );
      return {...result.rows[0],knowledgeDocumentId:indexed.documentId};
    } catch (error) {
      throw error;
    }
  }

  async update(agencyId:string,id:string,patch:Partial<PropertyCreate>) {
    const current=await this.db.query<any>('SELECT * FROM properties WHERE id=$1 AND agency_id=$2',[id,agencyId]);
    if(!current.rowCount) throw new NotFoundException('Property not found');
    const row=current.rows[0];
    const merged:PropertyCreate={
      sourceRef:row.source_ref,title:patch.title??row.title,description:patch.description??row.description,
      purpose:patch.purpose??row.purpose,propertyType:patch.propertyType??row.property_type,county:patch.county??row.county,
      town:patch.town??row.town??undefined,area:patch.area??row.area??undefined,price:patch.price??Number(row.price),
      bedrooms:patch.bedrooms??row.bedrooms??undefined,bathrooms:patch.bathrooms??row.bathrooms??undefined,
      sizeSqm:patch.sizeSqm??(row.size_sqm===null?undefined:Number(row.size_sqm)),language:patch.language??row.language,
    };
    await this.create(agencyId,merged);
    const result=await this.db.query('SELECT id,source_ref AS "sourceRef",title,purpose,property_type AS "propertyType",county,town,area,price::text AS price,bedrooms,bathrooms,size_sqm::text AS "sizeSqm",language,status,updated_at AS "updatedAt" FROM properties WHERE id=$1 AND agency_id=$2',[id,agencyId]);
    return result.rows[0];
  }

  async setStatus(agencyId:string,id:string,status:'available'|'reserved'|'let'|'sold'|'inactive') {
    const result=await this.db.query('UPDATE properties SET status=$3,updated_at=now() WHERE id=$1 AND agency_id=$2 RETURNING source_ref AS "sourceRef",title,description,purpose,property_type AS "propertyType",county,town,area,price::text AS price,bedrooms,bathrooms,size_sqm::text AS "sizeSqm",language',[id,agencyId,status]);
    if(!result.rowCount) throw new NotFoundException('Property not found');
    const p=result.rows[0];
    if(status==='inactive'||status==='sold'||status==='let') {
      await this.ingestion.deactivate('property_listing',p.sourceRef,agencyId);
    } else {
      await this.ingestion.upsert({title:p.title,category:'property_listing',language:p.language,sourceRef:p.sourceRef,
        content:this.toKnowledgeText({...p,sourceRef:p.sourceRef,price:Number(p.price),propertyType:p.propertyType} as PropertyCreate),
        metadata:{purpose:p.purpose,propertyType:p.propertyType,county:p.county,location:[p.area,p.town,p.county].filter(Boolean).join(', '),price:Number(p.price),currency:'KES',bedrooms:p.bedrooms,bathrooms:p.bathrooms,sizeSqm:p.sizeSqm}},agencyId);
    }
    return {id, status};
  }

  private toKnowledgeText(p:PropertyCreate):string {
    return [
      `Property: ${p.title}`,`Purpose: ${p.purpose}`,`Type: ${p.propertyType}`,
      `Location: ${[p.area,p.town,p.county].filter(Boolean).join(', ')}`,
      `Price: KES ${p.price.toLocaleString('en-KE')}`,
      p.bedrooms===undefined?null:`Bedrooms: ${p.bedrooms}`,
      p.bathrooms===undefined?null:`Bathrooms: ${p.bathrooms}`,
      p.sizeSqm===undefined?null:`Size: ${p.sizeSqm} square metres`,
      `Description: ${p.description}`,
    ].filter(Boolean).join('\n');
  }
}
