import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import * as bcrypt from 'bcrypt';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private prisma: PrismaService) {}

  /**
   * Check if current user is superadmin or admin in any workspace
   */
  private async checkUserManagementAccess(userId: number): Promise<{
    isSuperAdmin: boolean;
    adminWorkspaceIds: number[];
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isSuperAdmin: true },
    });

    if (user?.isSuperAdmin) {
      return { isSuperAdmin: true, adminWorkspaceIds: [] };
    }

    // Check if user is admin in any workspace
    const adminMemberships = await this.prisma.workspaceMember.findMany({
      where: {
        userId,
        role: { in: ['admin', 'Admin'] },
      },
      select: { workspaceId: true },
    });

    if (adminMemberships.length === 0) {
      throw new ForbiddenException(
        'Only superadmin or workspace admins can manage users',
      );
    }

    return {
      isSuperAdmin: false,
      adminWorkspaceIds: adminMemberships.map((m) => m.workspaceId),
    };
  }

  /**
   * Get all users
   * Superadmin sees all users, admins see only users in their workspaces
   */
  @Get()
  async list(@Request() req: any) {
    const access = await this.checkUserManagementAccess(req.user?.sub);

    let userIds: number[] | undefined;

    if (!access.isSuperAdmin) {
      // Get all user IDs from admin's workspaces
      const memberships = await this.prisma.workspaceMember.findMany({
        where: {
          workspaceId: { in: access.adminWorkspaceIds },
        },
        select: { userId: true },
        distinct: ['userId'],
      });
      userIds = memberships.map((m) => m.userId);
    }

    const users = await this.prisma.user.findMany({
      where: userIds ? { id: { in: userIds } } : undefined,
      select: {
        id: true,
        email: true,
        name: true,
        isSuperAdmin: true,
      },
      orderBy: { id: 'desc' },
    });

    return users.map((user) => ({
      id: user.id.toString(),
      email: user.email,
      name: user.name,
      isSuperAdmin: user.isSuperAdmin,
    }));
  }

  /**
   * Get user by ID with workspace and project access info
   * Superadmin sees all users, admins see only users in their workspaces
   */
  @Get(':id')
  async getById(@Param('id') id: string, @Request() req: any) {
    const access = await this.checkUserManagementAccess(req.user?.sub);

    const userId = parseInt(id, 10);
    if (!userId) {
      throw new BadRequestException('Invalid user id');
    }

    // Check if user is accessible (for admins)
    if (!access.isSuperAdmin) {
      const userInWorkspaces = await this.prisma.workspaceMember.findFirst({
        where: {
          userId,
          workspaceId: { in: access.adminWorkspaceIds },
        },
      });
      if (!userInWorkspaces) {
        throw new ForbiddenException(
          'User is not in any of your managed workspaces',
        );
      }
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        isSuperAdmin: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Get workspace memberships
    const workspaceMemberships = await this.prisma.workspaceMember.findMany({
      where: { userId },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    // Get project roles
    const projectRoles = await this.prisma.projectRole.findMany({
      where: { userId },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            key: true,
            workspaceId: true,
            workspace: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
      },
    });

    return {
      id: user.id.toString(),
      email: user.email,
      name: user.name,
      isSuperAdmin: user.isSuperAdmin,
      workspaces: workspaceMemberships.map((m) => ({
        id: m.workspace.id.toString(),
        name: m.workspace.name,
        slug: m.workspace.slug,
        role: m.role,
        customPermissions: (m as any).customPermissions || [],
      })),
      projects: projectRoles.map((pr) => ({
        id: pr.project.id.toString(),
        name: pr.project.name,
        key: pr.project.key,
        workspaceId: pr.project.workspaceId.toString(),
        workspace: {
          id: pr.project.workspace.id.toString(),
          name: pr.project.workspace.name,
          slug: pr.project.workspace.slug,
        },
        role: pr.role,
        customPermissions: (pr as any).customPermissions || [],
      })),
    };
  }

  /**
   * Create new user (superadmin only, admins cannot create users)
   */
  @Post()
  async create(
    @Body()
    body: {
      email: string;
      name: string;
      password: string;
      isSuperAdmin?: boolean;
    },
    @Request() req: any,
  ) {
    const access = await this.checkUserManagementAccess(req.user?.sub);
    if (!access.isSuperAdmin) {
      throw new ForbiddenException('Only superadmin can create users');
    }

    if (!body.email || !body.name || !body.password) {
      throw new BadRequestException('Email, name, and password are required');
    }

    // Check if user with this email already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: body.email },
    });

    if (existingUser) {
      throw new BadRequestException('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(body.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: body.email,
        name: body.name,
        password: hashedPassword,
        isSuperAdmin: body.isSuperAdmin ?? false,
      },
      select: {
        id: true,
        email: true,
        name: true,
        isSuperAdmin: true,
      },
    });

    return {
      id: user.id.toString(),
      email: user.email,
      name: user.name,
      isSuperAdmin: user.isSuperAdmin,
    };
  }

  /**
   * Update user (superadmin can update all, admins can update users in their workspaces)
   */
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body()
    body: {
      email?: string;
      name?: string;
      password?: string;
      isSuperAdmin?: boolean;
    },
    @Request() req: any,
  ) {
    const access = await this.checkUserManagementAccess(req.user?.sub);

    const userId = parseInt(id, 10);
    if (!userId) {
      throw new BadRequestException('Invalid user id');
    }

    // Check if user is accessible (for admins)
    if (!access.isSuperAdmin) {
      const userInWorkspaces = await this.prisma.workspaceMember.findFirst({
        where: {
          userId,
          workspaceId: { in: access.adminWorkspaceIds },
        },
      });
      if (!userInWorkspaces) {
        throw new ForbiddenException(
          'User is not in any of your managed workspaces',
        );
      }
      // Admins cannot change isSuperAdmin status
      if (body.isSuperAdmin !== undefined) {
        throw new ForbiddenException(
          'Only superadmin can change superadmin status',
        );
      }
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Prevent superadmin from removing their own superadmin status
    if (req.user?.sub === userId && body.isSuperAdmin === false) {
      throw new BadRequestException(
        'You cannot remove superadmin status from yourself',
      );
    }

    const updateData: any = {};
    if (body.email !== undefined) {
      // Check if email is already taken by another user
      if (body.email !== user.email) {
        const existingUser = await this.prisma.user.findUnique({
          where: { email: body.email },
        });
        if (existingUser) {
          throw new BadRequestException('Email is already taken');
        }
      }
      updateData.email = body.email;
    }
    if (body.name !== undefined) {
      updateData.name = body.name;
    }
    if (body.password !== undefined) {
      updateData.password = await bcrypt.hash(body.password, 10);
    }
    if (body.isSuperAdmin !== undefined) {
      updateData.isSuperAdmin = body.isSuperAdmin;
    }

    if (Object.keys(updateData).length === 0) {
      throw new BadRequestException('Nothing to update');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        isSuperAdmin: true,
      },
    });

    return {
      id: updatedUser.id.toString(),
      email: updatedUser.email,
      name: updatedUser.name,
      isSuperAdmin: updatedUser.isSuperAdmin,
    };
  }

  /**
   * Delete user (superadmin only, admins cannot delete users)
   */
  @Delete(':id')
  async delete(@Param('id') id: string, @Request() req: any) {
    const access = await this.checkUserManagementAccess(req.user?.sub);
    if (!access.isSuperAdmin) {
      throw new ForbiddenException('Only superadmin can delete users');
    }

    const userId = parseInt(id, 10);
    if (!userId) {
      throw new BadRequestException('Invalid user id');
    }

    // Prevent superadmin from deleting themselves
    if (req.user?.sub === userId) {
      throw new BadRequestException('You cannot delete yourself');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.prisma.user.delete({
      where: { id: userId },
    });

    return { message: 'User deleted successfully' };
  }

  /**
   * Add user to workspace (superadmin and workspace admins)
   */
  @Post(':id/workspaces')
  async addWorkspaceAccess(
    @Param('id') id: string,
    @Body() body: { workspaceId: number; role: string },
    @Request() req: any,
  ) {
    const access = await this.checkUserManagementAccess(req.user?.sub);

    const userId = parseInt(id, 10);
    if (!userId) {
      throw new BadRequestException('Invalid user id');
    }

    const workspaceId = body.workspaceId;
    if (!workspaceId) {
      throw new BadRequestException('Workspace ID is required');
    }

    // Check if workspace exists
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
    });
    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    // For admins, check if they have access to this workspace
    if (!access.isSuperAdmin) {
      if (!access.adminWorkspaceIds.includes(workspaceId)) {
        throw new ForbiddenException(
          'You do not have admin access to this workspace',
        );
      }
    }

    // Validate role
    const validRoles = ['Admin', 'Lead', 'QA', 'admin', 'lead', 'qa'];
    const role = body.role || 'QA';
    if (!validRoles.includes(role)) {
      throw new BadRequestException(
        `Invalid role. Must be one of: ${validRoles.join(', ')}`,
      );
    }

    // Check if user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if membership already exists
    const existing = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId,
        },
      },
    });

    if (existing) {
      // Update existing membership
      const updated = await this.prisma.workspaceMember.update({
        where: { id: existing.id },
        data: { role: role.toLowerCase() === 'admin' ? 'Admin' : role },
        include: {
          workspace: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      });

      return {
        id: updated.id.toString(),
        workspaceId: updated.workspaceId.toString(),
        userId: updated.userId.toString(),
        role: updated.role,
        workspace: {
          id: updated.workspace.id.toString(),
          name: updated.workspace.name,
          slug: updated.workspace.slug,
        },
      };
    }

    // Create new membership
    const member = await this.prisma.workspaceMember.create({
      data: {
        workspaceId,
        userId,
        role: role.toLowerCase() === 'admin' ? 'Admin' : role,
      },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    return {
      id: member.id.toString(),
      workspaceId: member.workspaceId.toString(),
      userId: member.userId.toString(),
      role: member.role,
      workspace: {
        id: member.workspace.id.toString(),
        name: member.workspace.name,
        slug: member.workspace.slug,
      },
    };
  }

  /**
   * Remove user from workspace (superadmin and workspace admins)
   */
  @Delete(':id/workspaces/:workspaceId')
  async removeWorkspaceAccess(
    @Param('id') id: string,
    @Param('workspaceId') workspaceId: string,
    @Request() req: any,
  ) {
    const access = await this.checkUserManagementAccess(req.user?.sub);

    const userId = parseInt(id, 10);
    const wsId = parseInt(workspaceId, 10);
    if (!userId || !wsId) {
      throw new BadRequestException('Invalid user or workspace id');
    }

    // For admins, check if they have access to this workspace
    if (!access.isSuperAdmin) {
      if (!access.adminWorkspaceIds.includes(wsId)) {
        throw new ForbiddenException(
          'You do not have admin access to this workspace',
        );
      }
    }

    const membership = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: wsId,
          userId,
        },
      },
    });

    if (!membership) {
      throw new NotFoundException('Workspace membership not found');
    }

    await this.prisma.workspaceMember.delete({
      where: { id: membership.id },
    });

    return { message: 'User removed from workspace successfully' };
  }

  /**
   * Add user to project (superadmin and workspace admins)
   */
  @Post(':id/projects')
  async addProjectAccess(
    @Param('id') id: string,
    @Body() body: { projectId: number; role: string },
    @Request() req: any,
  ) {
    const access = await this.checkUserManagementAccess(req.user?.sub);

    const userId = parseInt(id, 10);
    if (!userId) {
      throw new BadRequestException('Invalid user id');
    }

    const projectId = body.projectId;
    if (!projectId) {
      throw new BadRequestException('Project ID is required');
    }

    // Check if project exists and get workspace
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // For admins, check if they have access to this workspace
    if (!access.isSuperAdmin) {
      if (!access.adminWorkspaceIds.includes(project.workspaceId)) {
        throw new ForbiddenException(
          'You do not have admin access to this workspace',
        );
      }
    }

    // Validate role
    const validRoles = ['Lead', 'QA', 'lead', 'qa'];
    const role = body.role || 'QA';
    if (!validRoles.includes(role)) {
      throw new BadRequestException(
        `Invalid role. Must be one of: ${validRoles.join(', ')}`,
      );
    }

    // Check if user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if role already exists
    const existing = await this.prisma.projectRole.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId,
        },
      },
    });

    if (existing) {
      // Update existing role
      const updated = await this.prisma.projectRole.update({
        where: { id: existing.id },
        data: { role: role.toLowerCase() === 'lead' ? 'Lead' : 'QA' },
        include: {
          project: {
            select: {
              id: true,
              name: true,
              key: true,
              workspaceId: true,
            },
          },
        },
      });

      return {
        id: updated.id.toString(),
        projectId: updated.projectId.toString(),
        userId: updated.userId.toString(),
        role: updated.role,
        project: {
          id: updated.project.id.toString(),
          name: updated.project.name,
          key: updated.project.key,
          workspaceId: updated.project.workspaceId.toString(),
        },
      };
    }

    // Create new role
    const projectRole = await this.prisma.projectRole.create({
      data: {
        projectId,
        userId,
        role: role.toLowerCase() === 'lead' ? 'Lead' : 'QA',
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            key: true,
            workspaceId: true,
          },
        },
      },
    });

    return {
      id: projectRole.id.toString(),
      projectId: projectRole.projectId.toString(),
      userId: projectRole.userId.toString(),
      role: projectRole.role,
      project: {
        id: projectRole.project.id.toString(),
        name: projectRole.project.name,
        key: projectRole.project.key,
        workspaceId: projectRole.project.workspaceId.toString(),
      },
    };
  }

  /**
   * Remove user from project (superadmin and workspace admins)
   */
  @Delete(':id/projects/:projectId')
  async removeProjectAccess(
    @Param('id') id: string,
    @Param('projectId') projectId: string,
    @Request() req: any,
  ) {
    const access = await this.checkUserManagementAccess(req.user?.sub);

    const userId = parseInt(id, 10);
    const projId = parseInt(projectId, 10);
    if (!userId || !projId) {
      throw new BadRequestException('Invalid user or project id');
    }

    // Get project to check workspace
    const project = await this.prisma.project.findUnique({
      where: { id: projId },
      select: { workspaceId: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // For admins, check if they have access to this workspace
    if (!access.isSuperAdmin) {
      if (!access.adminWorkspaceIds.includes(project.workspaceId)) {
        throw new ForbiddenException(
          'You do not have admin access to this workspace',
        );
      }
    }

    const projectRole = await this.prisma.projectRole.findUnique({
      where: {
        projectId_userId: {
          projectId: projId,
          userId,
        },
      },
    });

    if (!projectRole) {
      throw new NotFoundException('Project role not found');
    }

    await this.prisma.projectRole.delete({
      where: { id: projectRole.id },
    });

    return { message: 'User removed from project successfully' };
  }
}

