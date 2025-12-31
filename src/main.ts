import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import * as cookieParser from 'cookie-parser'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  
  // Enable CORS for frontend
  const isDevelopment = process.env.NODE_ENV !== 'production';
  
  if (isDevelopment) {
    // In development, allow all origins (Flutter web uses dynamic ports)
    app.enableCors({
      origin: true, // Allow all origins in dev
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Workspace-Id'],
    });
  } else {
    // In production, allow configured origins and local dev hosts
    const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean)
    const hasWildcard = allowedOrigins.includes('*')
    const isLocalhost = (origin: string) =>
      origin.startsWith('http://localhost:') ||
      origin.startsWith('http://127.0.0.1:')

    app.enableCors({
      origin: (origin, callback) => {
        if (!origin) {
          return callback(null, true)
        }
        if (hasWildcard || isLocalhost(origin) || allowedOrigins.includes(origin)) {
          return callback(null, true)
        }
        return callback(new Error('Not allowed by CORS'), false)
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Workspace-Id'],
    })
  }
  
  app.use(cookieParser())
  
  // Health check endpoint (before global prefix)
  app.getHttpAdapter().get('/health', (req, res) => {
    res.status(200).json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    })
  })
  
  app.setGlobalPrefix('api')
  
  // Health check endpoint with API prefix (for consistency)
  app.getHttpAdapter().get('/api/health', (req, res) => {
    res.status(200).json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    })
  })
  
  const port = process.env.PORT || 3000
  await app.listen(port)
  console.log(`🚀 Application is running on: http://0.0.0.0:${port}`)
  console.log(`📊 Health check: http://0.0.0.0:${port}/health`)
}

bootstrap().catch((error) => {
  console.error('❌ Failed to start application:', error)
  process.exit(1)
})
