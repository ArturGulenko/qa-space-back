import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common'
import { PrismaService } from '../prisma.service'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { WorkspaceMemberGuard } from '../common/guards/workspace-member.guard'
import { PermissionsGuard } from '../common/guards/permissions.guard'
import { RequirePermissions } from '../common/decorators/permissions.decorator'
import { Permission } from '../common/permissions/permissions.enum'

@Controller()
@UseGuards(JwtAuthGuard)
export class TestRunsController {
  constructor(private prisma: PrismaService) {}

  @Post('projects/:id/test-runs')
  @UseGuards(WorkspaceMemberGuard, PermissionsGuard)
  @RequirePermissions(Permission.TEST_RUN_CREATE)
  async create(
    @Param('id') id: string,
    @Body()
    body: {
      build: string
      env: string
      platform: string
      suiteIds?: number[]
      testCaseIds?: number[]
    },
    @Request() req: any,
  ) {
    try {
      const projectId = parseInt(id, 10)
      if (!projectId) throw new BadRequestException('Invalid project id')
      if (!body?.build || !body?.env || !body?.platform) {
        throw new BadRequestException('Build, env, and platform are required')
      }

      if (!req.user?.userId) {
        throw new BadRequestException('User ID is missing from request')
      }

      const project = await this.prisma.project.findUnique({ where: { id: projectId } })
      if (!project || project.workspaceId !== req.workspaceId) throw new NotFoundException()

      // Get test cases to include in the run
      let testCaseIds: number[] = []
      if (body.testCaseIds && body.testCaseIds.length > 0) {
        testCaseIds = body.testCaseIds
      } else if (body.suiteIds && body.suiteIds.length > 0) {
        // Get all test cases from the specified suites (including nested suites)
        const suiteIds = body.suiteIds
        const allSuiteIds = await this.getAllNestedSuiteIds(suiteIds, projectId)
        const cases = await this.prisma.testCase.findMany({
          where: {
            projectId,
            workspaceId: req.workspaceId,
            suiteId: { in: allSuiteIds },
          },
        })
        testCaseIds = cases.map((c) => c.id)
      } else {
        throw new BadRequestException('Either suiteIds or testCaseIds must be provided')
      }

      if (testCaseIds.length === 0) {
        throw new BadRequestException('No test cases found to include in the run')
      }

      // Load test cases to snapshot their data
      const testCases = await this.prisma.testCase.findMany({
        where: {
          id: { in: testCaseIds },
          projectId,
          workspaceId: req.workspaceId,
        },
      })

      if (testCases.length === 0) {
        throw new BadRequestException('Test cases not found or do not belong to this project')
      }

      // Create test run with items
      const testRun = await this.prisma.testRun.create({
        data: {
          projectId,
          workspaceId: req.workspaceId,
          build: body.build,
          env: body.env,
          platform: body.platform,
          createdById: req.user.userId,
          items: {
            create: testCases.map((tc) => ({
              testCaseId: tc.id,
              snapshotTitle: tc.title,
              snapshotPriority: tc.priority,
            })),
          },
        },
        include: {
          items: {
            include: {
              testCase: {
                include: { steps: { orderBy: { order: 'asc' } } },
              },
              executedBy: {
                select: { id: true, email: true, name: true },
              },
              attachments: true,
            },
          },
          createdBy: {
            select: { id: true, email: true, name: true },
          },
        },
      })

      return this.mapTestRun(testRun)
    } catch (error: any) {
      console.error('Error creating test run:', error)
      // Re-throw known exceptions
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error
      }
      // Log and wrap unknown errors
      console.error('Unexpected error details:', {
        message: error?.message,
        stack: error?.stack,
        code: error?.code,
        meta: error?.meta,
      })
      throw new BadRequestException(
        error?.message || 'Failed to create test run. Please check the server logs for details.',
      )
    }
  }

  @Get('projects/:id/test-runs')
  @UseGuards(WorkspaceMemberGuard, PermissionsGuard)
  @RequirePermissions(Permission.TEST_RUN_VIEW)
  async list(@Param('id') id: string, @Request() req: any) {
    const projectId = parseInt(id, 10)
    if (!projectId) throw new BadRequestException('Invalid project id')

    const project = await this.prisma.project.findUnique({ where: { id: projectId } })
    if (!project || project.workspaceId !== req.workspaceId) throw new NotFoundException()

    const runs = await this.prisma.testRun.findMany({
      where: {
        projectId,
        workspaceId: req.workspaceId,
      },
      include: {
        createdBy: {
          select: { id: true, email: true, name: true },
        },
        items: {
          include: {
            testCase: {
              select: { id: true, key: true, title: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return runs.map((run) => this.mapTestRunSummary(run))
  }

  @Get('test-runs/:id')
  @UseGuards(WorkspaceMemberGuard, PermissionsGuard)
  @RequirePermissions(Permission.TEST_RUN_VIEW)
  async getById(@Param('id') id: string, @Request() req: any) {
    const runId = parseInt(id, 10)
    if (!runId) throw new BadRequestException('Invalid test run id')

    const testRun = await this.prisma.testRun.findUnique({
      where: { id: runId },
      include: {
        items: {
          include: {
            testCase: {
              include: { steps: { orderBy: { order: 'asc' } } },
            },
            executedBy: {
              select: { id: true, email: true, name: true },
            },
            attachments: true,
          },
          orderBy: { id: 'asc' },
        },
        createdBy: {
          select: { id: true, email: true, name: true },
        },
      },
    })

    if (!testRun || testRun.workspaceId !== req.workspaceId) {
      throw new NotFoundException()
    }

    return this.mapTestRun(testRun)
  }

  @Patch('test-run-items/:id')
  @UseGuards(WorkspaceMemberGuard, PermissionsGuard)
  @RequirePermissions(Permission.TEST_RUN_EXECUTE)
  async updateItem(
    @Param('id') id: string,
    @Body()
    body: {
      result?: string // pass, fail, blocked, skipped
      comments?: string
    },
    @Request() req: any,
  ) {
    const itemId = parseInt(id, 10)
    if (!itemId) throw new BadRequestException('Invalid test run item id')

    const item = await this.prisma.testRunItem.findUnique({
      where: { id: itemId },
      include: {
        testRun: true,
      },
    })

    if (!item || item.testRun.workspaceId !== req.workspaceId) {
      throw new NotFoundException()
    }

    const updateData: any = {}
    if (body.result !== undefined) {
      const validResults = ['pass', 'fail', 'blocked', 'skipped']
      if (!validResults.includes(body.result)) {
        throw new BadRequestException(`Result must be one of: ${validResults.join(', ')}`)
      }
      updateData.result = body.result
      updateData.executedById = req.user.userId
      updateData.executedAt = new Date()
    }
    if (body.comments !== undefined) {
      updateData.comments = body.comments
    }

    const updated = await this.prisma.testRunItem.update({
      where: { id: itemId },
      data: updateData,
      include: {
        testCase: {
          include: { steps: { orderBy: { order: 'asc' } } },
        },
        executedBy: {
          select: { id: true, email: true, name: true },
        },
        attachments: true,
      },
    })

    return this.mapTestRunItem(updated)
  }

  private async getAllNestedSuiteIds(suiteIds: number[], projectId: number): Promise<number[]> {
    const allIds = new Set<number>(suiteIds)
    let currentIds = [...suiteIds]

    while (currentIds.length > 0) {
      const children = await this.prisma.suite.findMany({
        where: {
          projectId,
          parentId: { in: currentIds },
        },
        select: { id: true },
      })
      const newIds = children.map((s) => s.id).filter((id) => !allIds.has(id))
      newIds.forEach((id) => allIds.add(id))
      currentIds = newIds
    }

    return Array.from(allIds)
  }

  private mapTestRun(run: any) {
    const items = run.items || []
    const total = items.length
    const passed = items.filter((i: any) => i.result === 'pass').length
    const failed = items.filter((i: any) => i.result === 'fail').length
    const blocked = items.filter((i: any) => i.result === 'blocked').length
    const skipped = items.filter((i: any) => i.result === 'skipped').length
    const notExecuted = items.filter((i: any) => !i.result).length

    return {
      id: run.id.toString(),
      projectId: run.projectId.toString(),
      workspaceId: run.workspaceId.toString(),
      build: run.build,
      env: run.env,
      platform: run.platform,
      createdBy: run.createdBy
        ? {
            id: run.createdBy.id.toString(),
            email: run.createdBy.email,
            name: run.createdBy.name,
          }
        : null,
      createdAt: run.createdAt,
      updatedAt: run.updatedAt,
      summary: {
        total,
        passed,
        failed,
        blocked,
        skipped,
        notExecuted,
        passRate: total > 0 ? ((passed / total) * 100).toFixed(1) : '0.0',
      },
      items: items.map((item: any) => this.mapTestRunItem(item)),
    }
  }

  private mapTestRunSummary(run: any) {
    const items = run.items || []
    const total = items.length
    const passed = items.filter((i: any) => i.result === 'pass').length
    const failed = items.filter((i: any) => i.result === 'fail').length

    return {
      id: run.id.toString(),
      projectId: run.projectId.toString(),
      workspaceId: run.workspaceId.toString(),
      build: run.build,
      env: run.env,
      platform: run.platform,
      createdBy: run.createdBy
        ? {
            id: run.createdBy.id.toString(),
            email: run.createdBy.email,
            name: run.createdBy.name,
          }
        : null,
      createdAt: run.createdAt,
      updatedAt: run.updatedAt,
      summary: {
        total,
        passed,
        failed,
        passRate: total > 0 ? ((passed / total) * 100).toFixed(1) : '0.0',
      },
    }
  }

  private mapTestRunItem(item: any) {
    return {
      id: item.id.toString(),
      testRunId: item.testRunId.toString(),
      testCaseId: item.testCaseId.toString(),
      snapshotTitle: item.snapshotTitle,
      snapshotPriority: item.snapshotPriority,
      result: item.result,
      executedBy: item.executedBy
        ? {
            id: item.executedBy.id.toString(),
            email: item.executedBy.email,
            name: item.executedBy.name,
          }
        : null,
      executedAt: item.executedAt,
      comments: item.comments,
      attachments: (item.attachments || []).map((att: any) => ({
        id: att.id.toString(),
        fileUrl: att.fileUrl,
        fileName: att.fileName,
        fileSize: att.fileSize,
        mimeType: att.mimeType,
        uploadedBy: {
          id: att.uploadedBy.id.toString(),
          email: att.uploadedBy.email,
          name: att.uploadedBy.name,
        },
        uploadedAt: att.uploadedAt,
      })),
      testCase: item.testCase
        ? {
            id: item.testCase.id.toString(),
            key: item.testCase.key,
            title: item.testCase.title,
            steps: (item.testCase.steps || []).map((s: any) => ({
              id: s.id,
              order: s.order,
              action: s.action,
              expected: s.expected,
            })),
          }
        : null,
    }
  }
}





