import { Controller, Post, Body, UseGuards, Request, Get } from '@nestjs/common'
import { AuthService } from './auth.service'
import { UsersService } from '../users/users.service'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService, private users: UsersService) {}

  @Post('login')
  async login(@Body() body: { email: string; password: string }) {
    const user = await this.auth.validateUser(body.email, body.password)
    if (!user) return { error: 'invalid_credentials' }
    return this.auth.login(user)
  }

  @Post('refresh')
  async refresh(@Body() body: { refreshToken: string }) {
    return this.auth.refresh(body.refreshToken)
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@Request() req: any) {
    // JwtAuthGuard sets req.user
    const user = await this.users.findById(req.user?.sub)
    return { id: user?.id, email: user?.email, name: user?.name }
  }
}
