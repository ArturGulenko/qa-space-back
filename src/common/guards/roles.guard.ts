import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { PrismaService } from '../../prisma.service'

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector, private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext) {
    const roles = this.reflector.get<string[]>('roles', context.getHandler())
    if (!roles) return true

    const req = context.switchToHttp().getRequest()
    const user = req.user

    const workspaceId = parseInt(req.workspaceId || req.headers['x-workspace-id'] || req.params.id || req.params.workspaceId, 10)
    if (!workspaceId || !user?.sub) return false

    const member = await this.prisma.workspaceMember.findFirst({ where: { workspaceId, userId: user.sub } })
    if (!member) return false
    req.workspaceRole = member.role
    return roles.includes(member.role)
  }
}
