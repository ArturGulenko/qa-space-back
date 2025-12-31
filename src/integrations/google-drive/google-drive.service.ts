import { BadRequestException, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { google } from 'googleapis'
import * as mammoth from 'mammoth'
import pdfParse from 'pdf-parse'
import { PrismaService } from '../../prisma.service'
import { DocsService } from '../../docs/docs.service'

const GOOGLE_DRIVE_SCOPES = ['https://www.googleapis.com/auth/drive.readonly']

@Injectable()
export class GoogleDriveService {
  constructor(
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly docsService: DocsService,
  ) {}

  private getOAuthClient() {
    const clientId = this.config.get('GOOGLE_DRIVE_CLIENT_ID')
    const clientSecret = this.config.get('GOOGLE_DRIVE_CLIENT_SECRET')
    const redirectUri = this.config.get('GOOGLE_DRIVE_REDIRECT_URI')
    if (!clientId || !clientSecret || !redirectUri) {
      throw new BadRequestException('Google Drive OAuth is not configured')
    }
    return new google.auth.OAuth2(clientId, clientSecret, redirectUri)
  }

  async getAuthUrl(userId: number) {
    const oauth2Client = this.getOAuthClient()
    const state = this.jwt.sign({ userId }, { expiresIn: '10m' })
    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: GOOGLE_DRIVE_SCOPES,
      state,
    })
    return { url }
  }

  async handleCallback(code?: string, state?: string) {
    if (!code || !state) {
      throw new BadRequestException('Missing OAuth parameters')
    }
    const payload = this.jwt.verify<{ userId: number }>(state)
    const oauth2Client = this.getOAuthClient()
    const tokenResponse = await oauth2Client.getToken(code)
    const tokens = tokenResponse.tokens
    if (!tokens.access_token) {
      throw new BadRequestException('Failed to obtain access token')
    }

    await this.prisma.googleDriveToken.upsert({
      where: { userId: payload.userId },
      create: {
        userId: payload.userId,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenType: tokens.token_type,
        scope: tokens.scope,
        expiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      },
      update: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? undefined,
        tokenType: tokens.token_type ?? undefined,
        scope: tokens.scope ?? undefined,
        expiry: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
      },
    })
  }

  async getStatus(userId: number) {
    const token = await this.prisma.googleDriveToken.findUnique({
      where: { userId },
    })
    return { connected: Boolean(token) }
  }

  private async getAuthorizedClient(userId: number) {
    const token = await this.prisma.googleDriveToken.findUnique({
      where: { userId },
    })
    if (!token) {
      throw new BadRequestException('Google Drive is not connected')
    }
    const oauth2Client = this.getOAuthClient()
    oauth2Client.setCredentials({
      access_token: token.accessToken,
      refresh_token: token.refreshToken ?? undefined,
      token_type: token.tokenType ?? undefined,
      scope: token.scope ?? undefined,
      expiry_date: token.expiry ? token.expiry.getTime() : undefined,
    })
    oauth2Client.on('tokens', async (tokens) => {
      if (!tokens.access_token && !tokens.refresh_token) return
      await this.prisma.googleDriveToken.update({
        where: { userId },
        data: {
          accessToken: tokens.access_token ?? token.accessToken,
          refreshToken: tokens.refresh_token ?? token.refreshToken,
          tokenType: tokens.token_type ?? token.tokenType,
          scope: tokens.scope ?? token.scope,
          expiry: tokens.expiry_date ? new Date(tokens.expiry_date) : token.expiry,
        },
      })
    })
    return oauth2Client
  }

  async listFiles(userId: number, query?: string) {
    const auth = await this.getAuthorizedClient(userId)
    const drive = google.drive({ version: 'v3', auth })
    const filters = ["trashed = false", "mimeType != 'application/vnd.google-apps.folder'"]
    if (query) {
      const safeQuery = query.replace(/'/g, "\\'")
      filters.push(`name contains '${safeQuery}'`)
    }
    const response = await drive.files.list({
      q: filters.join(' and '),
      fields: 'files(id,name,mimeType,modifiedTime)',
      pageSize: 50,
    })
    return response.data.files ?? []
  }

  async importFile(params: {
    userId: number
    workspaceId: number
    projectId: number
    fileId: string
    title?: string
  }) {
    const auth = await this.getAuthorizedClient(params.userId)
    const drive = google.drive({ version: 'v3', auth })
    const meta = await drive.files.get({
      fileId: params.fileId,
      fields: 'id,name,mimeType',
    })
    const fileName = meta.data.name || 'Google Drive file'
    const mimeType = meta.data.mimeType || ''

    let content = ''
    if (mimeType === 'application/vnd.google-apps.document') {
      const exportResponse = await drive.files.export(
        { fileId: params.fileId, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
        { responseType: 'arraybuffer' },
      )
      content = await this.extractDocxText(Buffer.from(exportResponse.data as ArrayBuffer))
    } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const downloadResponse = await drive.files.get(
        { fileId: params.fileId, alt: 'media' },
        { responseType: 'arraybuffer' },
      )
      content = await this.extractDocxText(Buffer.from(downloadResponse.data as ArrayBuffer))
    } else if (mimeType === 'application/pdf') {
      const downloadResponse = await drive.files.get(
        { fileId: params.fileId, alt: 'media' },
        { responseType: 'arraybuffer' },
      )
      content = await this.extractPdfText(Buffer.from(downloadResponse.data as ArrayBuffer))
    } else if (mimeType.startsWith('text/')) {
      const downloadResponse = await drive.files.get(
        { fileId: params.fileId, alt: 'media' },
        { responseType: 'arraybuffer' },
      )
      content = Buffer.from(downloadResponse.data as ArrayBuffer).toString('utf-8')
    } else {
      throw new BadRequestException('Unsupported file type for import')
    }

    return this.docsService.create(
      params.projectId,
      params.workspaceId,
      params.userId,
      {
        title: params.title || fileName,
        content,
        status: 'draft',
        type: 'doc',
      },
    )
  }

  private async extractDocxText(buffer: Buffer) {
    const result = await mammoth.extractRawText({ buffer })
    return result.value?.trim() || ''
  }

  private async extractPdfText(buffer: Buffer) {
    const result = await pdfParse(buffer)
    return result.text?.trim() || ''
  }
}
