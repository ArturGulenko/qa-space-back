import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common'
import { PrismaService } from '../prisma.service'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { WorkspaceMemberGuard } from '../common/guards/workspace-member.guard'
import { PermissionsGuard } from '../common/guards/permissions.guard'
import { RequirePermissions } from '../common/decorators/permissions.decorator'
import { Permission } from '../common/permissions/permissions.enum'
import { requireProjectAccess } from '../common/utils/project-access'

@Controller()
@UseGuards(JwtAuthGuard)
export class TestCasesController {
  constructor(private prisma: PrismaService) {}

  @Get('projects/:id/test-cases')
  @UseGuards(WorkspaceMemberGuard, PermissionsGuard)
  @RequirePermissions(Permission.TEST_CASE_VIEW)
  async list(
    @Param('id') id: string,
    @Request() req: any,
    @Query('query') search?: string,
    @Query('suiteId') suiteId?: string,
    @Query('tag') tag?: string,
    @Query('priority') priority?: string,
    @Query('status') status?: string,
  ) {
    const projectId = parseInt(id, 10)
    if (!projectId) throw new BadRequestException('Invalid project id')
    await requireProjectAccess(this.prisma, projectId, req.user.sub, req.workspaceId)

    const where: any = { projectId }
    if (suiteId) where.suiteId = parseInt(suiteId, 10)
    if (priority) where.priority = priority
    if (status) where.status = status
    if (tag) where.tags = { has: tag }
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { key: { contains: search, mode: 'insensitive' } },
      ]
    }

    const cases = await this.prisma.testCase.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      include: { steps: { orderBy: { order: 'asc' } } },
    })
    return cases.map((c) => this.mapTestCase(c))
  }

  @Post('projects/:id/test-cases')
  @UseGuards(WorkspaceMemberGuard, PermissionsGuard)
  @RequirePermissions(Permission.TEST_CASE_CREATE)
  async create(
    @Param('id') id: string,
    @Body()
    body: {
      title: string
      suiteId?: number
      priority?: string
      status?: string
      tags?: string[]
      steps?: { order?: number; action: string; expected: string }[]
    },
    @Request() req: any,
  ) {
    const projectId = parseInt(id, 10)
    if (!projectId) throw new BadRequestException('Invalid project id')
    if (!body?.title) throw new BadRequestException('Title is required')

    const project = await this.prisma.project.findUnique({ where: { id: projectId } })
    if (!project || project.workspaceId !== req.workspaceId) throw new NotFoundException()
    await requireProjectAccess(this.prisma, projectId, req.user.sub, req.workspaceId)

    const nextIndex = await this.prisma.testCase.count({ where: { projectId } }) + 1
    const key = `${project.key}-TC-${nextIndex.toString().padStart(5, '0')}`

    const testCase = await this.prisma.testCase.create({
      data: {
        key,
        title: body.title,
        projectId,
        workspaceId: project.workspaceId,
        suiteId: body.suiteId ?? null,
        priority: body.priority ?? 'medium',
        status: body.status ?? 'draft',
        tags: body.tags ?? [],
        steps: body.steps
          ? { create: body.steps.map((s, idx) => ({ order: s.order ?? idx + 1, action: s.action, expected: s.expected })) }
          : undefined,
      },
      include: { steps: { orderBy: { order: 'asc' } } },
    })
    return this.mapTestCase(testCase)
  }

  @Get('test-cases/:id')
  @UseGuards(WorkspaceMemberGuard, PermissionsGuard)
  @RequirePermissions(Permission.TEST_CASE_VIEW)
  async getById(@Param('id') id: string, @Request() req: any) {
    const testCase = await this.loadCase(parseInt(id, 10), req.workspaceId, req.user.sub)
    return this.mapTestCase(testCase)
  }

  @Patch('test-cases/:id')
  @UseGuards(WorkspaceMemberGuard, PermissionsGuard)
  @RequirePermissions(Permission.TEST_CASE_UPDATE)
  async update(
    @Param('id') id: string,
    @Body()
    body: {
      title?: string
      suiteId?: number | null
      priority?: string
      status?: string
      tags?: string[]
    },
    @Request() req: any,
  ) {
    const caseId = parseInt(id, 10)
    const existing = await this.loadCase(caseId, req.workspaceId, req.user.sub)

    const updated = await this.prisma.testCase.update({
      where: { id: caseId },
      data: {
        title: body.title ?? existing.title,
        suiteId: body.suiteId !== undefined ? body.suiteId : existing.suiteId,
        priority: body.priority ?? existing.priority,
        status: body.status ?? existing.status,
        tags: body.tags ?? existing.tags,
        version: existing.version + 1,
      },
      include: { steps: { orderBy: { order: 'asc' } } },
    })
    return this.mapTestCase(updated)
  }

  @Delete('test-cases/:id')
  @UseGuards(WorkspaceMemberGuard, PermissionsGuard)
  @RequirePermissions(Permission.TEST_CASE_DELETE)
  async remove(@Param('id') id: string, @Request() req: any) {
    const caseId = parseInt(id, 10)
    await this.loadCase(caseId, req.workspaceId, req.user.sub)
    await this.prisma.testStep.deleteMany({ where: { testCaseId: caseId } })
    await this.prisma.testCase.delete({ where: { id: caseId } })
    return { deleted: true }
  }

  @Post('test-cases/:id/steps')
  @UseGuards(WorkspaceMemberGuard, PermissionsGuard)
  @RequirePermissions(Permission.TEST_CASE_UPDATE)
  async addStep(
    @Param('id') id: string,
    @Body() body: { action: string; expected: string; order?: number },
    @Request() req: any,
  ) {
    const caseId = parseInt(id, 10)
    await this.loadCase(caseId, req.workspaceId, req.user.sub)
    if (!body?.action || !body?.expected) throw new BadRequestException('Action and expected are required')

    const step = await this.prisma.testStep.create({
      data: {
        action: body.action,
        expected: body.expected,
        order:
          body.order ??
          (await this.prisma.testStep.count({
            where: { testCaseId: caseId },
          })) +
            1,
        testCaseId: caseId,
      },
    })
    return step
  }

  @Patch('steps/:id')
  @UseGuards(WorkspaceMemberGuard, PermissionsGuard)
  @RequirePermissions(Permission.TEST_CASE_UPDATE)
  async updateStep(@Param('id') id: string, @Body() body: { action?: string; expected?: string; order?: number }, @Request() req: any) {
    const stepId = parseInt(id, 10)
    const step = await this.prisma.testStep.findUnique({
      where: { id: stepId },
      include: { testCase: true },
    })
    if (!step || step.testCase.workspaceId !== req.workspaceId) throw new NotFoundException()
    await requireProjectAccess(this.prisma, step.testCase.projectId, req.user.sub, req.workspaceId)

    const updated = await this.prisma.testStep.update({
      where: { id: stepId },
      data: {
        action: body.action ?? step.action,
        expected: body.expected ?? step.expected,
        order: body.order ?? step.order,
      },
    })
    return updated
  }

  @Delete('steps/:id')
  @UseGuards(WorkspaceMemberGuard, PermissionsGuard)
  @RequirePermissions(Permission.TEST_CASE_UPDATE)
  async deleteStep(@Param('id') id: string, @Request() req: any) {
    const stepId = parseInt(id, 10)
    const step = await this.prisma.testStep.findUnique({
      where: { id: stepId },
      include: { testCase: true },
    })
    if (!step || step.testCase.workspaceId !== req.workspaceId) throw new NotFoundException()
    await requireProjectAccess(this.prisma, step.testCase.projectId, req.user.sub, req.workspaceId)
    await this.prisma.testStep.delete({ where: { id: stepId } })
    return { deleted: true }
  }

  private async loadCase(id: number, workspaceId: number, userId: number) {
    if (!id) throw new BadRequestException('Invalid test case id')
    const testCase = await this.prisma.testCase.findUnique({
      where: { id },
      include: { steps: { orderBy: { order: 'asc' } } },
    })
    if (!testCase || testCase.workspaceId !== workspaceId) {
      throw new NotFoundException()
    }
    await requireProjectAccess(this.prisma, testCase.projectId, userId, workspaceId)
    return testCase
  }

  private mapTestCase(c: any) {
    return {
      id: c.id.toString(),
      key: c.key,
      title: c.title,
      status: c.status,
      priority: c.priority,
      tags: c.tags,
      version: c.version,
      projectId: c.projectId.toString(),
      workspaceId: c.workspaceId.toString(),
      suiteId: c.suiteId?.toString(),
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      steps: c.steps?.map((s: any) => ({
        id: s.id,
        order: s.order,
        action: s.action,
        expected: s.expected,
      })),
    }
  }
}
