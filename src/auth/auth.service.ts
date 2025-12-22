import { Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import * as bcrypt from 'bcrypt'
import { UsersService } from '../users/users.service'
import { ConfigService } from '@nestjs/config'

@Injectable()
export class AuthService {
  constructor(private users: UsersService, private jwt: JwtService, private config: ConfigService) {}

  async validateUser(email: string, pass: string) {
    const user = await this.users.findByEmail(email)
    if (!user) return null
    const match = await bcrypt.compare(pass, user.password)
    if (match) return user
    return null
  }

  async login(user: any) {
    const payload = { sub: user.id, email: user.email }
    const accessToken = this.jwt.sign(payload)
    const refreshToken = await this.generateRefreshToken(user.id)
    await this.users.setRefreshToken(user.id, refreshToken)
    return { accessToken, refreshToken }
  }

  async refresh(refreshToken: string) {
    try {
      const secret = this.config.get('JWT_REFRESH_SECRET')
      const payload = this.jwt.verify(refreshToken, { secret })
      const user = await this.users.findById(payload.sub)
      if (!user || !user.refreshToken) throw new UnauthorizedException()
      
      // Verify stored token matches (refresh tokens are stored as plain JWT, not hashed)
      if (user.refreshToken !== refreshToken) throw new UnauthorizedException()
      
      const tokens = await this.login(user)
      return {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      }
    } catch (error) {
      throw new UnauthorizedException()
    }
  }

  async generateRefreshToken(userId: number) {
    const secret = this.config.get('JWT_REFRESH_SECRET')
    const signOptions = { expiresIn: this.config.get('JWT_REFRESH_EXPIRES_IN') || '7d' }
    const token = this.jwt.sign({ sub: userId }, { secret, expiresIn: signOptions.expiresIn })
    return token
  }
}
