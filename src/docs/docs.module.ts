import { Module } from '@nestjs/common'
import { DocsController } from './docs.controller'
import { DocsService } from './docs.service'
import { PrismaService } from '../prisma.service'
import { WorkspaceMemberGuard } from '../common/guards/workspace-member.guard'
import { RolesGuard } from '../common/guards/roles.guard'
import { ProjectRolesGuard } from '../common/guards/project-roles.guard'

@Module({
  controllers: [DocsController],
  providers: [DocsService, PrismaService, WorkspaceMemberGuard, RolesGuard, ProjectRolesGuard],
  exports: [DocsService],
})
export class DocsModule {}
