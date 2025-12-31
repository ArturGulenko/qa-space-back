import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common'
import { PrismaService } from '../../prisma.service'

@Injectable()
export class WorkspaceMemberGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest()
    const user = req.user
    if (!user?.sub) return false

    const headerWorkspace = req.headers['x-workspace-id']
    const paramWorkspace = req.params.id || req.params.workspaceId
    let workspaceId = parseInt(headerWorkspace || paramWorkspace, 10)

    // For /docs/:id endpoint, try to get workspaceId from document if header is not provided
    if (!workspaceId && req.url?.includes('/docs/') && req.params.id && req.method === 'GET') {
      const docId = parseInt(req.params.id, 10)
      if (docId && !isNaN(docId)) {
        const doc = await this.prisma.doc.findUnique({
          where: { id: docId },
          select: { workspaceId: true },
        })
        if (doc) {
          workspaceId = doc.workspaceId
        }
      }
    }

    if (headerWorkspace && paramWorkspace && parseInt(headerWorkspace, 10) !== parseInt(paramWorkspace, 10)) {
      return false
    }
    if (!workspaceId) return false

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
