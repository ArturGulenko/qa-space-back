import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common'
import { PrismaService } from '../../prisma.service'

@Injectable()
export class WorkspaceMemberGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest()
    const user = req.user
    const headerWorkspace = req.headers['x-workspace-id']
    const paramWorkspace = req.params.id || req.params.workspaceId
    const workspaceId = parseInt(headerWorkspace || paramWorkspace, 10)
    if (headerWorkspace && paramWorkspace && parseInt(headerWorkspace, 10) !== parseInt(paramWorkspace, 10)) {
      return false
    }
    if (!workspaceId || !user?.sub) return false

    // Check if user is superadmin - superadmin has access to all workspaces
    const userRecord = await this.prisma.user.findUnique({
      where: { id: user.sub },
      select: { isSuperAdmin: true },
    })
    if (userRecord?.isSuperAdmin) {
      req.workspaceId = workspaceId
      req.workspaceRole = 'superadmin'
      return true
    }

    const member = await this.prisma.workspaceMember.findFirst({ where: { workspaceId, userId: user.sub } })
    if (member) {
      req.workspaceId = workspaceId
      req.workspaceRole = member.role
      return true
    }
    return false
  }
}
