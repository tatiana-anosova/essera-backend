import { Test, TestingModule } from '@nestjs/testing';
import { OrderStatus, UserRole } from '@prisma/client';
import { ROLES_KEY } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { AdminOrdersController } from './admin-orders.controller';
import { OrdersService } from './orders.service';

const allow = { canActivate: () => true };

const ordersService = {
  findAllForAdmin: jest.fn(),
  findOneForAdmin: jest.fn(),
};

describe('AdminOrdersController', () => {
  let controller: AdminOrdersController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminOrdersController],
      providers: [{ provide: OrdersService, useValue: ordersService }],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue(allow)
      .overrideGuard(RolesGuard)
      .useValue(allow)
      .compile();

    controller = module.get(AdminOrdersController);
  });

  it('is guarded, and only for admins', () => {
    const guards = Reflect.getMetadata(
      '__guards__',
      AdminOrdersController,
    ) as unknown[];

    expect(guards).toEqual([SupabaseAuthGuard, RolesGuard]);
    expect(Reflect.getMetadata(ROLES_KEY, AdminOrdersController)).toEqual([
      UserRole.ADMIN,
    ]);
  });

  it('lists the orders, passing on the status filter and the search term', async () => {
    ordersService.findAllForAdmin.mockResolvedValue([]);

    await controller.findAll();
    expect(ordersService.findAllForAdmin).toHaveBeenCalledWith(
      undefined,
      undefined,
    );

    await controller.findAll(OrderStatus.PAID, 'ada');
    expect(ordersService.findAllForAdmin).toHaveBeenCalledWith(
      OrderStatus.PAID,
      'ada',
    );
  });

  it('reads one order by id', async () => {
    ordersService.findOneForAdmin.mockResolvedValue({ id: 'order-1' });

    await expect(controller.findOne('order-1')).resolves.toEqual({
      id: 'order-1',
    });
    expect(ordersService.findOneForAdmin).toHaveBeenCalledWith('order-1');
  });
});
