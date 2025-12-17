import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common'
import { PrismaService } from '../../prisma.service'

@Injectable()
export class WorkspaceMemberGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest()
    const user = req.user
    const workspaceId = parseInt(req.params.id || req.params.workspaceId)
    if (!workspaceId) return false
    const member = await this.prisma.workspaceMember.findFirst({ where: { workspaceId, userId: user.sub } })
    return !!member
  }
}
