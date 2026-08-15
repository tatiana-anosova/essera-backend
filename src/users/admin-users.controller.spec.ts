import { Test, TestingModule } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import { ROLES_KEY } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { AdminUsersController } from './admin-users.controller';
import { UsersService } from './users.service';

const allow = { canActivate: () => true };

const usersService = { findAllForAdmin: jest.fn() };

describe('AdminUsersController', () => {
  let controller: AdminUsersController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminUsersController],
      providers: [{ provide: UsersService, useValue: usersService }],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue(allow)
      .overrideGuard(RolesGuard)
      .useValue(allow)
      .compile();

    controller = module.get(AdminUsersController);
  });

  it('is guarded, and only for admins', () => {
    const guards = Reflect.getMetadata(
      '__guards__',
      AdminUsersController,
    ) as unknown[];

    expect(guards).toEqual([SupabaseAuthGuard, RolesGuard]);
    expect(Reflect.getMetadata(ROLES_KEY, AdminUsersController)).toEqual([
      UserRole.ADMIN,
    ]);
  });

  it('lists the profiles, with the search term when there is one', async () => {
    usersService.findAllForAdmin.mockResolvedValue([]);

    await controller.findAll();
    expect(usersService.findAllForAdmin).toHaveBeenCalledWith(undefined);

    await controller.findAll('tati');
    expect(usersService.findAllForAdmin).toHaveBeenCalledWith('tati');
  });
});
