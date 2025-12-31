import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Param,
  Request,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { WorkspaceMemberGuard } from '../common/guards/workspace-member.guard'
import { PermissionsGuard } from '../common/guards/permissions.guard'
import { RequirePermissions } from '../common/decorators/permissions.decorator'
import { Permission } from '../common/permissions/permissions.enum'
import { requireProjectAccess } from '../common/utils/project-access'
import { PostmanService } from './postman.service'
import { PrismaService } from '../prisma.service'
import { UploadCollectionDto } from './dto/upload-collection.dto'
import { ExecuteCollectionDto } from './dto/execute-collection.dto'

@Controller()
@UseGuards(JwtAuthGuard)
export class PostmanController {
  constructor(
    private postmanService: PostmanService,
    private prisma: PrismaService,
  ) {}

  @Post('projects/:projectId/postman/collections/upload')
  @UseGuards(WorkspaceMemberGuard, PermissionsGuard)
  @RequirePermissions(Permission.TEST_RUN_CREATE)
  @UseInterceptors(FileInterceptor('file'))
  async uploadCollection(
    @Param('projectId') projectId: string,
    @Body() dto: UploadCollectionDto,
    @UploadedFile() file: Express.Multer.File,
    @Request() req: any,
  ) {
    const pid = parseInt(projectId, 10)
    if (!pid) throw new BadRequestException('Invalid project id')
    if (!file) throw new BadRequestException('Collection file is required')

    await requireProjectAccess(this.prisma, pid, req.user.sub, req.workspaceId)

    try {
      const collectionJson = JSON.parse(file.buffer.toString('utf-8'))
      const collection = await this.postmanService.parseCollection(collectionJson)
      const collectionId = await this.postmanService.saveCollection(
        req.workspaceId,
        pid,
        collection,
        dto.collectionName,
        req.user.userId,
      )

      return {
        id: collectionId,
        name: collection.info.name,
        message: 'Collection uploaded successfully',
      }
    } catch (error: any) {
      throw new BadRequestException(`Failed to upload collection: ${error.message}`)
    }
  }

  @Post('projects/:projectId/postman/environments/upload')
  @UseGuards(WorkspaceMemberGuard, PermissionsGuard)
  @RequirePermissions(Permission.TEST_RUN_CREATE)
  @UseInterceptors(FileInterceptor('file'))
  async uploadEnvironment(
    @Param('projectId') projectId: string,
    @Body() dto: UploadCollectionDto,
    @UploadedFile() file: Express.Multer.File,
    @Request() req: any,
  ) {
    const pid = parseInt(projectId, 10)
    if (!pid) throw new BadRequestException('Invalid project id')
    if (!file) throw new BadRequestException('Environment file is required')

    await requireProjectAccess(this.prisma, pid, req.user.sub, req.workspaceId)

    try {
      const environmentJson = JSON.parse(file.buffer.toString('utf-8'))
      const environment = await this.postmanService.parseEnvironment(environmentJson)
      const environmentId = await this.postmanService.saveEnvironment(
        req.workspaceId,
        pid,
        environment,
        dto.environmentName,
        req.user.userId,
      )

      return {
        id: environmentId,
        name: environment.name,
        message: 'Environment uploaded successfully',
      }
    } catch (error: any) {
      throw new BadRequestException(`Failed to upload environment: ${error.message}`)
    }
  }

  @Post('projects/:projectId/postman/execute')
  @UseGuards(WorkspaceMemberGuard, PermissionsGuard)
  @RequirePermissions(Permission.TEST_RUN_EXECUTE)
  @UseInterceptors(FileInterceptor('collection'))
  async executeCollection(
    @Param('projectId') projectId: string,
    @Request() req: any,
    @Body() dto: ExecuteCollectionDto,
    @UploadedFile() collectionFile?: Express.Multer.File,
  ) {
    const pid = parseInt(projectId, 10)
    if (!pid) throw new BadRequestException('Invalid project id')

    await requireProjectAccess(this.prisma, pid, req.user.sub, req.workspaceId)

    let collection: any
    let environment: any | undefined

    // Load collection
    if (collectionFile) {
      collection = JSON.parse(collectionFile.buffer.toString('utf-8'))
    } else if (dto.collectionId) {
      collection = await this.postmanService.loadCollection(dto.collectionId)
    } else {
      throw new BadRequestException('Either collection file or collectionId must be provided')
    }

    const parsedCollection = await this.postmanService.parseCollection(collection)

    // Load environment if provided
    if (dto.environmentId) {
      const envData = await this.postmanService.loadEnvironment(dto.environmentId)
      environment = await this.postmanService.parseEnvironment(envData)
    }

    // Execute collection
    const executionSummary = await this.postmanService.executeCollection(parsedCollection, environment)

    // Create or update test run
    let testRun
    if (dto.testRunId) {
      // Update existing test run
      testRun = await this.prisma.testRun.findUnique({
        where: { id: dto.testRunId },
      })
      if (!testRun || testRun.workspaceId !== req.workspaceId) {
        throw new BadRequestException('Test run not found')
      }
    } else {
      // Create new test run
      testRun = await this.prisma.testRun.create({
        data: {
          projectId: pid,
          workspaceId: req.workspaceId,
          build: dto.build || 'postman-execution',
          env: dto.env || 'postman',
          platform: dto.platform || 'api',
          createdById: req.user.userId,
        },
      })
    }

    // Create or find test cases from Postman requests and create test run items
    const testRunItems = []
    for (const result of executionSummary.results) {
      // Find or create test case
      let testCase = await this.prisma.testCase.findFirst({
        where: {
          projectId: pid,
          workspaceId: req.workspaceId,
          title: result.requestName,
        },
      })

      if (!testCase) {
        // Create test case from Postman request
        const nextIndex = (await this.prisma.testCase.count({ where: { projectId: pid } })) + 1
        const project = await this.prisma.project.findUnique({ where: { id: pid } })
        const key = project ? `${project.key}-TC-${nextIndex.toString().padStart(5, '0')}` : `TC-${nextIndex}`

        testCase = await this.prisma.testCase.create({
          data: {
            key,
            title: result.requestName,
            projectId: pid,
            workspaceId: req.workspaceId,
            priority: 'medium',
            status: 'active',
            tags: ['postman', 'api'],
            steps: {
              create: [
                {
                  order: 1,
                  action: `${result.requestMethod} ${result.requestUrl}`,
                  expected: `Status code: ${result.statusCode || 'N/A'}`,
                },
              ],
            },
          },
        })
      }

      // Create test run item
      const testRunItem = await this.prisma.testRunItem.create({
        data: {
          testRunId: testRun.id,
          testCaseId: testCase.id,
          snapshotTitle: testCase.title,
          snapshotPriority: testCase.priority,
          result: result.success ? 'pass' : 'fail',
          executedById: req.user.userId,
          executedAt: new Date(),
          comments: result.error
            ? `Error: ${result.error}`
            : `Status: ${result.statusCode}, Time: ${result.responseTime}ms`,
        },
      })

      testRunItems.push(testRunItem)
    }

    return {
      testRunId: testRun.id,
      executionSummary: {
        ...executionSummary,
        testRunItemsCreated: testRunItems.length,
      },
      message: 'Collection executed successfully',
    }
  }

  @Get('projects/:projectId/postman/collections')
  @UseGuards(WorkspaceMemberGuard, PermissionsGuard)
  @RequirePermissions(Permission.TEST_RUN_VIEW)
  async listCollections(@Param('projectId') projectId: string, @Request() req: any) {
    const pid = parseInt(projectId, 10)
    if (!pid) throw new BadRequestException('Invalid project id')

    await requireProjectAccess(this.prisma, pid, req.user.sub, req.workspaceId)

    const collections = await this.prisma.fileAsset.findMany({
      where: {
        projectId: pid,
        workspaceId: req.workspaceId,
        bucket: 'postman-collections',
      },
      orderBy: { uploadedAt: 'desc' },
      select: {
        id: true,
        fileName: true,
        sizeBytes: true,
        uploadedAt: true,
        uploadedBy: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    })

    return collections.map((c) => ({
      id: c.id,
      name: c.fileName?.replace('.postman_collection.json', '') || 'Untitled',
      sizeBytes: c.sizeBytes,
      uploadedAt: c.uploadedAt,
      uploadedBy: c.uploadedBy,
    }))
  }

  @Get('projects/:projectId/postman/environments')
  @UseGuards(WorkspaceMemberGuard, PermissionsGuard)
  @RequirePermissions(Permission.TEST_RUN_VIEW)
  async listEnvironments(@Param('projectId') projectId: string, @Request() req: any) {
    const pid = parseInt(projectId, 10)
    if (!pid) throw new BadRequestException('Invalid project id')

    await requireProjectAccess(this.prisma, pid, req.user.sub, req.workspaceId)

    const environments = await this.prisma.fileAsset.findMany({
      where: {
        projectId: pid,
        workspaceId: req.workspaceId,
        bucket: 'postman-environments',
      },
      orderBy: { uploadedAt: 'desc' },
      select: {
        id: true,
        fileName: true,
        sizeBytes: true,
        uploadedAt: true,
        uploadedBy: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    })

    return environments.map((e) => ({
      id: e.id,
      name: e.fileName?.replace('.postman_environment.json', '') || 'Untitled',
      sizeBytes: e.sizeBytes,
      uploadedAt: e.uploadedAt,
      uploadedBy: e.uploadedBy,
    }))
  }
}

