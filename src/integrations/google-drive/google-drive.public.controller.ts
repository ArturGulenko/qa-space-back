import { Controller, Get, Query, Res } from '@nestjs/common'
import { Response } from 'express'
import { GoogleDriveService } from './google-drive.service'

@Controller('integrations/google-drive')
export class GoogleDrivePublicController {
  constructor(private readonly service: GoogleDriveService) {}

  @Get('callback')
  async callback(
    @Res() res: Response,
    @Query('code') code?: string,
    @Query('state') state?: string,
  ) {
    await this.service.handleCallback(code, state)
    res.setHeader('Content-Type', 'text/html')
    res.send(`
      <html>
        <head>
          <title>Google Drive connected</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; text-align: center; }
            .card { max-width: 420px; margin: 0 auto; padding: 24px; border: 1px solid #ddd; border-radius: 12px; }
            .title { font-size: 20px; margin-bottom: 8px; }
            .subtitle { color: #666; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="title">Google Drive connected</div>
            <div class="subtitle">You can return to the app and import files.</div>
          </div>
        </body>
      </html>
    `)
  }
}
