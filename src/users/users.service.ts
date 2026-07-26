import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async getProfile(userId: string) {
    return this.prisma.profile.findUnique({
      where: { userId },
      select: { firstName: true, lastName: true, email: true, role: true },
    })
  }
}
