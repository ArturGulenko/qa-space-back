import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai'
import {
  AIProvider,
  GeneratedTestCase,
  ImprovedTestCase,
  ParsedTableRow,
} from './ai-provider.interface'

@Injectable()
export class GeminiProvider implements AIProvider {
  private genAI: GoogleGenAI | null = null
  private readonly modelName: string

  constructor(private configService: ConfigService) {
    this.modelName =
      this.configService.get<string>('GEMINI_MODEL')?.trim() ||
      'gemini-2.0-flash-exp'
  }

  private getClient(): GoogleGenAI {
    if (!this.genAI) {
      const apiKey = this.configService.get<string>('GEMINI_API_KEY')
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY is not configured')
      }
      this.genAI = new GoogleGenAI({ apiKey })
    }
    return this.genAI
  }

  async generateTestCases(
    description: string,
    context?: {
      existingTestCases?: Array<{
        title: string
        steps: Array<{ action: string; expected: string }>
        tags: string[]
        priority: string
      }>
      projectTags?: string[]
      projectPriorities?: string[]
    },
    count: number = 3,
  ): Promise<GeneratedTestCase[]> {
    const systemPrompt = this.buildGenerateSystemPrompt(context)
    const userPrompt = `Generate ${count} test cases based on the following description:\n\n${description}`

    const raw = await this.callGemini({
      systemPrompt,
      userPrompt,
      schema: {
        type: Type.OBJECT,
        required: ['testCases'],
        properties: {
          testCases: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              required: ['title', 'steps', 'priority', 'tags', 'status'],
              properties: {
                title: { type: Type.STRING },
                steps: {
                  type: Type.ARRAY,
                  minItems: 2,
                  items: {
                    type: Type.OBJECT,
                    required: ['action', 'expected'],
                    properties: {
                      action: { type: Type.STRING },
                      expected: { type: Type.STRING },
                    },
                  },
                },
                priority: { type: Type.STRING },
                tags: { type: Type.ARRAY, items: { type: Type.STRING } },
                status: { type: Type.STRING },
              },
            },
          },
        },
      },
    })

    return Array.isArray(raw.testCases) ? raw.testCases : [raw.testCases]
  }

  async improveTestCase(
    testCase: {
      title: string
      steps: Array<{ action: string; expected: string }>
      priority: string
      tags: string[]
    },
    improvements?: Array<'steps' | 'clarity' | 'completeness' | 'edge-cases'>,
  ): Promise<ImprovedTestCase> {
    const systemPrompt = this.buildImproveSystemPrompt(improvements)
    const userPrompt = `Improve the following test case:\n\n${JSON.stringify(testCase, null, 2)}`

    return this.callGemini({
      systemPrompt,
      userPrompt,
      schema: {
        type: Type.OBJECT,
        required: ['steps', 'tags', 'suggestions'],
        properties: {
          title: { type: Type.STRING },
          steps: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              required: ['action', 'expected'],
              properties: {
                action: { type: Type.STRING },
                expected: { type: Type.STRING },
              },
            },
          },
          priority: { type: Type.STRING },
          tags: { type: Type.ARRAY, items: { type: Type.STRING } },
          suggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
      },
    })
  }

  async parseTableData(
    tableData: Array<Record<string, any>>,
    mapping?: {
      titleColumn?: string
      stepsColumn?: string
      priorityColumn?: string
      tagsColumn?: string
      statusColumn?: string
    },
  ): Promise<ParsedTableRow[]> {
    const systemPrompt = this.buildParseTableSystemPrompt(mapping)
    const userPrompt = `Parse the following table data into test cases:\n\n${JSON.stringify(tableData, null, 2)}`

    const parsed = await this.callGemini({
      systemPrompt,
      userPrompt,
      schema: {
        type: Type.OBJECT,
        required: ['testCases'],
        properties: {
          testCases: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              required: ['title', 'steps'],
              properties: {
                title: { type: Type.STRING },
                steps: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    required: ['action', 'expected'],
                    properties: {
                      action: { type: Type.STRING },
                      expected: { type: Type.STRING },
                    },
                  },
                },
                priority: { type: Type.STRING },
                tags: { type: Type.ARRAY, items: { type: Type.STRING } },
                status: { type: Type.STRING },
              },
            },
          },
        },
      },
    })

    return Array.isArray(parsed.testCases) ? parsed.testCases : [parsed.testCases]
  }

  private buildGenerateSystemPrompt(context?: {
    existingTestCases?: Array<any>
    projectTags?: string[]
    projectPriorities?: string[]
  }): string {
    let prompt = `You are a QA expert. Generate test cases in JSON format with the following structure:
{
  "testCases": [
    {
      "title": "string - clear, concise test case title",
      "steps": [
        {
          "action": "string - what to do",
          "expected": "string - expected result"
        }
      ],
      "priority": "low" | "medium" | "high",
      "tags": ["string array"],
      "status": "draft"
    }
  ]
}

Requirements:
- Each test case must have at least 2 steps
- Steps must be clear and actionable
- Priority should be based on business impact
- Tags should be relevant and consistent`

    if (context?.existingTestCases && context.existingTestCases.length > 0) {
      prompt += `\n\nExisting test cases style:\n${JSON.stringify(context.existingTestCases.slice(0, 3), null, 2)}`
    }

    if (context?.projectTags && context.projectTags.length > 0) {
      prompt += `\n\nAvailable project tags: ${context.projectTags.join(', ')}`
    }

    if (context?.projectPriorities && context.projectPriorities.length > 0) {
      prompt += `\n\nAvailable priorities: ${context.projectPriorities.join(', ')}`
    }

    return prompt
  }

  private buildImproveSystemPrompt(
    improvements?: Array<'steps' | 'clarity' | 'completeness' | 'edge-cases'>,
  ): string {
    let prompt = `You are a QA expert. Improve test cases. Return JSON in this format:
{
  "title": "improved title (optional, only if needed)",
  "steps": [{"action": "...", "expected": "..."}],
  "priority": "low|medium|high (optional, only if should change)",
  "tags": ["tag1", "tag2"],
  "suggestions": ["suggestion1", "suggestion2"]
}

Focus on:`

    if (!improvements || improvements.length === 0) {
      prompt += ' clarity, completeness, and actionable steps'
    } else {
      if (improvements.includes('steps')) prompt += '\n- Making steps more detailed and actionable'
      if (improvements.includes('clarity')) prompt += '\n- Improving clarity of descriptions'
      if (improvements.includes('completeness')) prompt += '\n- Adding missing steps or edge cases'
      if (improvements.includes('edge-cases')) prompt += '\n- Adding edge case scenarios'
    }

    return prompt
  }

  private buildParseTableSystemPrompt(mapping?: {
    titleColumn?: string
    stepsColumn?: string
    priorityColumn?: string
    tagsColumn?: string
    statusColumn?: string
  }): string {
    let prompt = `You are a QA expert. Parse table data into test cases. Return JSON:
{
  "testCases": [
    {
      "title": "string",
      "steps": [{"action": "...", "expected": "..."}],
      "priority": "low|medium|high (optional)",
      "tags": ["tag1"] (optional),
      "status": "draft|inReview|approved (optional)"
    }
  ]
}

Column mapping:`

    if (mapping) {
      if (mapping.titleColumn) prompt += `\n- Title: ${mapping.titleColumn}`
      if (mapping.stepsColumn) prompt += `\n- Steps: ${mapping.stepsColumn}`
      if (mapping.priorityColumn) prompt += `\n- Priority: ${mapping.priorityColumn}`
      if (mapping.tagsColumn) prompt += `\n- Tags: ${mapping.tagsColumn}`
      if (mapping.statusColumn) prompt += `\n- Status: ${mapping.statusColumn}`
    } else {
      prompt += '\n- Auto-detect columns (look for title, steps, priority, tags, status)'
    }

    prompt += '\n\nIf steps are in a single cell, parse them into separate action/expected pairs.'

    return prompt
  }

  private async callGemini({
    systemPrompt,
    userPrompt,
    schema,
  }: {
    systemPrompt: string
    userPrompt: string
    schema: any
  }) {
    try {
      const ai = this.getClient()

      const response = await ai.models.generateContent({
        model: this.modelName,
        contents: [
          {
            role: 'user',
            parts: [{ text: userPrompt }],
          },
        ],
        config: {
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.HIGH,
          },
          responseMimeType: 'application/json',
          responseSchema: schema,
          systemInstruction: [{ text: systemPrompt }],
        },
      })

      const text = response.text || ''
      const cleaned = this.cleanJson(text)
      return JSON.parse(cleaned)
    } catch (error: any) {
      if (error.message?.includes('API_KEY is not configured')) {
        throw error
      }

      const { message, code } = this.normalizeError(error)

      if (code === 404) {
        throw new Error(
          'Gemini model not found. The model may not be available in your region or API version. Please check GEMINI_MODEL or try a different one.',
        )
      }

      if (code === 429) {
        throw new Error(
          'Gemini API quota exceeded. Please retry later or upgrade your plan.',
        )
      }

      throw new Error(`Gemini API error: ${message}`)
    }
  }

  private cleanJson(text: string): string {
    const trimmed = text.trim()
    if (trimmed.startsWith('```')) {
      return trimmed.replace(/```(json)?/g, '').trim()
    }
    return trimmed
  }

  private normalizeError(error: any): { message: string; code?: number } {
    let message = error?.message || error?.toString?.() || 'Unknown error'
    let code: number | undefined = error?.code || error?.status

    if (typeof message === 'string' && message.includes('{')) {
      try {
        const json = JSON.parse(message)
        if (json.error) {
          message = json.error.message || message
          code = json.error.code || json.error.status || code
        }
      } catch {
        // ignore parse failure
      }
    }

    if (
      message.includes('NOT_FOUND') ||
      message.includes('is not found') ||
      message.includes('404')
    ) {
      code = code || 404
    }

    if (
      message.includes('quota') ||
      message.includes('RESOURCE_EXHAUSTED') ||
      message.includes('429')
    ) {
      code = 429
    }

    return { message, code }
  }
}
