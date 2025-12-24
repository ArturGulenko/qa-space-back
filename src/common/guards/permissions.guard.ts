import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { PrismaService } from '../../prisma.service'
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator'
import { Permission } from '../permissions/permissions.enum'
import { getPermissionsForRole } from '../permissions/permission-sets'

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.get<Permission[]>(
      PERMISSIONS_KEY,
      context.getHandler(),
    )

    // If no permissions required, allow access
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true
    }

    const req = context.switchToHttp().getRequest()
    const user = req.user

    if (!user?.sub) {
      throw new ForbiddenException('User not authenticated')
    }

    // Check if user is superadmin - superadmin has all permissions
    const isSuperAdmin = await this.isSuperAdmin(user.sub)
    if (isSuperAdmin) {
      return true
    }

    // Get user permissions based on workspace or project role
    const userPermissions = await this.getUserPermissions(req, user.sub)

    // Check if user has all required permissions
    const hasAllPermissions = requiredPermissions.every((permission) =>
      userPermissions.includes(permission),
    )

    if (!hasAllPermissions) {
      throw new ForbiddenException(
        `Missing required permissions: ${requiredPermissions.join(', ')}`,
      )
    }

    return true
  }

  /**
   * Get user permissions based on workspace or project context
   */
  private async getUserPermissions(req: any, userId: number): Promise<Permission[]> {
    // Try to get permissions from workspace context
    const workspaceId = this.getWorkspaceId(req)
    if (workspaceId) {
      const workspaceMember = await this.prisma.workspaceMember.findFirst({
        where: { workspaceId, userId },
        select: {
          id: true,
          role: true,
          customPermissions: true,
        },
      }) as any
      if (workspaceMember) {
        // Check for custom permissions override
        if (workspaceMember.customPermissions && workspaceMember.customPermissions.length > 0) {
          return workspaceMember.customPermissions as Permission[]
        }
        // Get permissions from role permission set or default
        return await this.getPermissionsForWorkspaceRole(workspaceId, workspaceMember.role)
      }
    }

    // Try to get permissions from project context
    const projectId = this.getProjectId(req)
    if (projectId) {
      const projectRole = await this.prisma.projectRole.findFirst({
        where: { projectId, userId },
        select: {
          id: true,
          role: true,
          customPermissions: true,
          project: {
            select: {
              id: true,
              workspaceId: true,
            },
          },
        },
      }) as any
      if (projectRole) {
        // Check workspace membership as well
        if (workspaceId && projectRole.project.workspaceId !== workspaceId) {
          return []
        }
        // Check for custom permissions override
        if (projectRole.customPermissions && projectRole.customPermissions.length > 0) {
          return projectRole.customPermissions as Permission[]
        }
        // Get permissions from workspace role permission set or default
        return await this.getPermissionsForWorkspaceRole(
          projectRole.project.workspaceId,
          projectRole.role,
        )
      }
    }

    // No permissions found
    return []
  }

  /**
   * Get permissions for a role in a workspace
   * First checks for custom permission set in database, then falls back to default
   */
  private async getPermissionsForWorkspaceRole(
    workspaceId: number,
    role: string,
  ): Promise<Permission[]> {
    // Try to get custom permission set from database
    const customSet = await (this.prisma as any).rolePermissionSet.findUnique({
      where: { workspaceId_role: { workspaceId, role } },
    })

    if (customSet && customSet.permissions.length > 0) {
      return customSet.permissions as Permission[]
    }

    // Fall back to default permission set
    return getPermissionsForRole(role)
  }

  private getWorkspaceId(req: any): number | null {
    const headerWorkspace = req.headers['x-workspace-id']
    const paramWorkspace = req.params.id || req.params.workspaceId
    const workspaceId = parseInt(headerWorkspace || paramWorkspace, 10)
    return workspaceId && !isNaN(workspaceId) ? workspaceId : null
  }

  private getProjectId(req: any): number | null {
    const projectId = parseInt(req.params.projectId || req.params.id, 10)
    return projectId && !isNaN(projectId) ? projectId : null
  }

  /**
   * Check if user is superadmin
   * Superadmin is identified by isSuperAdmin flag in User table
   * Superadmin manages the entire system and all workspaces
   */
  private async isSuperAdmin(userId: number): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isSuperAdmin: true },
    })
    return user?.isSuperAdmin ?? false
  }
}

