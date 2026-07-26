import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );

    if (!requiredRoles?.length) return true;

    const req = ctx.switchToHttp().getRequest<Request>();
    const user = req.user;

    if (!user?.id) throw new UnauthorizedException('No authenticated user');

    const profile = await this.prisma.profile.findUnique({
      where: { userId: user.id },
      select: { role: true },
    });

    if (!profile || !requiredRoles.includes(profile.role)) {
      throw new ForbiddenException('Insufficient role');
    }

    user.role = profile.role;

    return true;
  }
}
