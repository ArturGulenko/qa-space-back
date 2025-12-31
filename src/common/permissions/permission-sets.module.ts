import { Module } from '@nestjs/common'
import { PermissionSetsService } from './permission-sets.service'
import { PermissionSetsController } from './permission-sets.controller'
import { PrismaService } from '../../prisma.service'

@Module({
  providers: [PermissionSetsService, PrismaService],
  controllers: [PermissionSetsController],
  exports: [PermissionSetsService],
})
export class PermissionSetsModule {}










