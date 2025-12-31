import { Controller, Post, Body, UseGuards, Request, Get, HttpException, HttpStatus } from '@nestjs/common'
import { AuthService } from './auth.service'
import { UsersService } from '../users/users.service'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService, private users: UsersService) {}

  @Post('login')
  async login(@Body() body: { email: string; password: string }) {
    try {
      const user = await this.auth.validateUser(body.email, body.password)
      if (!user) return { error: 'invalid_credentials' }
      const tokens = await this.auth.login(user)
      return {
        tokens: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
        },
        user: {
          id: user.id.toString(),
          email: user.email,
          name: user.name || '',
          isSuperAdmin: user.isSuperAdmin,
        },
      }
    } catch (error: any) {
      console.error('Login error:', error)
      throw new HttpException(
        error.message || 'Internal server error',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      )
    }
  }

  @Post('refresh')
  async refresh(@Body() body: { refreshToken?: string; refresh_token?: string }) {
    const token = body.refreshToken || body.refresh_token
    if (!token) return { error: 'refresh_token_required' }
    return this.auth.refresh(token)
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@Request() req: any) {
    // JwtAuthGuard sets req.user
    const user = await this.users.findById(req.user?.sub)
    return {
      id: user?.id.toString(),
      email: user?.email,
      name: user?.name || '',
      isSuperAdmin: user?.isSuperAdmin || false,
    }
  }
}
