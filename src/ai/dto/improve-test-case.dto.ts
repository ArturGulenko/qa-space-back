export class ImproveTestCaseDto {
  provider?: 'openai' | 'gemini' // Default: 'gemini'
  improvements?: Array<'steps' | 'clarity' | 'completeness' | 'edge-cases'>
}

