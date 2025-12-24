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
} from '@nestjs/common'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { WorkspaceMemberGuard } from '../../common/guards/workspace-member.guard'
import { PermissionsGuard } from '../../common/guards/permissions.guard'
import { RequirePermissions } from '../../common/decorators/permissions.decorator'
import { Permission } from './permissions.enum'
import { PermissionSetsService } from './permission-sets.service'

@Controller('workspaces/:workspaceId/permission-sets')
@UseGuards(JwtAuthGuard, WorkspaceMemberGuard)
export class PermissionSetsController {
  constructor(private permissionSetsService: PermissionSetsService) {}

  /**
   * Get all permission sets for a workspace
   */
  @Get()
  @UseGuards(PermissionsGuard)
  @RequirePermissions(Permission.WORKSPACE_MANAGE_SETTINGS)
  async getPermissionSets(@Param('workspaceId') workspaceId: string) {
    const id = parseInt(workspaceId, 10)
    return this.permissionSetsService.getWorkspacePermissionSets(id)
  }

  /**
   * Get permission set for a specific role
   */
  @Get(':role')
  @UseGuards(PermissionsGuard)
  @RequirePermissions(Permission.WORKSPACE_MANAGE_SETTINGS)
  async getPermissionSet(
    @Param('workspaceId') workspaceId: string,
    @Param('role') role: string,
  ) {
    const id = parseInt(workspaceId, 10)
    const permissions = await this.permissionSetsService.getPermissionSet(id, role)
    return { role, permissions }
  }

  /**
   * Set custom permission set for a role
   */
  @Post(':role')
  @UseGuards(PermissionsGuard)
  @RequirePermissions(Permission.WORKSPACE_MANAGE_SETTINGS)
  async setPermissionSet(
    @Param('workspaceId') workspaceId: string,
    @Param('role') role: string,
    @Body() body: { permissions: Permission[] },
  ) {
    const id = parseInt(workspaceId, 10)
    await this.permissionSetsService.setPermissionSet(id, role, body.permissions)
    return { success: true }
  }

  /**
   * Reset permission set to default
   */
  @Delete(':role')
  @UseGuards(PermissionsGuard)
  @RequirePermissions(Permission.WORKSPACE_MANAGE_SETTINGS)
  async resetPermissionSet(
    @Param('workspaceId') workspaceId: string,
    @Param('role') role: string,
  ) {
    const id = parseInt(workspaceId, 10)
    await this.permissionSetsService.resetPermissionSet(id, role)
    return { success: true }
  }

  /**
   * Set custom permissions for a workspace member
   */
  @Post('members/:userId/custom')
  @UseGuards(PermissionsGuard)
  @RequirePermissions(Permission.WORKSPACE_MANAGE_MEMBERS)
  async setMemberCustomPermissions(
    @Param('workspaceId') workspaceId: string,
    @Param('userId') userId: string,
    @Body() body: { permissions: Permission[] },
  ) {
    const wsId = parseInt(workspaceId, 10)
    const uId = parseInt(userId, 10)
    await this.permissionSetsService.setMemberCustomPermissions(wsId, uId, body.permissions)
    return { success: true }
  }

  /**
   * Clear custom permissions for a workspace member
   */
  @Delete('members/:userId/custom')
  @UseGuards(PermissionsGuard)
  @RequirePermissions(Permission.WORKSPACE_MANAGE_MEMBERS)
  async clearMemberCustomPermissions(
    @Param('workspaceId') workspaceId: string,
    @Param('userId') userId: string,
  ) {
    const wsId = parseInt(workspaceId, 10)
    const uId = parseInt(userId, 10)
    await this.permissionSetsService.clearMemberCustomPermissions(wsId, uId)
    return { success: true }
  }

  /**
   * Set custom permissions for a project role
   */
  @Post('projects/:projectId/roles/:userId/custom')
  @UseGuards(PermissionsGuard)
  @RequirePermissions(Permission.PROJECT_MANAGE_MEMBERS)
  async setProjectRoleCustomPermissions(
    @Param('projectId') projectId: string,
    @Param('userId') userId: string,
    @Body() body: { permissions: Permission[] },
  ) {
    const pId = parseInt(projectId, 10)
    const uId = parseInt(userId, 10)
    await this.permissionSetsService.setProjectRoleCustomPermissions(pId, uId, body.permissions)
    return { success: true }
  }

  /**
   * Clear custom permissions for a project role
   */
  @Delete('projects/:projectId/roles/:userId/custom')
  @UseGuards(PermissionsGuard)
  @RequirePermissions(Permission.PROJECT_MANAGE_MEMBERS)
  async clearProjectRoleCustomPermissions(
    @Param('projectId') projectId: string,
    @Param('userId') userId: string,
  ) {
    const pId = parseInt(projectId, 10)
    const uId = parseInt(userId, 10)
    await this.permissionSetsService.clearProjectRoleCustomPermissions(pId, uId)
    return { success: true }
  }
}

