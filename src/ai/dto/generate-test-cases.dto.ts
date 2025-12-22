export class GenerateTestCasesDto {
  description: string
  suiteId?: number
  count?: number
  provider?: 'openai' | 'gemini' // Default: 'gemini'
  context?: {
    existingTestCases?: Array<{
      title: string
      steps: Array<{ action: string; expected: string }>
      tags: string[]
      priority: string
    }>
    projectTags?: string[]
    projectPriorities?: string[]
  }
}

