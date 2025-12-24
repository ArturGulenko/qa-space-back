import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { PrismaService } from './prisma.service'
import { AuthModule } from './auth/auth.module'
import { WorkspacesModule } from './workspaces/workspaces.module'
import { ProjectsModule } from './projects/projects.module'
import { UsersModule } from './users/users.module'
import { SuitesModule } from './suites/suites.module'
import { TestCasesModule } from './test-cases/test-cases.module'
import { TestRunsModule } from './test-runs/test-runs.module'
import { AIModule } from './ai/ai.module'
import { DocsModule } from './docs/docs.module'
import { FileAssetsModule } from './file-assets/file-assets.module'
import { PermissionSetsModule } from './common/permissions/permission-sets.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    UsersModule,
    WorkspacesModule,
    ProjectsModule,
    SuitesModule,
    TestCasesModule,
    TestRunsModule,
    AIModule,
    DocsModule,
    FileAssetsModule,
    PermissionSetsModule,
  ],
  providers: [PrismaService]
})
export class AppModule {}
