export interface GeneratedTestCase {
  title: string
  steps: Array<{ action: string; expected: string }>
  priority: 'low' | 'medium' | 'high'
  tags: string[]
  status?: 'draft' | 'inReview' | 'approved'
}

export interface ImprovedTestCase {
  title?: string
  steps?: Array<{ action: string; expected: string }>
  priority?: string
  tags?: string[]
  suggestions?: string[]
}

export interface ParsedTableRow {
  title: string
  steps: Array<{ action: string; expected: string }>
  priority?: string
  tags?: string[]
  status?: string
}

export interface AIProvider {
  generateTestCases(
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
    count?: number,
  ): Promise<GeneratedTestCase[]>

  improveTestCase(
    testCase: {
      title: string
      steps: Array<{ action: string; expected: string }>
      priority: string
      tags: string[]
    },
    improvements?: Array<'steps' | 'clarity' | 'completeness' | 'edge-cases'>,
  ): Promise<ImprovedTestCase>

  parseTableData(
    tableData: Array<Record<string, any>>,
    mapping?: {
      titleColumn?: string
      stepsColumn?: string
      priorityColumn?: string
      tagsColumn?: string
      statusColumn?: string
    },
  ): Promise<ParsedTableRow[]>
}







