import { Module } from '@nestjs/common'
import { TestRunsController } from './test-runs.controller'
import { PrismaService } from '../prisma.service'
import { WorkspaceMemberGuard } from '../common/guards/workspace-member.guard'
import { RolesGuard } from '../common/guards/roles.guard'
import { ProjectRolesGuard } from '../common/guards/project-roles.guard'

@Module({
  controllers: [TestRunsController],
  providers: [PrismaService, WorkspaceMemberGuard, RolesGuard, ProjectRolesGuard],
})
export class TestRunsModule {}














