import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma.service'
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
import { requireProjectAccess } from '../common/utils/project-access'

@Injectable()
export class DocsService {
  constructor(private prisma: PrismaService) {}

  private async ensureProjectAccess(projectId: number, workspaceId: number, userId: number) {
    await requireProjectAccess(this.prisma, projectId, userId, workspaceId)
  }

  async list(
    projectId: number,
    workspaceId: number,
    userId: number,
    filters: { parentId?: number; folderId?: number; type?: string; tag?: string; status?: string; query?: string },
  ) {
    await this.ensureProjectAccess(projectId, workspaceId, userId)
    const where: any = { projectId, workspaceId }
    if (filters.parentId !== undefined) where.parentId = filters.parentId
    if (filters.folderId !== undefined) where.folderId = filters.folderId
    if (filters.type) where.type = filters.type
    if (filters.status) where.status = filters.status
    if (filters.tag) where.tags = { has: filters.tag }
    if (filters.query) {
      where.OR = [
        { title: { contains: filters.query, mode: 'insensitive' } },
        { content: { contains: filters.query, mode: 'insensitive' } },
      ]
    }

    return this.prisma.doc.findMany({
      where,
      orderBy: [{ parentId: 'asc' }, { order: 'asc' }, { updatedAt: 'desc' }],
      include: { attachments: { include: { fileAsset: true }, orderBy: { order: 'asc' } } },
    })
  }

  async get(docId: number, workspaceId: number, userId: number) {
    const doc = await this.prisma.doc.findUnique({
      where: { id: docId },
      include: {
        attachments: { include: { fileAsset: true }, orderBy: { order: 'asc' } },
        reviewWorkflow: {
          include: {
            actions: { orderBy: { createdAt: 'desc' } },
          },
        },
        links: true,
      },
    })
    if (!doc || doc.workspaceId !== workspaceId) throw new NotFoundException('Document not found')
    await this.ensureProjectAccess(doc.projectId, workspaceId, userId)
    return doc
  }

  async create(projectId: number, workspaceId: number, userId: number, dto: CreateDocDto) {
    await this.ensureProjectAccess(projectId, workspaceId, userId)
    if (dto.folderId != null) {
      const folder = await this.prisma.docFolder.findUnique({ where: { id: dto.folderId } })
      if (!folder || folder.workspaceId !== workspaceId || folder.projectId !== projectId) {
        throw new BadRequestException('Folder not found')
      }
    }

    return this.prisma.doc.create({
      data: {
        title: dto.title,
        content: dto.content ?? '',
        type: dto.type ?? 'other',
        status: dto.status ?? 'draft',
        tags: dto.tags ?? [],
        projectId,
        workspaceId,
        parentId: dto.parentId ?? null,
        folderId: dto.folderId ?? null,
        order: dto.order ?? 0,
        createdById: userId,
        updatedById: userId,
      },
      include: { attachments: true },
    })
  }

  async update(docId: number, workspaceId: number, userId: number, dto: UpdateDocDto) {
    const doc = await this.get(docId, workspaceId, userId)
    if (doc.status === 'published') {
      throw new BadRequestException('Published document is read-only. Create a draft to edit.')
    }
    if (dto.folderId != null) {
      const folder = await this.prisma.docFolder.findUnique({ where: { id: dto.folderId } })
      if (!folder || folder.workspaceId !== workspaceId || folder.projectId !== doc.projectId) {
        throw new BadRequestException('Folder not found')
      }
    }

    // create version snapshot before update
    await this.prisma.docVersion.create({
      data: {
        docId,
        version: doc.version,
        title: doc.title,
        content: doc.content,
        createdById: userId,
        changeNote: dto.changeNote,
      },
    })

    const updated = await this.prisma.doc.update({
      where: { id: docId },
      data: {
        title: dto.title ?? doc.title,
        content: dto.content ?? doc.content,
        status: dto.status ?? doc.status,
        type: dto.type ?? doc.type,
        tags: dto.tags ?? doc.tags,
        parentId: dto.parentId !== undefined ? dto.parentId : doc.parentId,
        folderId: dto.folderId !== undefined ? dto.folderId : doc.folderId,
        order: dto.order !== undefined ? dto.order : doc.order,
        version: doc.version + 1,
        updatedById: userId,
      },
      include: { attachments: { include: { fileAsset: true }, orderBy: { order: 'asc' } } },
    })

    return updated
  }

  async archive(docId: number, workspaceId: number, userId: number) {
    const doc = await this.get(docId, workspaceId, userId)

    await this.prisma.docVersion.create({
      data: {
        docId,
        version: doc.version,
        title: doc.title,
        content: doc.content,
        createdById: userId,
        changeNote: 'Archived',
      },
    })

    await this.prisma.doc.update({
      where: { id: docId },
      data: {
        status: 'archived',
        archivedAt: new Date(),
        version: doc.version + 1,
        updatedById: userId,
      },
    })

    return { archived: true }
  }

  async restore(docId: number, workspaceId: number, userId: number) {
    const doc = await this.get(docId, workspaceId, userId)

    await this.prisma.docVersion.create({
      data: {
        docId,
        version: doc.version,
        title: doc.title,
        content: doc.content,
        createdById: userId,
        changeNote: 'Restored from archive',
      },
    })

    await this.prisma.doc.update({
      where: { id: docId },
      data: {
        status: 'draft',
        archivedAt: null,
        version: doc.version + 1,
        updatedById: userId,
      },
    })

    return { restored: true }
  }

  async publish(docId: number, workspaceId: number, userId: number) {
    const doc = await this.get(docId, workspaceId, userId)
    if (doc.status !== 'approved') {
      throw new BadRequestException('Document must be approved before publishing')
    }
    if (doc.archivedAt) {
      throw new BadRequestException('Cannot publish archived document')
    }
    await this.prisma.doc.update({
      where: { id: docId },
      data: {
        status: 'published',
        publishedAt: new Date(),
        updatedById: userId,
      },
    })
    return { published: true }
  }

  async unpublish(docId: number, workspaceId: number, userId: number) {
    const doc = await this.get(docId, workspaceId, userId)
    if (doc.status !== 'published') {
      throw new BadRequestException('Document is not published')
    }
    await this.prisma.doc.update({
      where: { id: docId },
      data: {
        status: 'draft',
        publishedAt: null,
        updatedById: userId,
      },
    })
    return { unpublished: true }
  }

  async createDraft(docId: number, workspaceId: number, userId: number) {
    const doc = await this.get(docId, workspaceId, userId)
    if (doc.status !== 'published') {
      throw new BadRequestException('Document must be published to create a draft')
    }

    await this.prisma.docVersion.create({
      data: {
        docId,
        version: doc.version,
        title: doc.title,
        content: doc.content,
        createdById: userId,
        changeNote: 'Draft created from published',
      },
    })

    await this.prisma.doc.update({
      where: { id: docId },
      data: {
        status: 'draft',
        publishedAt: null,
        version: doc.version + 1,
        updatedById: userId,
      },
    })

    return { draftCreated: true }
  }

  async listVersions(docId: number, workspaceId: number, userId: number) {
    await this.get(docId, workspaceId, userId)
    return this.prisma.docVersion.findMany({
      where: { docId },
      orderBy: { version: 'desc' },
    })
  }

  async restoreVersion(docId: number, workspaceId: number, version: number, userId: number) {
    const doc = await this.get(docId, workspaceId, userId)
    const ver = await this.prisma.docVersion.findFirst({ where: { docId, version } })
    if (!ver) throw new NotFoundException('Version not found')

    // snapshot current before restore
    await this.prisma.docVersion.create({
      data: {
        docId,
        version: doc.version,
        title: doc.title,
        content: doc.content,
        createdById: userId,
        changeNote: 'Snapshot before restore',
      },
    })

    return this.prisma.doc.update({
      where: { id: docId },
      data: {
        title: ver.title,
        content: ver.content,
        version: doc.version + 1,
        updatedById: userId,
        status: 'draft',
      },
      include: { attachments: { include: { fileAsset: true }, orderBy: { order: 'asc' } } },
    })
  }

  async addAttachment(docId: number, workspaceId: number, userId: number, dto: AttachFileDto) {
    const doc = await this.get(docId, workspaceId, userId)
    const asset = await this.prisma.fileAsset.findUnique({ where: { id: dto.fileAssetId } })
    if (!asset || asset.workspaceId !== workspaceId || asset.projectId !== doc.projectId) {
      throw new BadRequestException('File asset not found or not in workspace/project')
    }
    return this.prisma.docAttachment.create({
      data: {
        docId,
        fileAssetId: dto.fileAssetId,
        caption: dto.caption ?? null,
        order: dto.order ?? 0,
      },
      include: { fileAsset: true },
    })
  }

  async removeAttachment(docId: number, workspaceId: number, userId: number, attachmentId: number) {
    const attachment = await this.prisma.docAttachment.findUnique({
      where: { id: attachmentId },
      include: { doc: true },
    })
    if (!attachment || attachment.doc.workspaceId !== workspaceId || attachment.docId !== docId) {
      throw new NotFoundException('Attachment not found')
    }
    await this.ensureProjectAccess(attachment.doc.projectId, workspaceId, userId)
    await this.prisma.docAttachment.delete({ where: { id: attachmentId } })
    return { deleted: true }
  }

  async listComments(docId: number, workspaceId: number, userId: number) {
    await this.get(docId, workspaceId, userId)
    return this.prisma.docComment.findMany({
      where: { docId },
      orderBy: { createdAt: 'desc' },
      include: { createdBy: true, resolvedBy: true },
    })
  }

  async addComment(docId: number, workspaceId: number, userId: number, dto: CreateCommentDto) {
    await this.get(docId, workspaceId, userId)
    if (!dto.message || dto.message.trim().length === 0) {
      throw new BadRequestException('Message is required')
    }
    return this.prisma.docComment.create({
      data: {
        docId,
        message: dto.message.trim(),
        version: dto.version ?? null,
        anchor: dto.anchor ?? null,
        createdById: userId,
      },
      include: { createdBy: true, resolvedBy: true },
    })
  }

  async updateComment(commentId: number, workspaceId: number, userId: number, dto: UpdateCommentDto) {
    const comment = await this.prisma.docComment.findUnique({
      where: { id: commentId },
      include: { doc: true },
    })
    if (!comment || comment.doc.workspaceId !== workspaceId) {
      throw new NotFoundException('Comment not found')
    }
    await this.ensureProjectAccess(comment.doc.projectId, workspaceId, userId)

    return this.prisma.docComment.update({
      where: { id: commentId },
      data: {
        message: dto.message ?? comment.message,
        resolvedAt:
          dto.resolved === true
            ? new Date()
            : dto.resolved === false
              ? null
              : comment.resolvedAt,
        resolvedById:
          dto.resolved === true
            ? userId
            : dto.resolved === false
              ? null
              : comment.resolvedById,
      },
      include: { createdBy: true, resolvedBy: true },
    })
  }

  async getReview(docId: number, workspaceId: number, userId: number) {
    await this.get(docId, workspaceId, userId)
    return this.prisma.docReviewWorkflow.findUnique({
      where: { docId },
      include: { actions: { orderBy: { createdAt: 'desc' } } },
    })
  }

  async requestReview(docId: number, workspaceId: number, userId: number, dto: ReviewRequestDto) {
    const doc = await this.get(docId, workspaceId, userId)
    if (!dto.reviewers || dto.reviewers.length === 0) {
      throw new BadRequestException('Reviewers are required')
    }
    if (doc.status === 'archived') {
      throw new BadRequestException('Cannot request review for archived document')
    }

    const existing = await this.prisma.docReviewWorkflow.findUnique({ where: { docId } })
    const workflow = existing
      ? await this.prisma.docReviewWorkflow.update({
          where: { docId },
          data: {
            reviewers: dto.reviewers,
            requestedById: userId,
            state: 'pending',
            note: dto.note ?? null,
            decidedById: null,
            decidedAt: null,
          },
        })
      : await this.prisma.docReviewWorkflow.create({
          data: {
            docId,
            requestedById: userId,
            reviewers: dto.reviewers,
            state: 'pending',
            note: dto.note ?? null,
          },
        })

    await this.prisma.docReviewAction.create({
      data: {
        workflowId: workflow.id,
        action: 'request',
        note: dto.note ?? null,
        actorId: userId,
      },
    })

    await this.prisma.doc.update({
      where: { id: docId },
      data: {
        status: 'in_review',
        updatedById: userId,
      },
    })

    return workflow
  }

  async approveReview(docId: number, workspaceId: number, userId: number, dto: ReviewActionDto) {
    await this.get(docId, workspaceId, userId)
    const workflow = await this.prisma.docReviewWorkflow.findUnique({ where: { docId } })
    if (!workflow || workflow.state !== 'pending') {
      throw new BadRequestException('No pending review workflow')
    }

    const updated = await this.prisma.docReviewWorkflow.update({
      where: { docId },
      data: {
        state: 'approved',
        decidedById: userId,
        decidedAt: new Date(),
        note: dto.note ?? workflow.note,
      },
    })

    await this.prisma.docReviewAction.create({
      data: {
        workflowId: updated.id,
        action: 'approve',
        note: dto.note ?? null,
        actorId: userId,
      },
    })

    await this.prisma.doc.update({
      where: { id: docId },
      data: {
        status: 'approved',
        updatedById: userId,
      },
    })

    return updated
  }

  async rejectReview(docId: number, workspaceId: number, userId: number, dto: ReviewActionDto) {
    await this.get(docId, workspaceId, userId)
    const workflow = await this.prisma.docReviewWorkflow.findUnique({ where: { docId } })
    if (!workflow || workflow.state !== 'pending') {
      throw new BadRequestException('No pending review workflow')
    }

    const updated = await this.prisma.docReviewWorkflow.update({
      where: { docId },
      data: {
        state: 'rejected',
        decidedById: userId,
        decidedAt: new Date(),
        note: dto.note ?? workflow.note,
      },
    })

    await this.prisma.docReviewAction.create({
      data: {
        workflowId: updated.id,
        action: 'reject',
        note: dto.note ?? null,
        actorId: userId,
      },
    })

    await this.prisma.doc.update({
      where: { id: docId },
      data: {
        status: 'draft',
        updatedById: userId,
      },
    })

    return updated
  }

  async listTemplates(projectId: number, workspaceId: number, userId: number, type?: string) {
    await this.ensureProjectAccess(projectId, workspaceId, userId)
    const where: any = { workspaceId, projectId }
    if (type) where.type = type
    return this.prisma.docTemplate.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
    })
  }

  async createTemplate(projectId: number, workspaceId: number, userId: number, dto: CreateTemplateDto) {
    await this.ensureProjectAccess(projectId, workspaceId, userId)
    return this.prisma.docTemplate.create({
      data: {
        name: dto.name,
        type: dto.type ?? 'doc',
        content: dto.content ?? '',
        projectId,
        workspaceId,
        createdById: userId,
      },
    })
  }

  async updateTemplate(templateId: number, workspaceId: number, userId: number, dto: UpdateTemplateDto) {
    const template = await this.prisma.docTemplate.findUnique({ where: { id: templateId } })
    if (!template || template.workspaceId !== workspaceId) {
      throw new NotFoundException('Template not found')
    }
    await this.ensureProjectAccess(template.projectId, workspaceId, userId)
    return this.prisma.docTemplate.update({
      where: { id: templateId },
      data: {
        name: dto.name ?? template.name,
        type: dto.type ?? template.type,
        content: dto.content ?? template.content,
      },
    })
  }

  async deleteTemplate(templateId: number, workspaceId: number, userId: number) {
    const template = await this.prisma.docTemplate.findUnique({ where: { id: templateId } })
    if (!template || template.workspaceId !== workspaceId) {
      throw new NotFoundException('Template not found')
    }
    await this.ensureProjectAccess(template.projectId, workspaceId, userId)
    await this.prisma.docTemplate.delete({ where: { id: templateId } })
    return { deleted: true }
  }

  async listFolders(projectId: number, workspaceId: number, userId: number) {
    await this.ensureProjectAccess(projectId, workspaceId, userId)
    return this.prisma.docFolder.findMany({
      where: { projectId, workspaceId },
      orderBy: [{ parentId: 'asc' }, { order: 'asc' }, { name: 'asc' }],
    })
  }

  async createFolder(projectId: number, workspaceId: number, userId: number, dto: CreateFolderDto) {
    await this.ensureProjectAccess(projectId, workspaceId, userId)
    if (dto.parentId != null) {
      const parent = await this.prisma.docFolder.findUnique({ where: { id: dto.parentId } })
      if (!parent || parent.workspaceId !== workspaceId || parent.projectId !== projectId) {
        throw new BadRequestException('Parent folder not found')
      }
    }
    return this.prisma.docFolder.create({
      data: {
        name: dto.name,
        parentId: dto.parentId ?? null,
        order: dto.order ?? 0,
        projectId,
        workspaceId,
      },
    })
  }

  async updateFolder(folderId: number, workspaceId: number, userId: number, dto: UpdateFolderDto) {
    const folder = await this.prisma.docFolder.findUnique({ where: { id: folderId } })
    if (!folder || folder.workspaceId !== workspaceId) {
      throw new NotFoundException('Folder not found')
    }
    await this.ensureProjectAccess(folder.projectId, workspaceId, userId)
    if (dto.parentId != null && dto.parentId === folderId) {
      throw new BadRequestException('Folder cannot be its own parent')
    }
    if (dto.parentId != null) {
      const parent = await this.prisma.docFolder.findUnique({ where: { id: dto.parentId } })
      if (!parent || parent.workspaceId !== workspaceId) {
        throw new BadRequestException('Parent folder not found')
      }
    }
    return this.prisma.docFolder.update({
      where: { id: folderId },
      data: {
        name: dto.name ?? folder.name,
        parentId: dto.parentId !== undefined ? dto.parentId : folder.parentId,
        order: dto.order ?? folder.order,
      },
    })
  }

  async deleteFolder(folderId: number, workspaceId: number, userId: number) {
    const folder = await this.prisma.docFolder.findUnique({ where: { id: folderId } })
    if (!folder || folder.workspaceId !== workspaceId) {
      throw new NotFoundException('Folder not found')
    }
    await this.ensureProjectAccess(folder.projectId, workspaceId, userId)
    const childCount = await this.prisma.docFolder.count({ where: { parentId: folderId } })
    if (childCount > 0) {
      throw new BadRequestException('Folder is not empty')
    }
    const docCount = await this.prisma.doc.count({ where: { folderId } })
    if (docCount > 0) {
      throw new BadRequestException('Folder contains documents')
    }
    await this.prisma.docFolder.delete({ where: { id: folderId } })
    return { deleted: true }
  }

  async listLinks(docId: number, workspaceId: number, userId: number) {
    await this.get(docId, workspaceId, userId)
    return this.prisma.docLink.findMany({
      where: { docId },
      orderBy: { createdAt: 'desc' },
    })
  }

  async addLink(docId: number, workspaceId: number, userId: number, dto: CreateLinkDto) {
    await this.get(docId, workspaceId, userId)
    if (!dto.entityType || !dto.entityId) {
      throw new BadRequestException('entityType and entityId are required')
    }
    return this.prisma.docLink.create({
      data: {
        docId,
        entityType: dto.entityType,
        entityId: dto.entityId,
      },
    })
  }

  async deleteLink(linkId: number, workspaceId: number, userId: number) {
    const link = await this.prisma.docLink.findUnique({
      where: { id: linkId },
      include: { doc: true },
    })
    if (!link || link.doc.workspaceId !== workspaceId) {
      throw new NotFoundException('Link not found')
    }
    await this.ensureProjectAccess(link.doc.projectId, workspaceId, userId)
    await this.prisma.docLink.delete({ where: { id: linkId } })
    return { deleted: true }
  }
}
