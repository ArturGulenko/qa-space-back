import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { PrismaService } from '../../prisma.service'

@Injectable()
export class ProjectRolesGuard implements CanActivate {
  constructor(private reflector: Reflector, private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext) {
    const roles = this.reflector.get<string[]>('projectRoles', context.getHandler())
    if (!roles) return true

    const req = context.switchToHttp().getRequest()
    const user = req.user

    const projectId = parseInt(req.params.projectId || req.params.id)
    if (!projectId) return false

    const projectRole = await this.prisma.projectRole.findFirst({
      where: { projectId, userId: user.sub }
    })
    if (!projectRole) return false
    return roles.includes(projectRole.role)
  }
}

