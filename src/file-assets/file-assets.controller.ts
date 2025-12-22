import { BadRequestException, Body, Controller, Param, Post, Request, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { WorkspaceMemberGuard } from '../common/guards/workspace-member.guard'
import { RolesGuard } from '../common/guards/roles.guard'
import { Roles } from '../common/decorators/roles.decorator'
import { FileAssetsService } from './file-assets.service'
import { PresignUploadDto } from './dto/presign-upload.dto'
import { FinalizeUploadDto } from './dto/finalize-upload.dto'

@Controller()
@UseGuards(JwtAuthGuard)
export class FileAssetsController {
  constructor(private fileAssetsService: FileAssetsService) {}

  @Post('projects/:projectId/file-assets/presign')
  @UseGuards(WorkspaceMemberGuard, RolesGuard)
  @Roles('owner', 'admin')
  async presign(@Param('projectId') projectId: string, @Body() dto: PresignUploadDto, @Request() req: any) {
    const pid = parseInt(projectId, 10)
    if (!pid) throw new BadRequestException('Invalid project id')
    if (!dto.fileName) throw new BadRequestException('fileName is required')
    return this.fileAssetsService.presignUpload(pid, req.workspaceId, dto, req.user.sub)
  }

  @Post('projects/:projectId/file-assets/finalize')
  @UseGuards(WorkspaceMemberGuard, RolesGuard)
  @Roles('owner', 'admin')
  async finalize(@Param('projectId') projectId: string, @Body() dto: FinalizeUploadDto, @Request() req: any) {
    const pid = parseInt(projectId, 10)
    if (!pid) throw new BadRequestException('Invalid project id')
    if (!dto.bucket || !dto.key) throw new BadRequestException('bucket and key are required')
    return this.fileAssetsService.finalize(pid, req.workspaceId, dto, req.user.sub)
  }
}
