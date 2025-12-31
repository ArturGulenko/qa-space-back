/**
 * Postman Collection v2.1 types
 * Based on: https://schema.getpostman.com/json/collection/v2.1.0/docs/index.html
 */

export interface PostmanCollection {
  info: {
    name: string
    description?: string
    schema: string
    _postman_id?: string
  }
  item: PostmanItem[]
  variable?: PostmanVariable[]
  auth?: PostmanAuth
  event?: PostmanEvent[]
}

export interface PostmanItem {
  name: string
  item?: PostmanItem[] // For folders
  request?: PostmanRequest
  response?: PostmanResponse[]
  event?: PostmanEvent[]
  variable?: PostmanVariable[]
}

export interface PostmanRequest {
  method: string
  header?: PostmanHeader[]
  body?: PostmanBody
  url: PostmanUrl | string
  description?: string
  auth?: PostmanAuth
}

export interface PostmanUrl {
  raw?: string
  protocol?: string
  host?: string[]
  path?: string[]
  query?: PostmanQueryParam[]
  variable?: PostmanVariable[]
}

export interface PostmanQueryParam {
  key: string
  value?: string
  disabled?: boolean
}

export interface PostmanHeader {
  key: string
  value: string
  disabled?: boolean
  description?: string
}

export interface PostmanBody {
  mode?: 'raw' | 'urlencoded' | 'formdata' | 'file' | 'graphql'
  raw?: string
  urlencoded?: PostmanFormDataParam[]
  formdata?: PostmanFormDataParam[]
  graphql?: {
    query: string
    variables?: string
  }
}

export interface PostmanFormDataParam {
  key: string
  value?: string
  type?: 'text' | 'file'
  disabled?: boolean
}

export interface PostmanVariable {
  key: string
  value?: string
  type?: 'string' | 'boolean' | 'any' | 'number'
  disabled?: boolean
}

export interface PostmanAuth {
  type?: 'noauth' | 'apikey' | 'awsv4' | 'basic' | 'bearer' | 'digest' | 'hawk' | 'oauth1' | 'oauth2' | 'ntlm'
  apikey?: PostmanAuthParam[]
  awsv4?: PostmanAuthParam[]
  basic?: PostmanAuthParam[]
  bearer?: PostmanAuthParam[]
  digest?: PostmanAuthParam[]
  hawk?: PostmanAuthParam[]
  oauth1?: PostmanAuthParam[]
  oauth2?: PostmanAuthParam[]
  ntlm?: PostmanAuthParam[]
}

export interface PostmanAuthParam {
  key: string
  value?: string
  type?: string
}

export interface PostmanResponse {
  name?: string
  originalRequest?: PostmanRequest
  status?: string
  code?: number
  _postman_previewlanguage?: string
  header?: PostmanHeader[]
  cookie?: any[]
  body?: string
}

export interface PostmanEvent {
  listen: 'prerequest' | 'test'
  script?: {
    type?: 'text/javascript'
    exec?: string[]
  }
}

/**
 * Postman Environment types
 */
export interface PostmanEnvironment {
  id?: string
  name: string
  values: PostmanEnvironmentValue[]
  _postman_variable_scope?: 'environment'
  _postman_exported_at?: string
  _postman_exported_using?: string
}

export interface PostmanEnvironmentValue {
  key: string
  value: string
  type?: 'string' | 'boolean' | 'any' | 'number'
  enabled?: boolean
}






