import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { PrismaService } from './prisma.service'
import { AuthModule } from './auth/auth.module'
import { WorkspacesModule } from './workspaces/workspaces.module'
import { ProjectsModule } from './projects/projects.module'
import { UsersModule } from './users/users.module'

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), AuthModule, UsersModule, WorkspacesModule, ProjectsModule],
  providers: [PrismaService]
})
export class AppModule {}
