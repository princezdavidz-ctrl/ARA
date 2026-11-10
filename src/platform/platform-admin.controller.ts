import { Body, Controller, Get, Param, Post, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { PlatformAdminService } from './platform-admin.service';
import { PlatformAdminGuard, PlatformAdmin } from './platform-admin.guard';
@Controller('admin')
export class PlatformAdminController {
 constructor(private readonly adminService:PlatformAdminService){}
 @Post('auth/login') login(@Body() body:unknown){return this.adminService.login(body);}
 @UseGuards(PlatformAdminGuard) @Get('overview') overview(@Req() req:{platformAdmin:PlatformAdmin}){return this.adminService.overview(req.platformAdmin);}
 @UseGuards(PlatformAdminGuard) @Get('companies') companies(@Req() req:{platformAdmin:PlatformAdmin},@Query() query:unknown){return this.adminService.companies(req.platformAdmin,query);}
 @UseGuards(PlatformAdminGuard) @Get('companies/:id') company(@Req() req:{platformAdmin:PlatformAdmin},@Param('id') id:string){return this.adminService.company(req.platformAdmin,id);}
 @UseGuards(PlatformAdminGuard) @Post('companies') createCompany(@Req() req:{platformAdmin:PlatformAdmin},@Body() body:unknown){return this.adminService.createCompany(req.platformAdmin,body);}
 @UseGuards(PlatformAdminGuard) @Patch('companies/:id/status') setCompanyStatus(@Req() req:{platformAdmin:PlatformAdmin},@Param('id') id:string,@Body() body:unknown){return this.adminService.setCompanyStatus(req.platformAdmin,id,body);}
}
