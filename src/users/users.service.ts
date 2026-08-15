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

  /**
   * Every profile, newest first. The selection is explicit so a column added to `Profile` later
   * cannot start reaching the admin app on its own.
   */
  async findAllForAdmin(search?: string) {
    const term = search?.trim();

    return this.prisma.profile.findMany({
      where: term
        ? {
            OR: [
              { email: { contains: term, mode: 'insensitive' } },
              { firstName: { contains: term, mode: 'insensitive' } },
              { lastName: { contains: term, mode: 'insensitive' } },
            ],
          }
        : undefined,
      select: {
        userId: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
