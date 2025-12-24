import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../../prisma.service'
import { Permission } from './permissions.enum'
import { getPermissionsForRole } from './permission-sets'

@Injectable()
export class PermissionSetsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get permission set for a role in a workspace
   */
  async getPermissionSet(workspaceId: number, role: string): Promise<Permission[]> {
    const customSet = await (this.prisma as any).rolePermissionSet.findUnique({
      where: { workspaceId_role: { workspaceId, role } },
    })

    if (customSet && customSet.permissions.length > 0) {
      return customSet.permissions as Permission[]
    }

    return getPermissionsForRole(role)
  }

  /**
   * Create or update a custom permission set for a role in a workspace
   */
  async setPermissionSet(
    workspaceId: number,
    role: string,
    permissions: Permission[],
  ): Promise<void> {
    // Validate permissions
    const validPermissions = Object.values(Permission)
    const invalidPermissions = permissions.filter((p) => !validPermissions.includes(p))
    if (invalidPermissions.length > 0) {
      throw new BadRequestException(
        `Invalid permissions: ${invalidPermissions.join(', ')}`,
      )
    }

    await (this.prisma as any).rolePermissionSet.upsert({
      where: { workspaceId_role: { workspaceId, role } },
      update: { permissions: permissions as string[], isDefault: false },
      create: {
        workspaceId,
        role,
        permissions: permissions as string[],
        isDefault: false,
      },
    })
  }

  /**
   * Reset permission set to default for a role in a workspace
   */
  async resetPermissionSet(workspaceId: number, role: string): Promise<void> {
    await (this.prisma as any).rolePermissionSet.deleteMany({
      where: { workspaceId, role },
    })
  }

  /**
   * Get all custom permission sets for a workspace
   */
  async getWorkspacePermissionSets(workspaceId: number) {
    return (this.prisma as any).rolePermissionSet.findMany({
      where: { workspaceId },
      orderBy: { role: 'asc' },
    })
  }

  /**
   * Set custom permissions for a workspace member
   */
  async setMemberCustomPermissions(
    workspaceId: number,
    userId: number,
    permissions: Permission[],
  ): Promise<void> {
    // Validate permissions
    const validPermissions = Object.values(Permission)
    const invalidPermissions = permissions.filter((p) => !validPermissions.includes(p))
    if (invalidPermissions.length > 0) {
      throw new BadRequestException(
        `Invalid permissions: ${invalidPermissions.join(', ')}`,
      )
    }

    const member = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId, userId },
    })

    if (!member) {
      throw new NotFoundException('Workspace member not found')
    }

    await (this.prisma.workspaceMember.update as any)({
      where: { id: member.id },
      data: { customPermissions: permissions as string[] },
    })
  }

  /**
   * Clear custom permissions for a workspace member (use role default)
   */
  async clearMemberCustomPermissions(workspaceId: number, userId: number): Promise<void> {
    const member = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId, userId },
    })

    if (!member) {
      throw new NotFoundException('Workspace member not found')
    }

    await (this.prisma.workspaceMember.update as any)({
      where: { id: member.id },
      data: { customPermissions: [] },
    })
  }

  /**
   * Set custom permissions for a project role
   */
  async setProjectRoleCustomPermissions(
    projectId: number,
    userId: number,
    permissions: Permission[],
  ): Promise<void> {
    // Validate permissions
    const validPermissions = Object.values(Permission)
    const invalidPermissions = permissions.filter((p) => !validPermissions.includes(p))
    if (invalidPermissions.length > 0) {
      throw new BadRequestException(
        `Invalid permissions: ${invalidPermissions.join(', ')}`,
      )
    }

    const projectRole = await this.prisma.projectRole.findFirst({
      where: { projectId, userId },
    })

    if (!projectRole) {
      throw new NotFoundException('Project role not found')
    }

    await (this.prisma.projectRole.update as any)({
      where: { id: projectRole.id },
      data: { customPermissions: permissions as string[] },
    })
  }

  /**
   * Clear custom permissions for a project role (use role default)
   */
  async clearProjectRoleCustomPermissions(projectId: number, userId: number): Promise<void> {
    const projectRole = await this.prisma.projectRole.findFirst({
      where: { projectId, userId },
    })

    if (!projectRole) {
      throw new NotFoundException('Project role not found')
    }

    await (this.prisma.projectRole.update as any)({
      where: { id: projectRole.id },
      data: { customPermissions: [] },
    })
  }
}

