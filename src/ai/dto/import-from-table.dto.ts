export class ImportFromTableDto {
  provider?: 'openai' | 'gemini' // Default: 'gemini'
  mapping?: {
    titleColumn?: string
    stepsColumn?: string
    priorityColumn?: string
    tagsColumn?: string
    statusColumn?: string
  }
}

