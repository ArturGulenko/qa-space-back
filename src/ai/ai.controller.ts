import {
  BadRequestException,
  Body,
  Controller,
  NotFoundException,
  Param,
  Post,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { PrismaService } from '../prisma.service'
import { AIService } from './ai.service'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { WorkspaceMemberGuard } from '../common/guards/workspace-member.guard'
import { RolesGuard } from '../common/guards/roles.guard'
import { Roles } from '../common/decorators/roles.decorator'
import { GenerateTestCasesDto } from './dto/generate-test-cases.dto'
import { ImproveTestCaseDto } from './dto/improve-test-case.dto'
import { ImportFromTableDto } from './dto/import-from-table.dto'
import { requireProjectAccess } from '../common/utils/project-access'

@Controller()
@UseGuards(JwtAuthGuard)
export class AIController {
  constructor(
    private aiService: AIService,
    private prisma: PrismaService,
  ) {}

  @Post('projects/:id/ai/generate')
  @UseGuards(WorkspaceMemberGuard, RolesGuard)
  @Roles('owner', 'admin')
  async generateTestCases(
    @Param('id') id: string,
    @Body() dto: GenerateTestCasesDto,
    @Request() req: any,
  ) {
    const projectId = parseInt(id, 10)
    if (!projectId) throw new BadRequestException('Invalid project id')
    if (!dto.description) throw new BadRequestException('Description is required')
    await requireProjectAccess(this.prisma, projectId, req.user.sub, req.workspaceId)

    try {
      const generated = await this.aiService.generateTestCases(
        projectId,
        req.workspaceId,
        dto,
      )

      return {
        testCases: generated,
        count: generated.length,
      }
    } catch (error) {
      // Handle specific AI provider errors
      if (error.message?.includes('API_KEY is not configured')) {
        throw new BadRequestException(
          'AI service is not configured. Please set GEMINI_API_KEY or OPENAI_API_KEY in environment variables.',
        )
      }
      if (error.message?.includes('Failed to parse')) {
        throw new BadRequestException(
          'Failed to parse AI response. Please try again or contact support.',
        )
      }
      // Re-throw other errors (they will be handled by NestJS exception filter)
      throw error
    }
  }

  @Post('test-cases/:id/ai/improve')
  @UseGuards(WorkspaceMemberGuard, RolesGuard)
  @Roles('owner', 'admin')
  async improveTestCase(
    @Param('id') id: string,
    @Body() dto: ImproveTestCaseDto,
    @Request() req: any,
  ) {
    const testCaseId = parseInt(id, 10)
    if (!testCaseId) throw new BadRequestException('Invalid test case id')

    const testCase = await this.prisma.testCase.findUnique({ where: { id: testCaseId } })
    if (!testCase || testCase.workspaceId !== req.workspaceId) {
      throw new NotFoundException('Test case not found')
    }
    await requireProjectAccess(this.prisma, testCase.projectId, req.user.sub, req.workspaceId)

    const improved = await this.aiService.improveTestCase(
      testCaseId,
      req.workspaceId,
      dto,
    )

    return improved
  }

  @Post('projects/:id/ai/import')
  @UseGuards(WorkspaceMemberGuard, RolesGuard)
  @Roles('owner', 'admin')
  @UseInterceptors(FileInterceptor('file'))
  async importFromTable(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: ImportFromTableDto,
    @Request() req: any,
  ) {
    const projectId = parseInt(id, 10)
    if (!projectId) throw new BadRequestException('Invalid project id')
    if (!file) throw new BadRequestException('File is required')
    await requireProjectAccess(this.prisma, projectId, req.user.sub, req.workspaceId)

    const parsed = await this.aiService.importFromTable(
      projectId,
      req.workspaceId,
      file,
      dto,
    )

    return {
      testCases: parsed,
      count: parsed.length,
    }
  }

  @Post('projects/:id/ai/import-and-create')
  @UseGuards(WorkspaceMemberGuard, RolesGuard)
  @Roles('owner', 'admin')
  @UseInterceptors(FileInterceptor('file'))
  async importAndCreate(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { suiteId?: number; provider?: 'openai' | 'gemini' },
    @Request() req: any,
  ) {
    const projectId = parseInt(id, 10)
    if (!projectId) throw new BadRequestException('Invalid project id')
    if (!file) throw new BadRequestException('File is required')
    await requireProjectAccess(this.prisma, projectId, req.user.sub, req.workspaceId)

    // Parse file
    const dto: ImportFromTableDto = { provider: body.provider }
    const parsed = await this.aiService.importFromTable(
      projectId,
      req.workspaceId,
      file,
      dto,
    )

    // Get project for key generation
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    })
    if (!project || project.workspaceId !== req.workspaceId) {
      throw new BadRequestException('Project not found')
    }

    // Create test cases
    const created = []
    const baseIndex = await this.prisma.testCase.count({ where: { projectId } })

    for (let i = 0; i < parsed.length; i++) {
      const tc = parsed[i]
      const nextIndex = baseIndex + i + 1
      const key = `${project.key}-TC-${nextIndex.toString().padStart(5, '0')}`

      const testCase = await this.prisma.testCase.create({
        data: {
          key,
          title: tc.title,
          projectId,
          workspaceId: project.workspaceId,
          suiteId: body.suiteId ?? null,
          priority: tc.priority || 'medium',
          status: tc.status || 'draft',
          tags: tc.tags || [],
          steps: tc.steps
            ? {
                create: tc.steps.map((s, idx) => ({
                  order: idx + 1,
                  action: s.action,
                  expected: s.expected,
                })),
              }
            : undefined,
        },
        include: { steps: { orderBy: { order: 'asc' } } },
      })

      created.push(testCase)
    }

    return {
      created: created.length,
      testCases: created.map((tc) => ({
        id: tc.id.toString(),
        key: tc.key,
        title: tc.title,
        status: tc.status,
        priority: tc.priority,
        tags: tc.tags,
        steps: tc.steps.map((s) => ({
          id: s.id,
          order: s.order,
          action: s.action,
          expected: s.expected,
        })),
      })),
    }
  }
}
