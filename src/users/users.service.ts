import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma.service'
import * as bcrypt from 'bcrypt'

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } })
  }

  async findById(id: number) {
    return this.prisma.user.findUnique({ where: { id } })
  }

  async setRefreshToken(userId: number, token: string) {
    // Store refresh token as plain JWT (not hashed) for verification
    return this.prisma.user.update({ where: { id: userId }, data: { refreshToken: token } })
  }
}
