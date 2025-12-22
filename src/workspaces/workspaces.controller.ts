import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common'
import { PrismaService } from '../prisma.service'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { WorkspaceMemberGuard } from '../common/guards/workspace-member.guard'
import { Roles } from '../common/decorators/roles.decorator'
import { RolesGuard } from '../common/guards/roles.guard'

@Controller('workspaces')
@UseGuards(JwtAuthGuard)
export class WorkspacesController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async list(@Request() req: any) {
    const userId = req.user?.sub
    const memberships = await this.prisma.workspaceMember.findMany({ where: { userId }, include: { workspace: true } })
    return memberships.map((m) => ({ 
      id: m.workspace.id.toString(), 
      slug: m.workspace.slug, 
      name: m.workspace.name, 
      role: m.role 
    }))
  }

  @Post()
  async create(@Body() body: { name: string; slug: string }, @Request() req: any) {
    const userId = req.user?.sub
    const ws = await this.prisma.workspace.create({ data: { name: body.name, slug: body.slug } })
    await this.prisma.workspaceMember.create({ data: { workspaceId: ws.id, userId, role: 'owner' } })
    return ws
  }

  @Get(':id/projects')
  @UseGuards(WorkspaceMemberGuard)
  async projects(@Param('id') id: string) {
    const projects = await this.prisma.project.findMany({ where: { workspaceId: parseInt(id) } })
    return projects.map((p) => ({
      id: p.id.toString(),
      workspaceId: p.workspaceId.toString(),
      key: p.key,
      name: p.name,
    }))
  }

  @Post(':id/projects')
  @UseGuards(WorkspaceMemberGuard, RolesGuard)
  @Roles('owner', 'admin')
  async createProject(@Param('id') workspaceId: string, @Body() body: { key: string; name: string }, @Request() req: any) {
    const project = await this.prisma.project.create({
      data: { key: body.key, name: body.name, workspaceId: parseInt(workspaceId) }
    })
    // Grant creator admin role in project
    await this.prisma.projectRole.upsert({
      where: { projectId_userId: { projectId: project.id, userId: req.user.sub } },
      update: { role: 'admin' },
      create: { projectId: project.id, userId: req.user.sub, role: 'admin' }
    })
    return {
      id: project.id.toString(),
      workspaceId: project.workspaceId.toString(),
      key: project.key,
      name: project.name,
    }
  }
}
