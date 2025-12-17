import { Controller, Get, Param, UseGuards } from '@nestjs/common'
import { PrismaService } from '../prisma.service'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { WorkspaceMemberGuard } from '../common/guards/workspace-member.guard'

@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(private prisma: PrismaService) {}

  @Get('workspace/:id')
  @UseGuards(WorkspaceMemberGuard)
  async listByWorkspace(@Param('id') id: string) {
    return this.prisma.project.findMany({ where: { workspaceId: parseInt(id) } })
  }
}
