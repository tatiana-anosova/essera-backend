import { Test, TestingModule } from '@nestjs/testing';
import type { Request } from 'express';
import { UserRole } from '@prisma/client';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

const request = (user: { id: string; email?: string }) =>
  ({ user }) as unknown as Request;

describe('UsersController', () => {
  const usersService = { getProfile: jest.fn() };
  let controller: UsersController;

  beforeEach(async () => {
    usersService.getProfile.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: usersService }],
    })
      // The real guard reads the Supabase configuration as it is constructed.
      .overrideGuard(SupabaseAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<UsersController>(UsersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('returns the stored profile of the authenticated user', async () => {
    usersService.getProfile.mockResolvedValue({
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      role: UserRole.ADMIN,
    });

    await expect(
      controller.me(request({ id: 'user-1', email: 'token@example.com' })),
    ).resolves.toEqual({
      id: 'user-1',
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      role: UserRole.ADMIN,
    });
  });

  it('falls back to the token email and the customer role without a profile', async () => {
    usersService.getProfile.mockResolvedValue(null);

    await expect(
      controller.me(request({ id: 'user-2', email: 'token@example.com' })),
    ).resolves.toEqual({
      id: 'user-2',
      firstName: '',
      lastName: '',
      email: 'token@example.com',
      role: UserRole.CUSTOMER,
    });
  });
});
