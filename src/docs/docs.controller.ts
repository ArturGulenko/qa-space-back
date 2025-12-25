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
import { PermissionsGuard } from '../common/guards/permissions.guard'
import { RequirePermissions } from '../common/decorators/permissions.decorator'
import { Permission } from '../common/permissions/permissions.enum'
import { CreateDocDto } from './dto/create-doc.dto'
import { UpdateDocDto } from './dto/update-doc.dto'
import { AttachFileDto } from './dto/attach-file.dto'
import { ReviewRequestDto } from './dto/review-request.dto'
import { ReviewActionDto } from './dto/review-action.dto'
import { CreateCommentDto } from './dto/create-comment.dto'
import { UpdateCommentDto } from './dto/update-comment.dto'
import { CreateTemplateDto } from './dto/create-template.dto'
import { UpdateTemplateDto } from './dto/update-template.dto'
import { CreateFolderDto } from './dto/create-folder.dto'
import { UpdateFolderDto } from './dto/update-folder.dto'
import { CreateLinkDto } from './dto/create-link.dto'

@Controller()
@UseGuards(JwtAuthGuard)
export class DocsController {
  constructor(private docsService: DocsService) {}

  @Get('projects/:projectId/docs')
  @UseGuards(WorkspaceMemberGuard, PermissionsGuard)
  @RequirePermissions(Permission.DOC_VIEW)
  async list(
    @Param('projectId') projectId: string,
    @Request() req: any,
    @Query('parentId') parentId?: string,
    @Query('folderId') folderId?: string,
    @Query('type') type?: string,
    @Query('tag') tag?: string,
    @Query('status') status?: string,
    @Query('query') query?: string,
  ) {
    const pid = parseInt(projectId, 10)
    if (!pid) throw new BadRequestException('Invalid project id')
    return this.docsService.list(pid, req.workspaceId, req.user.sub, {
      parentId: parentId ? parseInt(parentId, 10) : undefined,
      folderId: folderId ? parseInt(folderId, 10) : undefined,
      type,
      tag,
      status,
      query,
    })
  }

  @Post('projects/:projectId/docs')
  @UseGuards(WorkspaceMemberGuard, PermissionsGuard)
  @RequirePermissions(Permission.DOC_CREATE)
  async create(@Param('projectId') projectId: string, @Body() dto: CreateDocDto, @Request() req: any) {
    const pid = parseInt(projectId, 10)
    if (!pid) throw new BadRequestException('Invalid project id')
    if (!dto.title) throw new BadRequestException('Title is required')
    return this.docsService.create(pid, req.workspaceId, req.user.sub, dto)
  }

  @Get('docs/:id')
  @UseGuards(WorkspaceMemberGuard, PermissionsGuard)
  @RequirePermissions(Permission.DOC_VIEW)
  async get(@Param('id') id: string, @Request() req: any) {
    const docId = parseInt(id, 10)
    return this.docsService.get(docId, req.workspaceId, req.user.sub)
  }

  @Patch('docs/:id')
  @UseGuards(WorkspaceMemberGuard, PermissionsGuard)
  @RequirePermissions(Permission.DOC_UPDATE)
  async update(@Param('id') id: string, @Body() dto: UpdateDocDto, @Request() req: any) {
    const docId = parseInt(id, 10)
    return this.docsService.update(docId, req.workspaceId, req.user.sub, dto)
  }

  @Post('docs/:id/publish')
  @UseGuards(WorkspaceMemberGuard, PermissionsGuard)
  @RequirePermissions(Permission.DOC_PUBLISH)
  async publish(@Param('id') id: string, @Request() req: any) {
    const docId = parseInt(id, 10)
    return this.docsService.publish(docId, req.workspaceId, req.user.sub)
  }

  @Post('docs/:id/unpublish')
  @UseGuards(WorkspaceMemberGuard, PermissionsGuard)
  @RequirePermissions(Permission.DOC_PUBLISH)
  async unpublish(@Param('id') id: string, @Request() req: any) {
    const docId = parseInt(id, 10)
    return this.docsService.unpublish(docId, req.workspaceId, req.user.sub)
  }

  @Post('docs/:id/draft')
  @UseGuards(WorkspaceMemberGuard, PermissionsGuard)
  @RequirePermissions(Permission.DOC_UPDATE)
  async createDraft(@Param('id') id: string, @Request() req: any) {
    const docId = parseInt(id, 10)
    return this.docsService.createDraft(docId, req.workspaceId, req.user.sub)
  }

  @Delete('docs/:id')
  @UseGuards(WorkspaceMemberGuard, PermissionsGuard)
  @RequirePermissions(Permission.DOC_DELETE)
  async archive(@Param('id') id: string, @Request() req: any) {
    const docId = parseInt(id, 10)
    return this.docsService.archive(docId, req.workspaceId, req.user.sub)
  }

  @Post('docs/:id/restore')
  @UseGuards(WorkspaceMemberGuard, PermissionsGuard)
  @RequirePermissions(Permission.DOC_RESTORE)
  async restore(@Param('id') id: string, @Request() req: any) {
    const docId = parseInt(id, 10)
    return this.docsService.restore(docId, req.workspaceId, req.user.sub)
  }

  @Get('docs/:id/versions')
  @UseGuards(WorkspaceMemberGuard, PermissionsGuard)
  @RequirePermissions(Permission.DOC_VIEW)
  async versions(@Param('id') id: string, @Request() req: any) {
    const docId = parseInt(id, 10)
    return this.docsService.listVersions(docId, req.workspaceId, req.user.sub)
  }

  @Get('docs/:id/review')
  @UseGuards(WorkspaceMemberGuard, PermissionsGuard)
  @RequirePermissions(Permission.DOC_VIEW)
  async review(@Param('id') id: string, @Request() req: any) {
    const docId = parseInt(id, 10)
    return this.docsService.getReview(docId, req.workspaceId, req.user.sub)
  }

  @Post('docs/:id/review/request')
  @UseGuards(WorkspaceMemberGuard, PermissionsGuard)
  @RequirePermissions(Permission.DOC_REVIEW_REQUEST)
  async requestReview(@Param('id') id: string, @Body() dto: ReviewRequestDto, @Request() req: any) {
    const docId = parseInt(id, 10)
    return this.docsService.requestReview(docId, req.workspaceId, req.user.sub, dto)
  }

  @Post('docs/:id/review/approve')
  @UseGuards(WorkspaceMemberGuard, PermissionsGuard)
  @RequirePermissions(Permission.DOC_REVIEW_APPROVE)
  async approveReview(@Param('id') id: string, @Body() dto: ReviewActionDto, @Request() req: any) {
    const docId = parseInt(id, 10)
    return this.docsService.approveReview(docId, req.workspaceId, req.user.sub, dto)
  }

  @Post('docs/:id/review/reject')
  @UseGuards(WorkspaceMemberGuard, PermissionsGuard)
  @RequirePermissions(Permission.DOC_REVIEW_REJECT)
  async rejectReview(@Param('id') id: string, @Body() dto: ReviewActionDto, @Request() req: any) {
    const docId = parseInt(id, 10)
    return this.docsService.rejectReview(docId, req.workspaceId, req.user.sub, dto)
  }

  @Get('docs/:id/comments')
  @UseGuards(WorkspaceMemberGuard, PermissionsGuard)
  @RequirePermissions(Permission.DOC_VIEW)
  async comments(@Param('id') id: string, @Request() req: any) {
    const docId = parseInt(id, 10)
    return this.docsService.listComments(docId, req.workspaceId, req.user.sub)
  }

  @Post('docs/:id/comments')
  @UseGuards(WorkspaceMemberGuard, PermissionsGuard)
  @RequirePermissions(Permission.DOC_UPDATE)
  async addComment(@Param('id') id: string, @Body() dto: CreateCommentDto, @Request() req: any) {
    const docId = parseInt(id, 10)
    return this.docsService.addComment(docId, req.workspaceId, req.user.sub, dto)
  }

  @Patch('comments/:id')
  @UseGuards(WorkspaceMemberGuard, PermissionsGuard)
  @RequirePermissions(Permission.DOC_UPDATE)
  async updateComment(@Param('id') id: string, @Body() dto: UpdateCommentDto, @Request() req: any) {
    const commentId = parseInt(id, 10)
    return this.docsService.updateComment(commentId, req.workspaceId, req.user.sub, dto)
  }

  @Get('projects/:projectId/templates')
  @UseGuards(WorkspaceMemberGuard, PermissionsGuard)
  @RequirePermissions(Permission.DOC_VIEW)
  async listTemplates(@Param('projectId') projectId: string, @Request() req: any, @Query('type') type?: string) {
    const pid = parseInt(projectId, 10)
    if (!pid) throw new BadRequestException('Invalid project id')
    return this.docsService.listTemplates(pid, req.workspaceId, req.user.sub, type)
  }

  @Post('projects/:projectId/templates')
  @UseGuards(WorkspaceMemberGuard, PermissionsGuard)
  @RequirePermissions(Permission.DOC_CREATE)
  async createTemplate(@Param('projectId') projectId: string, @Body() dto: CreateTemplateDto, @Request() req: any) {
    const pid = parseInt(projectId, 10)
    if (!pid) throw new BadRequestException('Invalid project id')
    if (!dto.name) throw new BadRequestException('Name is required')
    return this.docsService.createTemplate(pid, req.workspaceId, req.user.sub, dto)
  }

  @Patch('templates/:id')
  @UseGuards(WorkspaceMemberGuard, PermissionsGuard)
  @RequirePermissions(Permission.DOC_UPDATE)
  async updateTemplate(@Param('id') id: string, @Body() dto: UpdateTemplateDto, @Request() req: any) {
    const templateId = parseInt(id, 10)
    return this.docsService.updateTemplate(templateId, req.workspaceId, req.user.sub, dto)
  }

  @Delete('templates/:id')
  @UseGuards(WorkspaceMemberGuard, PermissionsGuard)
  @RequirePermissions(Permission.DOC_DELETE)
  async deleteTemplate(@Param('id') id: string, @Request() req: any) {
    const templateId = parseInt(id, 10)
    return this.docsService.deleteTemplate(templateId, req.workspaceId, req.user.sub)
  }

  @Get('projects/:projectId/doc-folders')
  @UseGuards(WorkspaceMemberGuard, PermissionsGuard)
  @RequirePermissions(Permission.DOC_VIEW)
  async listFolders(@Param('projectId') projectId: string, @Request() req: any) {
    const pid = parseInt(projectId, 10)
    if (!pid) throw new BadRequestException('Invalid project id')
    return this.docsService.listFolders(pid, req.workspaceId, req.user.sub)
  }

  @Post('projects/:projectId/doc-folders')
  @UseGuards(WorkspaceMemberGuard, PermissionsGuard)
  @RequirePermissions(Permission.DOC_UPDATE)
  async createFolder(@Param('projectId') projectId: string, @Body() dto: CreateFolderDto, @Request() req: any) {
    const pid = parseInt(projectId, 10)
    if (!pid) throw new BadRequestException('Invalid project id')
    if (!dto.name) throw new BadRequestException('Name is required')
    return this.docsService.createFolder(pid, req.workspaceId, req.user.sub, dto)
  }

  @Patch('doc-folders/:id')
  @UseGuards(WorkspaceMemberGuard, PermissionsGuard)
  @RequirePermissions(Permission.DOC_UPDATE)
  async updateFolder(@Param('id') id: string, @Body() dto: UpdateFolderDto, @Request() req: any) {
    const folderId = parseInt(id, 10)
    return this.docsService.updateFolder(folderId, req.workspaceId, req.user.sub, dto)
  }

  @Post('doc-folders/:id/move')
  @UseGuards(WorkspaceMemberGuard, PermissionsGuard)
  @RequirePermissions(Permission.DOC_UPDATE)
  async moveFolder(@Param('id') id: string, @Body() dto: UpdateFolderDto, @Request() req: any) {
    const folderId = parseInt(id, 10)
    return this.docsService.updateFolder(folderId, req.workspaceId, req.user.sub, dto)
  }

  @Delete('doc-folders/:id')
  @UseGuards(WorkspaceMemberGuard, PermissionsGuard)
  @RequirePermissions(Permission.DOC_DELETE)
  async deleteFolder(@Param('id') id: string, @Request() req: any) {
    const folderId = parseInt(id, 10)
    return this.docsService.deleteFolder(folderId, req.workspaceId, req.user.sub)
  }

  @Get('docs/:id/links')
  @UseGuards(WorkspaceMemberGuard, PermissionsGuard)
  @RequirePermissions(Permission.DOC_VIEW)
  async listLinks(@Param('id') id: string, @Request() req: any) {
    const docId = parseInt(id, 10)
    return this.docsService.listLinks(docId, req.workspaceId, req.user.sub)
  }

  @Post('docs/:id/links')
  @UseGuards(WorkspaceMemberGuard, PermissionsGuard)
  @RequirePermissions(Permission.DOC_UPDATE)
  async addLink(@Param('id') id: string, @Body() dto: CreateLinkDto, @Request() req: any) {
    const docId = parseInt(id, 10)
    return this.docsService.addLink(docId, req.workspaceId, req.user.sub, dto)
  }

  @Delete('docs/:id/links/:linkId')
  @UseGuards(WorkspaceMemberGuard, PermissionsGuard)
  @RequirePermissions(Permission.DOC_UPDATE)
  async deleteLink(@Param('id') id: string, @Param('linkId') linkId: string, @Request() req: any) {
    const docId = parseInt(id, 10)
    const lid = parseInt(linkId, 10)
    if (!docId || !lid) throw new BadRequestException('Invalid link id')
    return this.docsService.deleteLink(lid, req.workspaceId, req.user.sub)
  }

  @Post('docs/:id/versions/:version/restore')
  @UseGuards(WorkspaceMemberGuard, PermissionsGuard)
  @RequirePermissions(Permission.DOC_MANAGE_VERSIONS)
  async restoreVersion(@Param('id') id: string, @Param('version') version: string, @Request() req: any) {
    const docId = parseInt(id, 10)
    const ver = parseInt(version, 10)
    return this.docsService.restoreVersion(docId, req.workspaceId, ver, req.user.sub)
  }

  @Post('docs/:id/attachments')
  @UseGuards(WorkspaceMemberGuard, PermissionsGuard)
  @RequirePermissions(Permission.DOC_UPDATE)
  async addAttachment(@Param('id') id: string, @Body() dto: AttachFileDto, @Request() req: any) {
    const docId = parseInt(id, 10)
    if (!dto.fileAssetId) throw new BadRequestException('fileAssetId is required')
    return this.docsService.addAttachment(docId, req.workspaceId, req.user.sub, dto)
  }

  @Delete('docs/:id/attachments/:attachmentId')
  @UseGuards(WorkspaceMemberGuard, PermissionsGuard)
  @RequirePermissions(Permission.DOC_UPDATE)
  async removeAttachment(@Param('id') id: string, @Param('attachmentId') attachmentId: string, @Request() req: any) {
    const docId = parseInt(id, 10)
    const attId = parseInt(attachmentId, 10)
    return this.docsService.removeAttachment(docId, req.workspaceId, req.user.sub, attId)
  }
}
