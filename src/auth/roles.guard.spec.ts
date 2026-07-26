import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  const createContext = (user?: { id: string }) =>
    ({
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
      getHandler: () => undefined,
      getClass: () => undefined,
    }) as unknown as ExecutionContext;

  const createGuard = (
    roles: UserRole[] | undefined,
    profile: { role: UserRole } | null,
  ) => {
    const reflector = {
      getAllAndOverride: () => roles,
    } as unknown as Reflector;
    const prisma = {
      profile: { findUnique: jest.fn().mockResolvedValue(profile) },
    } as unknown as PrismaService;
    return new RolesGuard(reflector, prisma);
  };

  it('allows routes without required roles', async () => {
    const guard = createGuard(undefined, null);
    await expect(guard.canActivate(createContext())).resolves.toBe(true);
  });

  it('rejects unauthenticated requests', async () => {
    const guard = createGuard([UserRole.ADMIN], null);
    await expect(guard.canActivate(createContext())).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects users without the required role', async () => {
    const guard = createGuard([UserRole.ADMIN], { role: UserRole.CUSTOMER });
    await expect(
      guard.canActivate(createContext({ id: 'user-1' })),
    ).rejects.toThrow(ForbiddenException);
  });

  it('allows admins', async () => {
    const guard = createGuard([UserRole.ADMIN], { role: UserRole.ADMIN });
    await expect(
      guard.canActivate(createContext({ id: 'user-1' })),
    ).resolves.toBe(true);
  });
});
