import { Body, Controller, Get, Post, Query, Request, UseGuards } from '@nestjs/common'
import { GoogleDriveService } from './google-drive.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { WorkspaceMemberGuard } from '../../common/guards/workspace-member.guard'
import { PermissionsGuard } from '../../common/guards/permissions.guard'
import { RequirePermissions } from '../../common/decorators/permissions.decorator'
import { Permission } from '../../common/permissions/permissions.enum'

class ImportGoogleDriveDto {
  projectId: number
  fileId: string
  title?: string
}

@Controller('integrations/google-drive')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class GoogleDriveController {
  constructor(private readonly service: GoogleDriveService) {}

  @Get('status')
  @RequirePermissions(Permission.DOC_VIEW)
  async status(@Request() req: any) {
    return this.service.getStatus(req.user.sub)
  }

  @Get('auth-url')
  @RequirePermissions(Permission.DOC_VIEW)
  async authUrl(@Request() req: any) {
    return this.service.getAuthUrl(req.user.sub)
  }

  @Get('files')
  @RequirePermissions(Permission.DOC_VIEW)
  async listFiles(@Request() req: any, @Query('query') query?: string) {
    return this.service.listFiles(req.user.sub, query)
  }

  @Post('import')
  @UseGuards(WorkspaceMemberGuard)
  @RequirePermissions(Permission.DOC_CREATE)
  async importFile(@Request() req: any, @Body() dto: ImportGoogleDriveDto) {
    return this.service.importFile({
      userId: req.user.sub,
      workspaceId: req.workspaceId,
      projectId: dto.projectId,
      fileId: dto.fileId,
      title: dto.title,
    })
  }
}
