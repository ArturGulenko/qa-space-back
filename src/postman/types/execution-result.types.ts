export interface PostmanExecutionResult {
  requestName: string
  requestMethod: string
  requestUrl: string
  statusCode?: number
  responseTime?: number
  success: boolean
  error?: string
  responseBody?: string
  responseHeaders?: Record<string, string>
  testResults?: PostmanTestResult[]
}

export interface PostmanTestResult {
  testName: string
  passed: boolean
  error?: string
}

export interface PostmanCollectionExecutionSummary {
  total: number
  passed: number
  failed: number
  errors: number
  totalTime: number
  results: PostmanExecutionResult[]
}






