import { BadRequestException, Body, Controller, Param, Post, Request, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { WorkspaceMemberGuard } from '../common/guards/workspace-member.guard'
import { PermissionsGuard } from '../common/guards/permissions.guard'
import { RequirePermissions } from '../common/decorators/permissions.decorator'
import { Permission } from '../common/permissions/permissions.enum'
import { FileAssetsService } from './file-assets.service'
import { PrismaService } from '../prisma.service'
import { PresignUploadDto } from './dto/presign-upload.dto'
import { FinalizeUploadDto } from './dto/finalize-upload.dto'
import { requireProjectAccess } from '../common/utils/project-access'

@Controller()
@UseGuards(JwtAuthGuard)
export class FileAssetsController {
  constructor(
    private fileAssetsService: FileAssetsService,
    private prisma: PrismaService,
  ) {}

  @Post('projects/:projectId/file-assets/presign')
  @UseGuards(WorkspaceMemberGuard, PermissionsGuard)
  @RequirePermissions(Permission.FILE_UPLOAD)
  async presign(@Param('projectId') projectId: string, @Body() dto: PresignUploadDto, @Request() req: any) {
    const pid = parseInt(projectId, 10)
    if (!pid) throw new BadRequestException('Invalid project id')
    if (!dto.fileName) throw new BadRequestException('fileName is required')
    await requireProjectAccess(this.prisma, pid, req.user.sub, req.workspaceId)
    return this.fileAssetsService.presignUpload(pid, req.workspaceId, dto, req.user.sub)
  }

  @Post('projects/:projectId/file-assets/finalize')
  @UseGuards(WorkspaceMemberGuard, PermissionsGuard)
  @RequirePermissions(Permission.FILE_UPLOAD)
  async finalize(@Param('projectId') projectId: string, @Body() dto: FinalizeUploadDto, @Request() req: any) {
    const pid = parseInt(projectId, 10)
    if (!pid) throw new BadRequestException('Invalid project id')
    if (!dto.bucket || !dto.key) throw new BadRequestException('bucket and key are required')
    await requireProjectAccess(this.prisma, pid, req.user.sub, req.workspaceId)
    return this.fileAssetsService.finalize(pid, req.workspaceId, dto, req.user.sub)
  }
}
