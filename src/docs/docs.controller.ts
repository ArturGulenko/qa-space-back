import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common'
import { DocsService } from './docs.service'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { WorkspaceMemberGuard } from '../common/guards/workspace-member.guard'
import { RolesGuard } from '../common/guards/roles.guard'
import { Roles } from '../common/decorators/roles.decorator'
import { CreateDocDto } from './dto/create-doc.dto'
import { UpdateDocDto } from './dto/update-doc.dto'
import { AttachFileDto } from './dto/attach-file.dto'

@Controller()
@UseGuards(JwtAuthGuard)
export class DocsController {
  constructor(private docsService: DocsService) {}

  @Get('projects/:projectId/docs')
  @UseGuards(WorkspaceMemberGuard)
  async list(
    @Param('projectId') projectId: string,
    @Query('parentId') parentId?: string,
    @Query('type') type?: string,
    @Query('tag') tag?: string,
    @Query('status') status?: string,
    @Query('query') query?: string,
    @Request() req?: any,
  ) {
    const pid = parseInt(projectId, 10)
    if (!pid) throw new BadRequestException('Invalid project id')
    return this.docsService.list(pid, req.workspaceId, {
      parentId: parentId ? parseInt(parentId, 10) : undefined,
      type,
      tag,
      status,
      query,
    })
  }

  @Post('projects/:projectId/docs')
  @UseGuards(WorkspaceMemberGuard, RolesGuard)
  @Roles('owner', 'admin')
  async create(@Param('projectId') projectId: string, @Body() dto: CreateDocDto, @Request() req: any) {
    const pid = parseInt(projectId, 10)
    if (!pid) throw new BadRequestException('Invalid project id')
    if (!dto.title) throw new BadRequestException('Title is required')
    return this.docsService.create(pid, req.workspaceId, req.user.sub, dto)
  }

  @Get('docs/:id')
  @UseGuards(WorkspaceMemberGuard)
  async get(@Param('id') id: string, @Request() req: any) {
    const docId = parseInt(id, 10)
    return this.docsService.get(docId, req.workspaceId)
  }

  @Patch('docs/:id')
  @UseGuards(WorkspaceMemberGuard, RolesGuard)
  @Roles('owner', 'admin')
  async update(@Param('id') id: string, @Body() dto: UpdateDocDto, @Request() req: any) {
    const docId = parseInt(id, 10)
    return this.docsService.update(docId, req.workspaceId, req.user.sub, dto)
  }

  @Delete('docs/:id')
  @UseGuards(WorkspaceMemberGuard, RolesGuard)
  @Roles('owner', 'admin')
  async archive(@Param('id') id: string, @Request() req: any) {
    const docId = parseInt(id, 10)
    return this.docsService.archive(docId, req.workspaceId, req.user.sub)
  }

  @Get('docs/:id/versions')
  @UseGuards(WorkspaceMemberGuard)
  async versions(@Param('id') id: string, @Request() req: any) {
    const docId = parseInt(id, 10)
    return this.docsService.listVersions(docId, req.workspaceId)
  }

  @Post('docs/:id/versions/:version/restore')
  @UseGuards(WorkspaceMemberGuard, RolesGuard)
  @Roles('owner', 'admin')
  async restore(@Param('id') id: string, @Param('version') version: string, @Request() req: any) {
    const docId = parseInt(id, 10)
    const ver = parseInt(version, 10)
    return this.docsService.restoreVersion(docId, req.workspaceId, ver, req.user.sub)
  }

  @Post('docs/:id/attachments')
  @UseGuards(WorkspaceMemberGuard, RolesGuard)
  @Roles('owner', 'admin')
  async addAttachment(@Param('id') id: string, @Body() dto: AttachFileDto, @Request() req: any) {
    const docId = parseInt(id, 10)
    if (!dto.fileAssetId) throw new BadRequestException('fileAssetId is required')
    return this.docsService.addAttachment(docId, req.workspaceId, dto)
  }

  @Delete('docs/:id/attachments/:attachmentId')
  @UseGuards(WorkspaceMemberGuard, RolesGuard)
  @Roles('owner', 'admin')
  async removeAttachment(@Param('id') id: string, @Param('attachmentId') attachmentId: string, @Request() req: any) {
    const docId = parseInt(id, 10)
    const attId = parseInt(attachmentId, 10)
    return this.docsService.removeAttachment(docId, req.workspaceId, attId)
  }
}
