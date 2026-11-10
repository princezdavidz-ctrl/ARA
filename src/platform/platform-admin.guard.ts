import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { ConfigService } from '../config/config.service';
import { DatabaseService } from '../database/database.service';
export interface PlatformAdmin { id:string; email:string; fullName:string; role:string; }
@Injectable()
export class PlatformAdminGuard implements CanActivate {
 constructor(private readonly config:ConfigService, private readonly db:DatabaseService) {}
 async canActivate(context:ExecutionContext):Promise<boolean> {
  const req=context.switchToHttp().getRequest(); const header=req.headers.authorization as string|undefined;
  if(!header?.startsWith('Bearer ')) throw new UnauthorizedException('Platform bearer token required');
  const parts=header.slice(7).split('.'); if(parts.length!==3) throw new UnauthorizedException('Invalid platform access token');
  let h:any,p:any; try { h=JSON.parse(Buffer.from(parts[0],'base64url').toString()); p=JSON.parse(Buffer.from(parts[1],'base64url').toString()); } catch { throw new UnauthorizedException('Invalid platform access token'); }
  if(h?.alg!=='HS256'||h?.typ!=='JWT'||p?.scope!=='ara_platform'||!p?.sub||!Number.isInteger(p?.exp)||p.exp<=Math.floor(Date.now()/1000)) throw new UnauthorizedException('Invalid or expired platform access token');
  const secret=this.config.get('JWT_SECRET'); if(!secret||secret.length<32) throw new UnauthorizedException('Authentication is not configured');
  const expected=createHmac('sha256',secret).update(parts[0]+'.'+parts[1]).digest(), supplied=Buffer.from(parts[2],'base64url');
  if(supplied.length!==expected.length||!timingSafeEqual(supplied,expected)) throw new UnauthorizedException('Invalid platform access token');
  const r=await this.db.query<PlatformAdmin>("SELECT id,email,full_name AS \"fullName\",role FROM platform_admin_users WHERE id=$1 AND is_active=true",[p.sub]);
  if(!r.rows[0]) throw new UnauthorizedException('Platform administrator is inactive or unavailable');
  req.platformAdmin=r.rows[0]; return true;
 }
}
