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
    // In production, use specific origins
    app.enableCors({
      origin: [
        'http://localhost:8080',
        'http://localhost:8081',
        ...(process.env.ALLOWED_ORIGINS?.split(',') || []),
      ],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Workspace-Id'],
    });
  }
  
  app.use(cookieParser())
  app.setGlobalPrefix('api')
  await app.listen(process.env.PORT || 3000)
  console.log('Listening on', process.env.PORT || 3000)
}
bootstrap()
