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
    const projectId = await this.getProjectId(req)
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

    // If no workspace/project context, check if user has any workspace membership
    // This is needed for endpoints like GET /workspaces where we need to verify
    // that user has access to at least one workspace
    if (!workspaceId && !projectId) {
      const hasWorkspaceMembership = await this.prisma.workspaceMember.findFirst({
        where: { userId },
        select: {
          id: true,
          role: true,
          workspaceId: true,
          customPermissions: true,
        },
      }) as any
      
      if (hasWorkspaceMembership) {
        // If user has workspace membership, return permissions for that role
        // This allows users to access workspace list endpoint
        if (hasWorkspaceMembership.customPermissions && hasWorkspaceMembership.customPermissions.length > 0) {
          return hasWorkspaceMembership.customPermissions as Permission[]
        }
        return await this.getPermissionsForWorkspaceRole(
          hasWorkspaceMembership.workspaceId,
          hasWorkspaceMembership.role,
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

  private async getProjectId(req: any): Promise<number | null> {
    // First, try to get projectId directly from params
    const directProjectId = parseInt(req.params.projectId, 10)
    if (directProjectId && !isNaN(directProjectId)) {
      return directProjectId
    }

    // Check the request path to determine if this is a test case or step route
    const path = req.url || req.path || ''
    const hasIdParam = req.params.id && !isNaN(parseInt(req.params.id, 10))

    // Check if this is a test case route (e.g., PATCH /test-cases/:id)
    if (hasIdParam && path.includes('/test-cases/')) {
      const testCaseId = parseInt(req.params.id, 10)
      const testCase = await this.prisma.testCase.findUnique({
        where: { id: testCaseId },
        select: { projectId: true },
      })
      if (testCase) {
        return testCase.projectId
      }
    }

    // Check if this is a step route (e.g., PATCH /steps/:id)
    if (hasIdParam && path.includes('/steps/') && !path.includes('/test-cases/')) {
      const stepId = parseInt(req.params.id, 10)
      const step = await this.prisma.testStep.findUnique({
        where: { id: stepId },
        select: { testCase: { select: { projectId: true } } },
      })
      if (step?.testCase) {
        return step.testCase.projectId
      }
    }

    // Fallback to treating req.params.id as projectId (for routes like /projects/:id)
    const fallbackProjectId = parseInt(req.params.id, 10)
    return fallbackProjectId && !isNaN(fallbackProjectId) ? fallbackProjectId : null
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

