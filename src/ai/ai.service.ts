import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common'
import { PrismaService } from '../prisma.service'
import { OpenAIProvider } from './providers/openai.provider'
import { GeminiProvider } from './providers/gemini.provider'
import { AIProvider } from './providers/ai-provider.interface'
import { GenerateTestCasesDto } from './dto/generate-test-cases.dto'
import { ImproveTestCaseDto } from './dto/improve-test-case.dto'
import { ImportFromTableDto } from './dto/import-from-table.dto'
import { ConfigService } from '@nestjs/config'
import * as XLSX from 'xlsx'

@Injectable()
export class AIService {
  private providers: Map<string, AIProvider>

  constructor(
    private prisma: PrismaService,
    private openaiProvider: OpenAIProvider,
    private geminiProvider: GeminiProvider,
    private configService: ConfigService,
  ) {
    this.providers = new Map()
    this.providers.set('openai', openaiProvider)
    this.providers.set('gemini', geminiProvider)
  }

  private getProvider(provider?: 'openai' | 'gemini'): AIProvider {
    const providerName = provider || 'gemini' // Default to Gemini
    const selectedProvider = this.providers.get(providerName)
    
    if (!selectedProvider) {
      // Fallback to available provider (try Gemini first, then OpenAI)
      const fallback = this.providers.get('gemini') || this.providers.get('openai')
      if (!fallback) {
        throw new BadRequestException(
          'No AI provider is available. Please configure GEMINI_API_KEY or OPENAI_API_KEY in environment variables.',
        )
      }
      return fallback
    }

    // Check if the selected provider has API key configured
    try {
      if (providerName === 'gemini') {
        const apiKey = this.configService.get<string>('GEMINI_API_KEY')
        if (!apiKey) {
          // Try fallback to OpenAI
          const openaiKey = this.configService.get<string>('OPENAI_API_KEY')
          if (openaiKey) {
            return this.providers.get('openai')!
          }
          throw new BadRequestException(
            'GEMINI_API_KEY is not configured. Please set GEMINI_API_KEY or OPENAI_API_KEY in environment variables.',
          )
        }
      } else if (providerName === 'openai') {
        const apiKey = this.configService.get<string>('OPENAI_API_KEY')
        if (!apiKey) {
          // Try fallback to Gemini
          const geminiKey = this.configService.get<string>('GEMINI_API_KEY')
          if (geminiKey) {
            return this.providers.get('gemini')!
          }
          throw new BadRequestException(
            'OPENAI_API_KEY is not configured. Please set OPENAI_API_KEY or GEMINI_API_KEY in environment variables.',
          )
        }
      }
    } catch (error) {
      // If it's already a BadRequestException, re-throw it
      if (error instanceof BadRequestException) {
        throw error
      }
    }

    return selectedProvider
  }

  async generateTestCases(
    projectId: number,
    workspaceId: number,
    dto: GenerateTestCasesDto,
  ) {
    // Get project context
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        testCases: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: { steps: { orderBy: { order: 'asc' } } },
        },
      },
    })

    if (!project || project.workspaceId !== workspaceId) {
      throw new BadRequestException('Project not found')
    }

    // Build context from existing test cases
    const existingTestCases = project.testCases.map((tc) => ({
      title: tc.title,
      steps: tc.steps.map((s) => ({ action: s.action, expected: s.expected })),
      tags: tc.tags,
      priority: tc.priority,
    }))

    // Extract unique tags and priorities from project
    const projectTags = Array.from(
      new Set(project.testCases.flatMap((tc) => tc.tags)),
    )
    const projectPriorities = Array.from(
      new Set(project.testCases.map((tc) => tc.priority)),
    )

    try {
      const provider = this.getProvider(dto.provider)
      const generated = await provider.generateTestCases(
        dto.description,
        {
          existingTestCases: existingTestCases.slice(0, 5), // Limit context
          projectTags,
          projectPriorities,
        },
        dto.count || 3,
      )

      return generated
    } catch (error) {
      // Re-throw BadRequestException as-is
      if (error instanceof BadRequestException) {
        throw error
      }
      // Wrap other errors
      throw new InternalServerErrorException(
        `Failed to generate test cases: ${error.message || 'Unknown error'}`,
      )
    }
  }

  async improveTestCase(
    testCaseId: number,
    workspaceId: number,
    dto: ImproveTestCaseDto,
  ) {
    const testCase = await this.prisma.testCase.findUnique({
      where: { id: testCaseId },
      include: { steps: { orderBy: { order: 'asc' } } },
    })

    if (!testCase || testCase.workspaceId !== workspaceId) {
      throw new BadRequestException('Test case not found')
    }

    const provider = this.getProvider(dto.provider)
    const improved = await provider.improveTestCase(
      {
        title: testCase.title,
        steps: testCase.steps.map((s) => ({
          action: s.action,
          expected: s.expected,
        })),
        priority: testCase.priority,
        tags: testCase.tags,
      },
      dto.improvements,
    )

    return improved
  }

  async importFromTable(
    projectId: number,
    workspaceId: number,
    file: Express.Multer.File,
    dto: ImportFromTableDto,
  ) {
    // Verify project
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    })

    if (!project || project.workspaceId !== workspaceId) {
      throw new BadRequestException('Project not found')
    }

    // Parse file
    let tableData: Array<Record<string, any>>

    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
        file.mimetype === 'application/vnd.ms-excel' ||
        file.originalname.endsWith('.xlsx') ||
        file.originalname.endsWith('.xls')) {
      // Excel file
      const workbook = XLSX.read(file.buffer, { type: 'buffer' })
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      tableData = XLSX.utils.sheet_to_json(worksheet)
    } else if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      // CSV file
      const csvText = file.buffer.toString('utf-8')
      const lines = csvText.split('\n')
      const headers = lines[0].split(',').map((h) => h.trim())
      tableData = lines.slice(1).map((line) => {
        const values = line.split(',').map((v) => v.trim())
        const row: Record<string, any> = {}
        headers.forEach((header, index) => {
          row[header] = values[index] || ''
        })
        return row
      }).filter((row) => Object.values(row).some((v) => v && v.toString().trim()))
    } else {
      throw new BadRequestException('Unsupported file format. Use Excel (.xlsx, .xls) or CSV (.csv)')
    }

    if (tableData.length === 0) {
      throw new BadRequestException('No data found in file')
    }

    // Use AI to parse and normalize
    const provider = this.getProvider(dto.provider)
    const parsed = await provider.parseTableData(tableData, dto.mapping)

    return parsed
  }
}

