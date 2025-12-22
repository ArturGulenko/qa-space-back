import { Module } from '@nestjs/common'
import { TestCasesController } from './test-cases.controller'
import { PrismaService } from '../prisma.service'
import { WorkspaceMemberGuard } from '../common/guards/workspace-member.guard'
import { RolesGuard } from '../common/guards/roles.guard'
import { ProjectRolesGuard } from '../common/guards/project-roles.guard'

@Module({
  controllers: [TestCasesController],
  providers: [PrismaService, WorkspaceMemberGuard, RolesGuard, ProjectRolesGuard],
})
export class TestCasesModule {}

