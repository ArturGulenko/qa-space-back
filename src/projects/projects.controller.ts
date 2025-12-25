import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards, Request, BadRequestException, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma.service'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { WorkspaceMemberGuard } from '../common/guards/workspace-member.guard'
import { PermissionsGuard } from '../common/guards/permissions.guard'
import { RequirePermissions } from '../common/decorators/permissions.decorator'
import { Permission } from '../common/permissions/permissions.enum'

@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(private prisma: PrismaService) {}

  @Get('workspace/:id')
  @UseGuards(WorkspaceMemberGuard, PermissionsGuard)
  @RequirePermissions(Permission.PROJECT_VIEW)
  async listByWorkspace(@Param('id') id: string, @Query('includeArchived') includeArchived?: string) {
    const workspaceId = parseInt(id, 10)
    if (!workspaceId) {
      throw new BadRequestException('Invalid workspace id')
    }
    
    const withArchived = includeArchived === 'true'
    const projects = await this.prisma.project.findMany({ 
      where: { 
        workspaceId,
        ...(withArchived ? {} : { archivedAt: null })
      },
      orderBy: { name: 'asc' }
    })
    return projects.map((p) => ({
      id: p.id.toString(),
      workspaceId: p.workspaceId.toString(),
      key: p.key,
      name: p.name,
      archivedAt: p.archivedAt,
    }))
  }

  @Patch(':id')
  @UseGuards(WorkspaceMemberGuard, PermissionsGuard)
  @RequirePermissions(Permission.PROJECT_UPDATE)
  async update(@Param('id') id: string, @Body() body: { key?: string; name?: string }, @Request() req: any) {
    const projectId = parseInt(id, 10)
    if (!projectId) {
      throw new BadRequestException('Invalid project id')
    }

    // Get project to verify it exists and check workspace
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, workspaceId: true },
    })

    if (!project) {
      throw new NotFoundException('Project not found')
    }

    // Verify workspace access (WorkspaceMemberGuard already checked, but double-check workspaceId matches)
    const headerWorkspace = req.headers['x-workspace-id']
    if (headerWorkspace && parseInt(headerWorkspace, 10) !== project.workspaceId) {
      throw new BadRequestException('Project does not belong to the specified workspace')
    }

    const data: { key?: string; name?: string } = {}
    if (body.key !== undefined) data.key = body.key
    if (body.name !== undefined) data.name = body.name
    
    if (!data.key && !data.name) {
      throw new BadRequestException('Nothing to update')
    }

    const updated = await this.prisma.project.update({
      where: { id: projectId },
      data,
    })

    return {
      id: updated.id.toString(),
      workspaceId: updated.workspaceId.toString(),
      key: updated.key,
      name: updated.name,
      archivedAt: updated.archivedAt,
    }
  }

  @Post(':id/archive')
  @UseGuards(WorkspaceMemberGuard, PermissionsGuard)
  @RequirePermissions(Permission.PROJECT_DELETE)
  async archive(@Param('id') id: string, @Request() req: any) {
    const projectId = parseInt(id, 10)
    if (!projectId) {
      throw new BadRequestException('Invalid project id')
    }

    // Get project to verify it exists and check workspace
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, workspaceId: true },
    })

    if (!project) {
      throw new NotFoundException('Project not found')
    }

    // Verify workspace access
    const headerWorkspace = req.headers['x-workspace-id']
    if (headerWorkspace && parseInt(headerWorkspace, 10) !== project.workspaceId) {
      throw new BadRequestException('Project does not belong to the specified workspace')
    }

    const archived = await this.prisma.project.update({
      where: { id: projectId },
      data: { archivedAt: new Date() },
    })

    return {
      id: archived.id.toString(),
      workspaceId: archived.workspaceId.toString(),
      key: archived.key,
      name: archived.name,
      archivedAt: archived.archivedAt,
    }
  }

  @Post(':id/restore')
  @UseGuards(WorkspaceMemberGuard, PermissionsGuard)
  @RequirePermissions(Permission.PROJECT_UPDATE)
  async restore(@Param('id') id: string, @Request() req: any) {
    const projectId = parseInt(id, 10)
    if (!projectId) {
      throw new BadRequestException('Invalid project id')
    }

    // Get project to verify it exists and check workspace
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, workspaceId: true },
    })

    if (!project) {
      throw new NotFoundException('Project not found')
    }

    // Verify workspace access
    const headerWorkspace = req.headers['x-workspace-id']
    if (headerWorkspace && parseInt(headerWorkspace, 10) !== project.workspaceId) {
      throw new BadRequestException('Project does not belong to the specified workspace')
    }

    const restored = await this.prisma.project.update({
      where: { id: projectId },
      data: { archivedAt: null },
    })

    return {
      id: restored.id.toString(),
      workspaceId: restored.workspaceId.toString(),
      key: restored.key,
      name: restored.name,
      archivedAt: restored.archivedAt,
    }
  }

  @Delete(':id')
  @UseGuards(WorkspaceMemberGuard, PermissionsGuard)
  @RequirePermissions(Permission.PROJECT_DELETE)
  async remove(@Param('id') id: string, @Request() req: any) {
    const projectId = parseInt(id, 10)
    if (!projectId) {
      throw new BadRequestException('Invalid project id')
    }

    // Get project to verify it exists and check workspace
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, workspaceId: true },
    })

    if (!project) {
      throw new NotFoundException('Project not found')
    }

    // Verify workspace access
    const headerWorkspace = req.headers['x-workspace-id']
    if (headerWorkspace && parseInt(headerWorkspace, 10) !== project.workspaceId) {
      throw new BadRequestException('Project does not belong to the specified workspace')
    }

    try {
      await this.prisma.project.delete({ where: { id: projectId } })
      return { success: true }
    } catch (error) {
      throw new BadRequestException('Unable to delete project with related data')
    }
  }
}
