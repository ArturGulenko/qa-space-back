import { Module } from '@nestjs/common'
import { WorkspacesController } from './workspaces.controller'
import { PrismaService } from '../prisma.service'
import { WorkspaceMemberGuard } from '../common/guards/workspace-member.guard'
import { RolesGuard } from '../common/guards/roles.guard'

@Module({
  controllers: [WorkspacesController],
  providers: [PrismaService, WorkspaceMemberGuard, RolesGuard]
})
export class WorkspacesModule {}
