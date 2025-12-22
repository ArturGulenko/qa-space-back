import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma.service'
import { CreateDocDto } from './dto/create-doc.dto'
import { UpdateDocDto } from './dto/update-doc.dto'
import { AttachFileDto } from './dto/attach-file.dto'

@Injectable()
export class DocsService {
  constructor(private prisma: PrismaService) {}

  async list(projectId: number, workspaceId: number, filters: { parentId?: number; type?: string; tag?: string; status?: string; query?: string }) {
    const where: any = { projectId, workspaceId }
    if (filters.parentId !== undefined) where.parentId = filters.parentId
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

  async get(docId: number, workspaceId: number) {
    const doc = await this.prisma.doc.findUnique({
      where: { id: docId },
      include: {
        attachments: { include: { fileAsset: true }, orderBy: { order: 'asc' } },
      },
    })
    if (!doc || doc.workspaceId !== workspaceId) throw new NotFoundException('Document not found')
    return doc
  }

  async create(projectId: number, workspaceId: number, userId: number, dto: CreateDocDto) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } })
    if (!project || project.workspaceId !== workspaceId) throw new NotFoundException('Project not found')

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
        order: dto.order ?? 0,
        createdById: userId,
        updatedById: userId,
      },
      include: { attachments: true },
    })
  }

  async update(docId: number, workspaceId: number, userId: number, dto: UpdateDocDto) {
    const doc = await this.get(docId, workspaceId)

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
        order: dto.order !== undefined ? dto.order : doc.order,
        version: doc.version + 1,
        updatedById: userId,
      },
      include: { attachments: { include: { fileAsset: true }, orderBy: { order: 'asc' } } },
    })

    return updated
  }

  async archive(docId: number, workspaceId: number, userId: number) {
    const doc = await this.get(docId, workspaceId)

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
        version: doc.version + 1,
        updatedById: userId,
      },
    })

    return { archived: true }
  }

  async listVersions(docId: number, workspaceId: number) {
    await this.get(docId, workspaceId)
    return this.prisma.docVersion.findMany({
      where: { docId },
      orderBy: { version: 'desc' },
    })
  }

  async restoreVersion(docId: number, workspaceId: number, version: number, userId: number) {
    const doc = await this.get(docId, workspaceId)
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

  async addAttachment(docId: number, workspaceId: number, dto: AttachFileDto) {
    const doc = await this.get(docId, workspaceId)
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

  async removeAttachment(docId: number, workspaceId: number, attachmentId: number) {
    const attachment = await this.prisma.docAttachment.findUnique({
      where: { id: attachmentId },
      include: { doc: true },
    })
    if (!attachment || attachment.doc.workspaceId !== workspaceId || attachment.docId !== docId) {
      throw new NotFoundException('Attachment not found')
    }
    await this.prisma.docAttachment.delete({ where: { id: attachmentId } })
    return { deleted: true }
  }
}
