import { Module } from '@nestjs/common'
import { FileAssetsController } from './file-assets.controller'
import { FileAssetsService } from './file-assets.service'
import { PrismaService } from '../prisma.service'
import { WorkspaceMemberGuard } from '../common/guards/workspace-member.guard'
import { RolesGuard } from '../common/guards/roles.guard'
import { ProjectRolesGuard } from '../common/guards/project-roles.guard'
import { ConfigModule } from '@nestjs/config'

@Module({
  imports: [ConfigModule],
  controllers: [FileAssetsController],
  providers: [FileAssetsService, PrismaService, WorkspaceMemberGuard, RolesGuard, ProjectRolesGuard],
  exports: [FileAssetsService],
})
export class FileAssetsModule {}
