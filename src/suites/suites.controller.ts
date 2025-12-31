import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
  Request,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common'
import { PrismaService } from '../prisma.service'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { WorkspaceMemberGuard } from '../common/guards/workspace-member.guard'
import { PermissionsGuard } from '../common/guards/permissions.guard'
import { RequirePermissions } from '../common/decorators/permissions.decorator'
import { Permission } from '../common/permissions/permissions.enum'
import { requireProjectAccess } from '../common/utils/project-access'

@Controller()
@UseGuards(JwtAuthGuard)
export class SuitesController {
  constructor(private prisma: PrismaService) {}

  @Get('projects/:id/suites')
  @UseGuards(WorkspaceMemberGuard, PermissionsGuard)
  @RequirePermissions(Permission.SUITE_VIEW)
  async listByProject(@Param('id') id: string, @Request() req: any) {
    const projectId = parseInt(id, 10)
    if (!projectId) throw new BadRequestException('Invalid project id')
    await requireProjectAccess(this.prisma, projectId, req.user.sub, req.workspaceId)

    const suites = await this.prisma.suite.findMany({
      where: { projectId },
      orderBy: [{ order: 'asc' }, { id: 'asc' }],
    })
    return suites.map((s) => ({
      id: s.id.toString(),
      name: s.name,
      description: s.description,
      tags: s.tags,
      order: s.order,
      projectId: s.projectId.toString(),
      workspaceId: s.workspaceId.toString(),
      parentId: s.parentId?.toString(),
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    }))
  }

  @Post('projects/:id/suites')
  @UseGuards(WorkspaceMemberGuard, PermissionsGuard)
  @RequirePermissions(Permission.SUITE_CREATE)
  async createSuite(
    @Param('id') id: string,
    @Body() body: { name: string; description?: string; tags?: string[]; parentId?: number; order?: number },
    @Request() req: any,
  ) {
    const projectId = parseInt(id, 10)
    if (!projectId) throw new BadRequestException('Invalid project id')
    if (!body?.name) throw new BadRequestException('Name is required')

    const workspaceId = req.workspaceId as number
    await requireProjectAccess(this.prisma, projectId, req.user.sub, workspaceId)
    const suite = await this.prisma.suite.create({
      data: {
        name: body.name,
        description: body.description ?? null,
        tags: body.tags ?? [],
        order: body.order ?? 0,
        projectId,
        workspaceId,
        parentId: body.parentId ?? null,
      },
    })
    return {
      id: suite.id.toString(),
      name: suite.name,
      description: suite.description,
      tags: suite.tags,
      order: suite.order,
      projectId: suite.projectId.toString(),
      workspaceId: suite.workspaceId.toString(),
      parentId: suite.parentId?.toString(),
      createdAt: suite.createdAt,
      updatedAt: suite.updatedAt,
    }
  }

  @Patch('suites/:id')
  @UseGuards(WorkspaceMemberGuard, PermissionsGuard)
  @RequirePermissions(Permission.SUITE_UPDATE)
  async updateSuite(
    @Param('id') id: string,
    @Body() body: { name?: string; description?: string | null; tags?: string[]; parentId?: number | null; order?: number },
    @Request() req: any,
  ) {
    const suiteId = parseInt(id, 10)
    if (!suiteId) throw new BadRequestException('Invalid suite id')

    const suite = await this.prisma.suite.findUnique({ where: { id: suiteId } })
    if (!suite || suite.workspaceId !== req.workspaceId) {
      throw new NotFoundException()
    }
    await requireProjectAccess(this.prisma, suite.projectId, req.user.sub, req.workspaceId)

    const updated = await this.prisma.suite.update({
      where: { id: suiteId },
      data: {
        name: body.name ?? suite.name,
        description: body.description !== undefined ? body.description : suite.description,
        tags: body.tags !== undefined ? body.tags : suite.tags,
        parentId: body.parentId !== undefined ? body.parentId : suite.parentId,
        order: body.order ?? suite.order,
      },
    })
    return {
      id: updated.id.toString(),
      name: updated.name,
      description: updated.description,
      tags: updated.tags,
      order: updated.order,
      projectId: updated.projectId.toString(),
      workspaceId: updated.workspaceId.toString(),
      parentId: updated.parentId?.toString(),
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    }
  }

  @Delete('suites/:id')
  @UseGuards(WorkspaceMemberGuard, PermissionsGuard)
  @RequirePermissions(Permission.SUITE_DELETE)
  async deleteSuite(@Param('id') id: string, @Request() req: any) {
    const suiteId = parseInt(id, 10)
    if (!suiteId) throw new BadRequestException('Invalid suite id')
    const suite = await this.prisma.suite.findUnique({ where: { id: suiteId } })
    if (!suite || suite.workspaceId !== req.workspaceId) {
      throw new NotFoundException()
    }
    await requireProjectAccess(this.prisma, suite.projectId, req.user.sub, req.workspaceId)
    await this.prisma.testCase.updateMany({
      where: { suiteId },
      data: { suiteId: null },
    })
    await this.prisma.suite.delete({ where: { id: suiteId } })
    return { deleted: true }
  }
}
