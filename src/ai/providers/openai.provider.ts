import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import OpenAI from 'openai'
import { AIProvider, GeneratedTestCase, ImprovedTestCase, ParsedTableRow } from './ai-provider.interface'

@Injectable()
export class OpenAIProvider implements AIProvider {
  private client: OpenAI | null = null

  constructor(private configService: ConfigService) {}

  private getClient(): OpenAI {
    if (!this.client) {
      const apiKey = this.configService.get<string>('OPENAI_API_KEY')
      if (!apiKey) {
        throw new Error('OPENAI_API_KEY is not configured')
      }
      this.client = new OpenAI({ apiKey })
    }
    return this.client
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
    try {
      const systemPrompt = this.buildGenerateSystemPrompt(context)
      const userPrompt = `Generate ${count} test cases based on the following description:\n\n${description}`

      const response = await this.getClient().chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'test_cases',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                testCases: {
                  type: 'array',
                  description: 'Array of generated test cases',
                  items: {
                    type: 'object',
                    properties: {
                      title: {
                        type: 'string',
                        description: 'Clear, concise test case title',
                        minLength: 1,
                      },
                      steps: {
                        type: 'array',
                        description: 'List of test steps',
                        minItems: 2,
                        items: {
                          type: 'object',
                          properties: {
                            action: {
                              type: 'string',
                              description: 'What to do in this step',
                            },
                            expected: {
                              type: 'string',
                              description: 'Expected result after performing the action',
                            },
                          },
                          required: ['action', 'expected'],
                          additionalProperties: false,
                        },
                      },
                      priority: {
                        type: 'string',
                        description: 'Priority based on business impact',
                        enum: ['low', 'medium', 'high'],
                      },
                      tags: {
                        type: 'array',
                        description: 'Relevant and consistent tags',
                        items: {
                          type: 'string',
                          minLength: 1,
                        },
                      },
                      status: {
                        type: 'string',
                        description: 'Test case status',
                        enum: ['draft', 'inReview', 'approved'],
                      },
                    },
                    required: ['title', 'steps', 'priority', 'tags', 'status'],
                    additionalProperties: false,
                  },
                },
              },
              required: ['testCases'],
              additionalProperties: false,
            },
          },
        },
      })

      const content = response.choices[0]?.message?.content
      if (!content) {
        throw new Error('No response from OpenAI')
      }

      try {
        const parsed = JSON.parse(content)
        return Array.isArray(parsed.testCases) ? parsed.testCases : [parsed.testCases]
      } catch (error) {
        throw new Error(`Failed to parse OpenAI response: ${error.message}. Content: ${content.substring(0, 200)}`)
      }
    } catch (error) {
      // Re-throw if it's already an Error with message about API key
      if (error.message?.includes('API_KEY is not configured')) {
        throw error
      }
      // Wrap other errors
      throw new Error(`OpenAI API error: ${error.message || 'Unknown error'}`)
    }
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
    try {
      const systemPrompt = this.buildImproveSystemPrompt(improvements)
      const userPrompt = `Improve the following test case:\n\n${JSON.stringify(testCase, null, 2)}`

      const response = await this.getClient().chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.5,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'improved_test_case',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                title: {
                  type: 'string',
                  description: 'An optional improved title for the test case',
                  minLength: 1,
                },
                steps: {
                  type: 'array',
                  description: 'A list of step objects, each defining an action and its expected result',
                  items: {
                    type: 'object',
                    properties: {
                      action: {
                        type: 'string',
                        description: 'A description of the specific step or action to perform',
                      },
                      expected: {
                        type: 'string',
                        description: 'The expected result or output after performing the action',
                      },
                    },
                    required: ['action', 'expected'],
                    additionalProperties: false,
                  },
                },
                priority: {
                  type: 'string',
                  description: 'The priority of this test case (optional, only present if needs to change)',
                  enum: ['low', 'medium', 'high'],
                },
                tags: {
                  type: 'array',
                  description: 'A list of tags associated with the test case',
                  items: {
                    type: 'string',
                    minLength: 1,
                  },
                },
                suggestions: {
                  type: 'array',
                  description: 'A list of suggestions for improvements or next steps',
                  items: {
                    type: 'string',
                    minLength: 1,
                  },
                },
              },
              required: ['steps', 'tags', 'suggestions'],
              additionalProperties: false,
            },
          },
        },
      })

      const content = response.choices[0]?.message?.content
      if (!content) {
        throw new Error('No response from OpenAI')
      }

      try {
        return JSON.parse(content)
      } catch (error) {
        throw new Error(`Failed to parse OpenAI response: ${error.message}. Content: ${content.substring(0, 200)}`)
      }
    } catch (error) {
      // Re-throw if it's already an Error with message about API key
      if (error.message?.includes('API_KEY is not configured')) {
        throw error
      }
      // Wrap other errors
      throw new Error(`OpenAI API error: ${error.message || 'Unknown error'}`)
    }
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
    try {
      const systemPrompt = this.buildParseTableSystemPrompt(mapping)
      const userPrompt = `Parse the following table data into test cases:\n\n${JSON.stringify(tableData, null, 2)}`

      const response = await this.getClient().chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'parsed_test_cases',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                testCases: {
                  type: 'array',
                  description: 'Array of parsed test cases from table data',
                  items: {
                    type: 'object',
                    properties: {
                      title: {
                        type: 'string',
                        description: 'Test case title',
                        minLength: 1,
                      },
                      steps: {
                        type: 'array',
                        description: 'List of test steps',
                        items: {
                          type: 'object',
                          properties: {
                            action: {
                              type: 'string',
                              description: 'Action to perform',
                            },
                            expected: {
                              type: 'string',
                              description: 'Expected result',
                            },
                          },
                          required: ['action', 'expected'],
                          additionalProperties: false,
                        },
                      },
                      priority: {
                        type: 'string',
                        description: 'Test case priority',
                        enum: ['low', 'medium', 'high'],
                      },
                      tags: {
                        type: 'array',
                        description: 'Test case tags',
                        items: {
                          type: 'string',
                          minLength: 1,
                        },
                      },
                      status: {
                        type: 'string',
                        description: 'Test case status',
                        enum: ['draft', 'inReview', 'approved'],
                      },
                    },
                    required: ['title', 'steps'],
                    additionalProperties: false,
                  },
                },
              },
              required: ['testCases'],
              additionalProperties: false,
            },
          },
        },
      })

      const content = response.choices[0]?.message?.content
      if (!content) {
        throw new Error('No response from OpenAI')
      }

      try {
        const parsed = JSON.parse(content)
        return Array.isArray(parsed.testCases) ? parsed.testCases : [parsed.testCases]
      } catch (error) {
        throw new Error(`Failed to parse OpenAI response: ${error.message}. Content: ${content.substring(0, 200)}`)
      }
    } catch (error) {
      // Re-throw if it's already an Error with message about API key
      if (error.message?.includes('API_KEY is not configured')) {
        throw error
      }
      // Wrap other errors
      throw new Error(`OpenAI API error: ${error.message || 'Unknown error'}`)
    }
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

  private buildImproveSystemPrompt(improvements?: Array<'steps' | 'clarity' | 'completeness' | 'edge-cases'>): string {
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
}

