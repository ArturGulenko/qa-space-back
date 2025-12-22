import { Module } from '@nestjs/common'
import { SuitesController } from './suites.controller'
import { PrismaService } from '../prisma.service'
import { WorkspaceMemberGuard } from '../common/guards/workspace-member.guard'
import { RolesGuard } from '../common/guards/roles.guard'

@Module({
  controllers: [SuitesController],
  providers: [PrismaService, WorkspaceMemberGuard, RolesGuard],
})
export class SuitesModule {}

