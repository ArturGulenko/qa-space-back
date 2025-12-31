import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common'
import { PrismaService } from '../prisma.service'
import * as vm from 'vm'
import {
  PostmanCollection,
  PostmanItem,
  PostmanRequest,
  PostmanEnvironment,
  PostmanEnvironmentValue,
  PostmanVariable,
  PostmanEvent,
  PostmanAuth,
} from './types/postman-collection.types'
import {
  PostmanExecutionResult,
  PostmanTestResult,
  PostmanCollectionExecutionSummary,
} from './types/execution-result.types'

@Injectable()
export class PostmanService {
  constructor(private prisma: PrismaService) {}

  /**
   * Parse Postman Collection JSON
   */
  async parseCollection(collectionJson: any): Promise<PostmanCollection> {
    try {
      if (!collectionJson || typeof collectionJson !== 'object') {
        throw new BadRequestException('Invalid collection format')
      }

      // Validate schema version
      const schema = collectionJson.info?.schema
      if (schema && !schema.includes('collection')) {
        throw new BadRequestException('Invalid Postman collection schema')
      }

      return collectionJson as PostmanCollection
    } catch (error: any) {
      if (error instanceof BadRequestException) {
        throw error
      }
      throw new BadRequestException(`Failed to parse collection: ${error.message}`)
    }
  }

  /**
   * Parse Postman Environment JSON
   */
  async parseEnvironment(environmentJson: any): Promise<PostmanEnvironment> {
    try {
      if (!environmentJson || typeof environmentJson !== 'object') {
        throw new BadRequestException('Invalid environment format')
      }

      if (!environmentJson.name) {
        throw new BadRequestException('Environment name is required')
      }

      if (!Array.isArray(environmentJson.values)) {
        throw new BadRequestException('Environment values must be an array')
      }

      return environmentJson as PostmanEnvironment
    } catch (error: any) {
      if (error instanceof BadRequestException) {
        throw error
      }
      throw new BadRequestException(`Failed to parse environment: ${error.message}`)
    }
  }

  /**
   * Save collection to database
   */
  async saveCollection(
    workspaceId: number,
    projectId: number,
    collection: PostmanCollection,
    collectionName?: string,
    userId?: number,
  ): Promise<number> {
    const name = collectionName || collection.info.name || 'Untitled Collection'
    const collectionData = JSON.stringify(collection, null, 2)

    // Store collection data in FileAsset
    // In production, you might want to create a dedicated PostmanCollection table
    const fileAsset = await this.prisma.fileAsset.create({
      data: {
        workspaceId,
        projectId,
        provider: 'internal',
        bucket: 'postman-collections',
        key: `collection-${Date.now()}-${name.replace(/[^a-zA-Z0-9]/g, '-')}`,
        fileName: `${name}.postman_collection.json`,
        mimeType: 'application/json',
        sizeBytes: Buffer.from(collectionData).length,
        uploadedById: userId || 1,
        sourceUrl: `data:application/json;base64,${Buffer.from(collectionData).toString('base64')}`, // Temporary storage
      },
    })

    return fileAsset.id
  }

  /**
   * Save environment to database
   */
  async saveEnvironment(
    workspaceId: number,
    projectId: number,
    environment: PostmanEnvironment,
    environmentName?: string,
    userId?: number,
  ): Promise<number> {
    const name = environmentName || environment.name || 'Untitled Environment'
    const environmentData = JSON.stringify(environment, null, 2)

    const fileAsset = await this.prisma.fileAsset.create({
      data: {
        workspaceId,
        projectId,
        provider: 'internal',
        bucket: 'postman-environments',
        key: `environment-${Date.now()}-${name.replace(/[^a-zA-Z0-9]/g, '-')}`,
        fileName: `${name}.postman_environment.json`,
        mimeType: 'application/json',
        sizeBytes: Buffer.from(environmentData).length,
        uploadedById: userId || 1,
        sourceUrl: `data:application/json;base64,${Buffer.from(environmentData).toString('base64')}`, // Temporary storage
      },
    })

    return fileAsset.id
  }

  /**
   * Apply authentication to request headers
   */
  private applyAuth(
    auth: PostmanAuth,
    headers: Record<string, string>,
    vars: Record<string, string>,
  ): void {
    if (!auth.type || auth.type === 'noauth') {
      return
    }

    switch (auth.type) {
      case 'bearer':
        if (auth.bearer) {
          const token = auth.bearer.find((p) => p.key === 'token')?.value || ''
          headers['Authorization'] = `Bearer ${this.resolveVariables(token, vars, {})}`
        }
        break

      case 'basic':
        if (auth.basic) {
          const username = auth.basic.find((p) => p.key === 'username')?.value || ''
          const password = auth.basic.find((p) => p.key === 'password')?.value || ''
          const credentials = Buffer.from(
            `${this.resolveVariables(username, vars, {})}:${this.resolveVariables(password, vars, {})}`,
          ).toString('base64')
          headers['Authorization'] = `Basic ${credentials}`
        }
        break

      case 'apikey':
        if (auth.apikey) {
          const key = auth.apikey.find((p) => p.key === 'key')?.value || ''
          const value = auth.apikey.find((p) => p.key === 'value')?.value || ''
          const addTo = auth.apikey.find((p) => p.key === 'addTo')?.value || 'header'
          const resolvedKey = this.resolveVariables(key, vars, {})
          const resolvedValue = this.resolveVariables(value, vars, {})

          if (addTo === 'header') {
            headers[resolvedKey] = resolvedValue
          } else if (addTo === 'query') {
            // Query params are handled in buildUrl
          }
        }
        break

      // Other auth types can be added here
    }
  }

  /**
   * Resolve variables in a string using environment and collection variables
   */
  private resolveVariables(
    text: string,
    environmentVars: Record<string, string>,
    collectionVars: Record<string, string>,
  ): string {
    if (!text) return text

    // Postman uses {{variable}} syntax
    return text.replace(/\{\{([^}]+)\}\}/g, (match, varName) => {
      const trimmed = varName.trim()
      // Check environment first, then collection
      if (environmentVars[trimmed] !== undefined) {
        return environmentVars[trimmed]
      }
      if (collectionVars[trimmed] !== undefined) {
        return collectionVars[trimmed]
      }
      return match // Keep original if not found
    })
  }

  /**
   * Build environment variables map
   */
  private buildEnvironmentMap(
    environment?: PostmanEnvironment,
    collectionVars?: PostmanVariable[],
  ): Record<string, string> {
    const vars: Record<string, string> = {}

    // Add collection variables
    if (collectionVars) {
      collectionVars.forEach((v) => {
        if (!v.disabled && v.value !== undefined) {
          vars[v.key] = String(v.value)
        }
      })
    }

    // Add environment variables (override collection vars)
    if (environment?.values) {
      environment.values.forEach((v) => {
        if (v.enabled !== false && v.value !== undefined) {
          vars[v.key] = String(v.value)
        }
      })
    }

    return vars
  }

  /**
   * Build URL from Postman URL object
   */
  private buildUrl(url: PostmanRequest['url'], vars: Record<string, string>): string {
    if (typeof url === 'string') {
      return this.resolveVariables(url, vars, {})
    }

    let urlString = ''

    // Protocol
    if (url.protocol) {
      urlString += url.protocol
      if (!url.protocol.endsWith('://')) {
        urlString += '://'
      }
    } else {
      urlString += 'https://'
    }

    // Host
    if (url.host && url.host.length > 0) {
      urlString += url.host.map((h) => this.resolveVariables(h, vars, {})).join('.')
    }

    // Path
    if (url.path && url.path.length > 0) {
      const path = url.path.map((p) => this.resolveVariables(p, vars, {})).join('/')
      urlString += '/' + path
    }

    // Query params
    if (url.query && url.query.length > 0) {
      const enabledParams = url.query.filter((q) => !q.disabled)
      if (enabledParams.length > 0) {
        const queryString = enabledParams
          .map((q) => {
            const key = this.resolveVariables(q.key, vars, {})
            const value = q.value ? this.resolveVariables(q.value, vars, {}) : ''
            return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`
          })
          .join('&')
        urlString += '?' + queryString
      }
    }

    return urlString
  }

  /**
   * Execute pre-request scripts
   */
  private async executePreRequestScripts(
    events: PostmanEvent[] | undefined,
    vars: Record<string, string>,
    request: PostmanRequest,
  ): Promise<Record<string, string>> {
    if (!events || events.length === 0) {
      return vars
    }

    const preRequestEvents = events.filter((e) => e.listen === 'prerequest')
    if (preRequestEvents.length === 0) {
      return vars
    }

    // Create a copy of vars to modify
    const updatedVars = { ...vars }
    const pmContext = this.createPostmanContext(updatedVars, request, null)

    for (const event of preRequestEvents) {
      if (event.script?.exec) {
        const scriptCode = event.script.exec.join('\n')
        try {
          const script = new vm.Script(scriptCode)
          script.runInNewContext(pmContext, { timeout: 5000 })
          // Update vars from pm.environment and pm.variables
          Object.assign(updatedVars, pmContext.pm.environment.toObject())
          Object.assign(updatedVars, pmContext.pm.variables.toObject())
        } catch (error: any) {
          console.warn(`Pre-request script error: ${error.message}`)
          // Continue execution even if script fails
        }
      }
    }

    return updatedVars
  }

  /**
   * Execute test scripts
   */
  private executeTestScripts(
    events: PostmanEvent[] | undefined,
    vars: Record<string, string>,
    request: PostmanRequest,
    response: Response,
    responseBody: string,
    responseHeaders: Record<string, string>,
  ): PostmanTestResult[] {
    if (!events || events.length === 0) {
      return []
    }

    const testEvents = events.filter((e) => e.listen === 'test')
    if (testEvents.length === 0) {
      return []
    }

    const testResults: PostmanTestResult[] = []
    const pmContext = this.createPostmanContext(vars, request, {
      status: response.status,
      statusText: response.statusText || `HTTP ${response.status}`,
      body: responseBody,
      headers: responseHeaders,
    })

    for (const event of testEvents) {
      if (event.script?.exec) {
        const scriptCode = event.script.exec.join('\n')
        try {
          const script = new vm.Script(scriptCode)
          script.runInNewContext(pmContext, { timeout: 5000 })

          // Extract test results from pm.test calls
          const tests = pmContext.pm.test.getResults()
          testResults.push(...tests)
        } catch (error: any) {
          testResults.push({
            testName: 'Script Execution',
            passed: false,
            error: error.message,
          })
        }
      }
    }

    return testResults
  }

  /**
   * Create Postman API context (pm object)
   */
  private createPostmanContext(
    vars: Record<string, string>,
    request: PostmanRequest,
    response: { status: number; statusText: string; body: string; headers: Record<string, string> } | null,
  ): any {
    const testResults: PostmanTestResult[] = []

    const pm = {
      environment: {
        get: (key: string) => vars[key] || undefined,
        set: (key: string, value: string) => {
          vars[key] = String(value)
        },
        unset: (key: string) => {
          delete vars[key]
        },
        toObject: () => ({ ...vars }),
      },
      variables: {
        get: (key: string) => vars[key] || undefined,
        set: (key: string, value: string) => {
          vars[key] = String(value)
        },
        unset: (key: string) => {
          delete vars[key]
        },
        toObject: () => ({ ...vars }),
      },
      request: {
        url: {
          toString: () => this.buildUrl(request.url, vars),
        },
        method: request.method || 'GET',
        headers: {
          get: (key: string) => {
            const header = request.header?.find((h) => h.key.toLowerCase() === key.toLowerCase())
            return header?.value
          },
          toObject: () => {
            const headers: Record<string, string> = {}
            request.header?.forEach((h) => {
              if (!h.disabled) {
                headers[h.key] = h.value
              }
            })
            return headers
          },
        },
        body: {
          raw: request.body?.raw || '',
          urlencoded: request.body?.urlencoded || [],
          formdata: request.body?.formdata || [],
        },
      },
      response: response
        ? {
            code: response.status,
            status: response.status,
            statusText: response.statusText,
            headers: {
              get: (key: string) => response.headers[key.toLowerCase()],
              toObject: () => response.headers,
            },
            json: () => {
              try {
                return JSON.parse(response.body)
              } catch {
                return null
              }
            },
            text: () => response.body,
            body: response.body,
            to: {
              have: {
                status: (expectedStatus: number) => {
                  if (response.status !== expectedStatus) {
                    throw new Error(`Expected status ${expectedStatus}, got ${response.status}`)
                  }
                  return {
                    status: (status: number) => {
                      // Chainable
                      if (response.status !== status) {
                        throw new Error(`Expected status ${status}, got ${response.status}`)
                      }
                    },
                  }
                },
              },
            },
          }
        : null,
      test: {
        results: testResults,
        getResults: () => testResults,
      },
    }

    // pm.test function
    const pmTest = (name: string, fn: () => void) => {
      try {
        fn()
        testResults.push({ testName: name, passed: true })
      } catch (error: any) {
        testResults.push({
          testName: name,
          passed: false,
          error: error.message || String(error),
        })
      }
    }

    // pm.expect function (simplified)
    const pmExpect = (value: any) => {
      return {
        to: {
          be: {
            a: (type: string) => {
              const actualType = typeof value
              if (type === 'string' && actualType !== 'string') {
                throw new Error(`Expected ${value} to be a ${type}`)
              }
              if (type === 'number' && actualType !== 'number') {
                throw new Error(`Expected ${value} to be a ${type}`)
              }
              if (type === 'object' && (actualType !== 'object' || value === null)) {
                throw new Error(`Expected ${value} to be a ${type}`)
              }
            },
          },
          equal: (expected: any) => {
            if (value !== expected) {
              throw new Error(`Expected ${value} to equal ${expected}`)
            }
          },
          include: (expected: string) => {
            if (typeof value === 'string' && !value.includes(expected)) {
              throw new Error(`Expected ${value} to include ${expected}`)
            }
          },
        },
        eql: (expected: any) => {
          if (JSON.stringify(value) !== JSON.stringify(expected)) {
            throw new Error(`Expected ${JSON.stringify(value)} to equal ${JSON.stringify(expected)}`)
          }
        },
      }
    }

    return {
      pm: {
        ...pm,
        test: pmTest,
        expect: pmExpect,
      },
      console: {
        log: (...args: any[]) => console.log('[Postman Script]', ...args),
        error: (...args: any[]) => console.error('[Postman Script]', ...args),
        warn: (...args: any[]) => console.warn('[Postman Script]', ...args),
      },
      setTimeout: (fn: () => void, delay: number) => {
        // Simplified setTimeout - in production might need proper async handling
        return setTimeout(fn, delay)
      },
      clearTimeout: (id: any) => clearTimeout(id),
      setInterval: (fn: () => void, delay: number) => setInterval(fn, delay),
      clearInterval: (id: any) => clearInterval(id),
    }
  }

  /**
   * Extract events from item (collection, folder, or request level)
   */
  private getItemEvents(item: PostmanItem, collection: PostmanCollection): PostmanEvent[] {
    const events: PostmanEvent[] = []

    // Collection level events
    if (collection.event) {
      events.push(...collection.event)
    }

    // Item level events
    if (item.event) {
      events.push(...item.event)
    }

    return events
  }

  /**
   * Execute a single Postman request
   */
  private async executeRequest(
    request: PostmanRequest,
    vars: Record<string, string>,
    events?: PostmanEvent[],
  ): Promise<PostmanExecutionResult> {
    const startTime = Date.now()
    
    // Execute pre-request scripts
    const updatedVars = await this.executePreRequestScripts(events, vars, request)
    const finalVars = updatedVars

    const method = request.method || 'GET'
    const url = this.buildUrl(request.url, finalVars)

    try {
      // Build headers
      const headers: Record<string, string> = {}
      if (request.header) {
        request.header
          .filter((h) => !h.disabled)
          .forEach((h) => {
            headers[h.key] = this.resolveVariables(h.value, finalVars, {})
          })
      }

      // Apply authentication
      if (request.auth) {
        this.applyAuth(request.auth, headers, finalVars)
      }

      // Build body
      let body: string | undefined
      if (request.body) {
        if (request.body.mode === 'raw' && request.body.raw) {
          body = this.resolveVariables(request.body.raw, finalVars, {})
        } else if (request.body.mode === 'urlencoded' && request.body.urlencoded) {
          const params = request.body.urlencoded
            .filter((p) => !p.disabled)
            .map((p) => {
              const key = encodeURIComponent(p.key)
              const value = p.value ? encodeURIComponent(this.resolveVariables(p.value, finalVars, {})) : ''
              return `${key}=${value}`
            })
            .join('&')
          body = params
          headers['Content-Type'] = headers['Content-Type'] || 'application/x-www-form-urlencoded'
        } else if (request.body.mode === 'formdata' && request.body.formdata) {
          // FormData is complex, for now we'll skip file uploads
          const params = request.body.formdata
            .filter((p) => !p.disabled && p.type !== 'file')
            .map((p) => {
              const key = encodeURIComponent(p.key)
              const value = p.value ? encodeURIComponent(this.resolveVariables(p.value, finalVars, {})) : ''
              return `${key}=${value}`
            })
            .join('&')
          body = params
          headers['Content-Type'] = headers['Content-Type'] || 'application/x-www-form-urlencoded'
        }
      }

      // Execute HTTP request using fetch
      const fetchOptions: RequestInit = {
        method,
        headers,
      }

      if (body && ['POST', 'PUT', 'PATCH'].includes(method)) {
        fetchOptions.body = body
      }

      const response = await fetch(url, fetchOptions)
      const responseTime = Date.now() - startTime

      // Read response
      const responseBody = await response.text()
      const responseHeaders: Record<string, string> = {}
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value
      })

      // Run test scripts
      const testResults = this.executeTestScripts(
        events,
        finalVars,
        request,
        response,
        responseBody,
        responseHeaders,
      )

      // Determine success based on HTTP status and test results
      const allTestsPassed = testResults.length === 0 || testResults.every((t) => t.passed)
      const requestSuccess = response.ok && allTestsPassed

      return {
        requestName: request.description || `${method} ${url}`,
        requestMethod: method,
        requestUrl: url,
        statusCode: response.status,
        responseTime,
        success: requestSuccess,
        responseBody: responseBody.substring(0, 10000), // Limit size
        responseHeaders,
        testResults,
      }
    } catch (error: any) {
      const responseTime = Date.now() - startTime
      return {
        requestName: request.description || `${method} ${url}`,
        requestMethod: method,
        requestUrl: url,
        responseTime,
        success: false,
        error: error.message || 'Request failed',
        testResults: [],
      }
    }
  }

  /**
   * Extract all requests from collection (flatten folders)
   */
  private extractRequests(
    items: PostmanItem[],
    collection: PostmanCollection,
  ): Array<{ request: PostmanRequest; name: string; events: PostmanEvent[] }> {
    const requests: Array<{ request: PostmanRequest; name: string; events: PostmanEvent[] }> = []

    const traverse = (itemList: PostmanItem[], folderName = '', parentEvents: PostmanEvent[] = []) => {
      for (const item of itemList) {
        // Combine collection, folder, and item level events
        const itemEvents = this.getItemEvents(item, collection)
        const allEvents = [...parentEvents, ...itemEvents]

        if (item.request) {
          requests.push({
            request: item.request,
            name: folderName ? `${folderName} > ${item.name}` : item.name,
            events: allEvents,
          })
        }
        if (item.item) {
          traverse(item.item, folderName ? `${folderName} > ${item.name}` : item.name, allEvents)
        }
      }
    }

    traverse(items)
    return requests
  }

  /**
   * Execute all requests in a collection
   */
  async executeCollection(
    collection: PostmanCollection,
    environment?: PostmanEnvironment,
  ): Promise<PostmanCollectionExecutionSummary> {
    const vars = this.buildEnvironmentMap(environment, collection.variable)
    const requests = this.extractRequests(collection.item || [], collection)
    const results: PostmanExecutionResult[] = []
    const startTime = Date.now()

    // Execute requests sequentially
    for (const { request, name, events } of requests) {
      const result = await this.executeRequest(request, vars, events)
      result.requestName = name
      results.push(result)
    }

    const totalTime = Date.now() - startTime
    const passed = results.filter((r) => r.success).length
    const failed = results.filter((r) => !r.success).length
    const errors = results.filter((r) => r.error).length

    return {
      total: results.length,
      passed,
      failed,
      errors,
      totalTime,
      results,
    }
  }

  /**
   * Load collection from database
   */
  async loadCollection(collectionId: number): Promise<PostmanCollection> {
    const fileAsset = await this.prisma.fileAsset.findUnique({
      where: { id: collectionId },
    })

    if (!fileAsset) {
      throw new BadRequestException('Collection not found')
    }

    // Try to load from sourceUrl (base64 data URI)
    if (fileAsset.sourceUrl && fileAsset.sourceUrl.startsWith('data:')) {
      try {
        const base64Data = fileAsset.sourceUrl.split(',')[1]
        const jsonData = Buffer.from(base64Data, 'base64').toString('utf-8')
        return JSON.parse(jsonData) as PostmanCollection
      } catch (error: any) {
        throw new InternalServerErrorException(`Failed to parse collection data: ${error.message}`)
      }
    }

    // In production, you'd fetch from S3 using fileAsset.key and bucket
    throw new InternalServerErrorException('Collection loading from S3 storage not yet implemented')
  }

  /**
   * Load environment from database
   */
  async loadEnvironment(environmentId: number): Promise<PostmanEnvironment> {
    const fileAsset = await this.prisma.fileAsset.findUnique({
      where: { id: environmentId },
    })

    if (!fileAsset) {
      throw new BadRequestException('Environment not found')
    }

    // Try to load from sourceUrl (base64 data URI)
    if (fileAsset.sourceUrl && fileAsset.sourceUrl.startsWith('data:')) {
      try {
        const base64Data = fileAsset.sourceUrl.split(',')[1]
        const jsonData = Buffer.from(base64Data, 'base64').toString('utf-8')
        return JSON.parse(jsonData) as PostmanEnvironment
      } catch (error: any) {
        throw new InternalServerErrorException(`Failed to parse environment data: ${error.message}`)
      }
    }

    // In production, you'd fetch from S3 using fileAsset.key and bucket
    throw new InternalServerErrorException('Environment loading from S3 storage not yet implemented')
  }
}

