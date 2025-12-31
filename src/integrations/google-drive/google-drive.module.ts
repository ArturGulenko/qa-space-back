import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { GoogleDriveController } from './google-drive.controller'
import { GoogleDrivePublicController } from './google-drive.public.controller'
import { GoogleDriveService } from './google-drive.service'
import { PrismaService } from '../../prisma.service'
import { DocsModule } from '../../docs/docs.module'
import { WorkspaceMemberGuard } from '../../common/guards/workspace-member.guard'
import { PermissionsGuard } from '../../common/guards/permissions.guard'

@Module({
  imports: [
    ConfigModule,
    DocsModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_ACCESS_SECRET'),
        signOptions: { expiresIn: config.get('JWT_ACCESS_EXPIRES_IN') || '15m' }
      }),
      inject: [ConfigService]
    }),
  ],
  controllers: [GoogleDriveController, GoogleDrivePublicController],
  providers: [GoogleDriveService, PrismaService, WorkspaceMemberGuard, PermissionsGuard],
})
export class GoogleDriveModule {}
