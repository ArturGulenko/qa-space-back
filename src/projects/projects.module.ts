import { Module } from '@nestjs/common'
import { ProjectsController } from './projects.controller'
import { PrismaService } from '../prisma.service'
import { WorkspaceMemberGuard } from '../common/guards/workspace-member.guard'
import { ProjectRolesGuard } from '../common/guards/project-roles.guard'
import { PermissionsGuard } from '../common/guards/permissions.guard'

@Module({
  controllers: [ProjectsController],
  providers: [PrismaService, WorkspaceMemberGuard, ProjectRolesGuard, PermissionsGuard]
})
export class ProjectsModule {}
