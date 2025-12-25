import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../prisma.service'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { WorkspaceMemberGuard } from '../common/guards/workspace-member.guard'
import { PermissionsGuard } from '../common/guards/permissions.guard'
import { RequirePermissions } from '../common/decorators/permissions.decorator'
import { Permission } from '../common/permissions/permissions.enum'

@Controller('workspaces')
@UseGuards(JwtAuthGuard)
export class WorkspacesController {
  constructor(private prisma: PrismaService) {}

  @Get()
  @UseGuards(PermissionsGuard)
  @RequirePermissions(Permission.WORKSPACE_VIEW)
  async list(@Request() req: any, @Query('includeArchived') includeArchived?: string) {
    const userId = req.user?.sub
    const withArchived = includeArchived === 'true'
    
    // Check if user is superadmin - superadmin sees all workspaces
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isSuperAdmin: true },
    })
    
    if (user?.isSuperAdmin) {
      // Superadmin sees all workspaces
      const allWorkspaces = await this.prisma.workspace.findMany({
        where: withArchived ? undefined : { archivedAt: null },
        orderBy: { name: 'asc' },
      })
      return allWorkspaces.map((ws) => ({
        id: ws.id.toString(),
        slug: ws.slug,
        name: ws.name,
        archivedAt: ws.archivedAt,
        role: 'superadmin',
      }))
    }
    
    // Regular users see only their workspaces
    const memberships = await this.prisma.workspaceMember.findMany({
      where: {
        userId,
        workspace: { archivedAt: null },
      },
      include: { workspace: true },
    })
    return memberships.map((m) => ({ 
      id: m.workspace.id.toString(), 
      slug: m.workspace.slug, 
      name: m.workspace.name, 
      archivedAt: m.workspace.archivedAt,
      role: m.role 
    }))
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @RequirePermissions(Permission.WORKSPACE_CREATE)
  async create(@Body() body: { name: string; slug: string }, @Request() req: any) {
    const userId = req.user?.sub
    const ws = await this.prisma.workspace.create({ data: { name: body.name, slug: body.slug } })
    await this.prisma.workspaceMember.create({ data: { workspaceId: ws.id, userId, role: 'owner' } })
    return {
      id: ws.id.toString(),
      slug: ws.slug,
      name: ws.name,
      archivedAt: ws.archivedAt,
    }
  }

  @Patch(':id')
  @UseGuards(WorkspaceMemberGuard, PermissionsGuard)
  @RequirePermissions(Permission.WORKSPACE_UPDATE)
  async update(@Param('id') id: string, @Body() body: { name?: string; slug?: string }) {
    const workspaceId = parseInt(id, 10)
    if (!workspaceId) {
      throw new BadRequestException('Invalid workspace id')
    }
    const data: { name?: string; slug?: string } = {}
    if (body.name) data.name = body.name
    if (body.slug) data.slug = body.slug
    if (!data.name && !data.slug) {
      throw new BadRequestException('Nothing to update')
    }
    const ws = await this.prisma.workspace.update({
      where: { id: workspaceId },
      data,
    })
    return {
      id: ws.id.toString(),
      slug: ws.slug,
      name: ws.name,
      archivedAt: ws.archivedAt,
    }
  }

  @Post(':id/archive')
  @UseGuards(WorkspaceMemberGuard, PermissionsGuard)
  @RequirePermissions(Permission.WORKSPACE_DELETE)
  async archive(@Param('id') id: string) {
    const workspaceId = parseInt(id, 10)
    if (!workspaceId) {
      throw new BadRequestException('Invalid workspace id')
    }
    const ws = await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: { archivedAt: new Date() },
    })
    return {
      id: ws.id.toString(),
      slug: ws.slug,
      name: ws.name,
      archivedAt: ws.archivedAt,
    }
  }

  @Post(':id/restore')
  @UseGuards(WorkspaceMemberGuard, PermissionsGuard)
  @RequirePermissions(Permission.WORKSPACE_UPDATE)
  async restore(@Param('id') id: string) {
    const workspaceId = parseInt(id, 10)
    if (!workspaceId) {
      throw new BadRequestException('Invalid workspace id')
    }
    const ws = await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: { archivedAt: null },
    })
    return {
      id: ws.id.toString(),
      slug: ws.slug,
      name: ws.name,
      archivedAt: ws.archivedAt,
    }
  }

  @Delete(':id')
  @UseGuards(WorkspaceMemberGuard, PermissionsGuard)
  @RequirePermissions(Permission.WORKSPACE_DELETE)
  async remove(@Param('id') id: string) {
    const workspaceId = parseInt(id, 10)
    if (!workspaceId) {
      throw new BadRequestException('Invalid workspace id')
    }
    try {
      await this.prisma.workspace.delete({ where: { id: workspaceId } })
      return { success: true }
    } catch (error) {
      throw new BadRequestException('Unable to delete workspace with related data')
    }
  }

  @Get(':id/projects')
  @UseGuards(WorkspaceMemberGuard, PermissionsGuard)
  @RequirePermissions(Permission.PROJECT_VIEW)
  async projects(@Param('id') id: string, @Query('includeArchived') includeArchived?: string) {
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

  @Post(':id/projects')
  @UseGuards(WorkspaceMemberGuard, PermissionsGuard)
  @RequirePermissions(Permission.PROJECT_CREATE)
  async createProject(@Param('id') workspaceId: string, @Body() body: { key: string; name: string }, @Request() req: any) {
    const project = await this.prisma.project.create({
      data: { key: body.key, name: body.name, workspaceId: parseInt(workspaceId) }
    })
    // Grant creator admin role in project
    await this.prisma.projectRole.upsert({
      where: { projectId_userId: { projectId: project.id, userId: req.user.sub } },
      update: { role: 'admin' },
      create: { projectId: project.id, userId: req.user.sub, role: 'admin' }
    })
    return {
      id: project.id.toString(),
      workspaceId: project.workspaceId.toString(),
      key: project.key,
      name: project.name,
      archivedAt: project.archivedAt,
    }
  }

  @Get(':id/members')
  @UseGuards(WorkspaceMemberGuard, PermissionsGuard)
  @RequirePermissions(Permission.WORKSPACE_MANAGE_MEMBERS)
  async getMembers(@Param('id') workspaceId: string, @Request() req: any) {
    const wsId = parseInt(workspaceId, 10)
    
    // Check if user is superadmin - superadmin can see all members
    const user = await this.prisma.user.findUnique({
      where: { id: req.user.sub },
      select: { isSuperAdmin: true },
    })
    
    // Superadmin can access any workspace, regular users need membership check
    if (!user?.isSuperAdmin) {
      // For regular users, WorkspaceMemberGuard already checked membership
    }
    
    const members = await this.prisma.workspaceMember.findMany({
      where: { workspaceId: wsId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            isSuperAdmin: true,
          },
        },
      },
      orderBy: { user: { email: 'asc' } },
    })
    return members.map((m) => ({
      id: m.id.toString(),
      userId: m.userId.toString(),
      user: {
        id: m.user.id.toString(),
        email: m.user.email,
        name: m.user.name,
        isSuperAdmin: m.user.isSuperAdmin,
      },
      role: m.role,
      customPermissions: (m as any).customPermissions || [],
    }))
  }

  @Post(':id/members')
  @UseGuards(WorkspaceMemberGuard, PermissionsGuard)
  @RequirePermissions(Permission.WORKSPACE_MANAGE_MEMBERS)
  async addMember(
    @Param('id') workspaceId: string,
    @Body() body: { userId: number; role: string },
    @Request() req: any,
  ) {
    const wsId = parseInt(workspaceId, 10)
    const userId = body.userId
    const role = body.role || 'member'

    // Check if workspace exists
    const workspace = await this.prisma.workspace.findUnique({ where: { id: wsId } })
    if (!workspace) {
      throw new NotFoundException('Workspace not found')
    }

    // Check if user exists
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user) {
      throw new NotFoundException('User not found')
    }
    
    // Check if current user is superadmin or has permission
    const currentUser = await this.prisma.user.findUnique({
      where: { id: req.user.sub },
      select: { isSuperAdmin: true },
    })
    
    // Superadmin can add members to any workspace, others need membership check
    if (!currentUser?.isSuperAdmin) {
      // For regular users, WorkspaceMemberGuard already checked membership
    }

    // Check if user is already a member
    const existingMember = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId: wsId, userId },
    })

    if (existingMember) {
      // Update existing member's role
      const updated = await this.prisma.workspaceMember.update({
        where: { id: existingMember.id },
        data: { role },
      })
      return {
        id: updated.id.toString(),
        userId: updated.userId.toString(),
        user: {
          id: user.id.toString(),
          email: user.email,
          name: user.name,
        },
        role: updated.role,
        customPermissions: (updated as any).customPermissions || [],
      }
    }

    // Create new member
    const member = await this.prisma.workspaceMember.create({
      data: {
        workspaceId: wsId,
        userId,
        role,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    })

    return {
      id: member.id.toString(),
      userId: member.userId.toString(),
      user: {
        id: member.user.id.toString(),
        email: member.user.email,
        name: member.user.name,
      },
      role: member.role,
      customPermissions: (member as any).customPermissions || [],
    }
  }
}
