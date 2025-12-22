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
    const projects = await this.prisma.project.findMany({ where: { workspaceId: parseInt(id) } })
    return projects.map((p) => ({
      id: p.id.toString(),
      workspaceId: p.workspaceId.toString(),
      key: p.key,
      name: p.name,
    }))
  }
}
