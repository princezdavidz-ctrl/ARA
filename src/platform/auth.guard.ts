import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { ConfigService } from '../config/config.service';
import { DatabaseService } from '../database/database.service';
export interface AraUser { id: string; agencyId: string; role: string; email: string; fullName: string; }
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly config: ConfigService, private readonly db: DatabaseService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const header = request.headers.authorization as string | undefined;
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException('Bearer token required');
    const parts = header.slice(7).split('.');
    if (parts.length !== 3) throw new UnauthorizedException('Invalid access token');
    let tokenHeader: any; let claims: any;
    try { tokenHeader = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')); claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')); }
    catch { throw new UnauthorizedException('Invalid access token'); }
    if (!tokenHeader || tokenHeader.alg !== 'HS256' || tokenHeader.typ !== 'JWT') throw new UnauthorizedException('Unsupported access token');
    const secret = this.config.get('JWT_SECRET');
    if (!secret || secret.length < 32) throw new UnauthorizedException('Authentication is not configured');
    const expected = createHmac('sha256', secret).update(parts[0] + '.' + parts[1]).digest();
    const supplied = Buffer.from(parts[2], 'base64url');
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) throw new UnauthorizedException('Invalid access token');
    if (!claims.sub || !claims.agencyId || !Number.isInteger(claims.exp) || claims.exp <= Math.floor(Date.now() / 1000)) throw new UnauthorizedException('Expired or invalid access token');
    const result = await this.db.query<AraUser>(`SELECT u.id, u.agency_id AS "agencyId", u.role, u.email, u.full_name AS "fullName"
      FROM agency_users u JOIN agencies a ON a.id = u.agency_id
      WHERE u.id = $1 AND u.agency_id = $2 AND u.is_active = true AND a.is_active = true`,
    [claims.sub, claims.agencyId]);
    if (!result.rows[0]) throw new UnauthorizedException('Account or agency inactive or unavailable');
    request.user = result.rows[0];
    return true;
  }
}