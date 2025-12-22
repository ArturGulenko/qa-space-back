import { Module } from '@nestjs/common'
import { AIController } from './ai.controller'
import { AIService } from './ai.service'
import { OpenAIProvider } from './providers/openai.provider'
import { GeminiProvider } from './providers/gemini.provider'
import { PrismaService } from '../prisma.service'
import { WorkspaceMemberGuard } from '../common/guards/workspace-member.guard'
import { RolesGuard } from '../common/guards/roles.guard'
import { ProjectRolesGuard } from '../common/guards/project-roles.guard'

@Module({
  controllers: [AIController],
  providers: [
    AIService,
    OpenAIProvider,
    GeminiProvider,
    PrismaService,
    WorkspaceMemberGuard,
    RolesGuard,
    ProjectRolesGuard,
  ],
  exports: [AIService],
})
export class AIModule {}




