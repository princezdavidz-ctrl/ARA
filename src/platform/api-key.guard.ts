import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly db:DatabaseService) {}
  async canActivate(context:ExecutionContext):Promise<boolean>{
    const request=context.switchToHttp().getRequest();
    const header=String(request.headers?.authorization||'');
    const match=header.match(/^Bearer (ara_live_[A-Za-z0-9_-]{30,})$/);
    if(!match)throw new UnauthorizedException('A valid ARA developer API key is required.');
    const hash=createHash('sha256').update(match[1]).digest('hex');
    const result=await this.db.query(`SELECT k.id,k.agency_id AS "agencyId",k.scopes
      FROM agency_api_keys k JOIN agencies a ON a.id=k.agency_id
      WHERE k.key_hash=$1 AND k.revoked_at IS NULL AND (k.expires_at IS NULL OR k.expires_at>now()) AND a.is_active=true`,[hash]);
    if(!result.rowCount)throw new UnauthorizedException('The ARA developer API key is invalid, expired or revoked.');
    const key=result.rows[0];
    if(!Array.isArray(key.scopes)||!key.scopes.includes('conversations:write'))throw new ForbiddenException('This API key does not have permission to write conversations.');
    request.araApiKey={id:key.id,agencyId:key.agencyId,scopes:key.scopes};
    await this.db.query('UPDATE agency_api_keys SET last_used_at=now() WHERE id=$1',[key.id]);
    return true;
  }
}
