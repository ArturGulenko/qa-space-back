import { Module } from '@nestjs/common'
import { PostmanController } from './postman.controller'
import { PostmanService } from './postman.service'
import { PrismaService } from '../prisma.service'
import { WorkspaceMemberGuard } from '../common/guards/workspace-member.guard'
import { PermissionsGuard } from '../common/guards/permissions.guard'

@Module({
  controllers: [PostmanController],
  providers: [PostmanService, PrismaService, WorkspaceMemberGuard, PermissionsGuard],
  exports: [PostmanService],
})
export class PostmanModule {}






