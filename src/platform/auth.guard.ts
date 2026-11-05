import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { ConfigService } from '../config/config.service';
import { DatabaseService } from '../database/database.service';

export interface AraUser { id: string; agencyId: string; role: string; email: string; }
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly config: ConfigService, private readonly db: DatabaseService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const header = req.headers.authorization as string | undefined;
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException('Bearer token required');
    const parts = header.slice(7).split('.');
    if (parts.length !== 3) throw new UnauthorizedException('Invalid access token');
    const expected = createHmac('sha256', this.config.get('JWT_SECRET')).update(parts[0] + '.' + parts[1]).digest();
    const supplied = Buffer.from(parts[2], 'base64url');
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) throw new UnauthorizedException('Invalid access token');
    let claims: any;
    try { claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')); } catch { throw new UnauthorizedException('Invalid access token'); }
    if (!claims.sub || !claims.agencyId || !claims.exp || claims.exp <= Math.floor(Date.now()/1000)) throw new UnauthorizedException('Expired access token');
    const result = await this.db.query<AraUser>(`SELECT u.id, u.agency_id AS "agencyId", u.role, u.email
      FROM agency_users u JOIN agencies a ON a.id=u.agency_id
      WHERE u.id=$1 AND u.agency_id=$2 AND u.is_active=true AND a.is_active=true`, [claims.sub, claims.agencyId]);
    if (!result.rows[0]) throw new UnauthorizedException('Account or agency inactive or unavailable');
    req.user = result.rows[0];
    return true;
  }
}
