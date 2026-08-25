import { Test, TestingModule } from '@nestjs/testing';
import { ProductStatus, UserRole } from '@prisma/client';
import { AdminProductsController } from './admin-products.controller';
import { BlankAsUnsetPipe } from '../common/blank-as-unset.pipe';
import { ProductsService } from './products.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { ROLES_KEY } from '../auth/roles.decorator';
import { CreateProductDto, UpdateProductDto } from './dto';

const allow = { canActivate: () => true };

const productsService = {
  findAllForAdmin: jest.fn(),
  findOneForAdmin: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
  publish: jest.fn(),
  archive: jest.fn(),
  restore: jest.fn(),
};

describe('AdminProductsController', () => {
  let controller: AdminProductsController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminProductsController],
      providers: [{ provide: ProductsService, useValue: productsService }],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue(allow)
      .overrideGuard(RolesGuard)
      .useValue(allow)
      .compile();

    controller = module.get(AdminProductsController);
  });

  it('is guarded and restricted to admins', () => {
    const guards = Reflect.getMetadata(
      '__guards__',
      AdminProductsController,
    ) as unknown[];

    expect(guards).toEqual([SupabaseAuthGuard, RolesGuard]);
    expect(Reflect.getMetadata(ROLES_KEY, AdminProductsController)).toEqual([
      UserRole.ADMIN,
    ]);
  });

  it('lists every status, optionally filtered', async () => {
    productsService.findAllForAdmin.mockResolvedValue([]);

    await controller.findAll();
    await controller.findAll(ProductStatus.ARCHIVED);

    expect(productsService.findAllForAdmin).toHaveBeenNthCalledWith(
      1,
      undefined,
    );
    expect(productsService.findAllForAdmin).toHaveBeenNthCalledWith(
      2,
      ProductStatus.ARCHIVED,
    );
  });

  it('reads an empty status query as no filter, and keeps real values', () => {
    const pipe = new BlankAsUnsetPipe();

    expect(pipe.transform('')).toBeUndefined();
    expect(pipe.transform(undefined)).toBeUndefined();
    expect(pipe.transform(ProductStatus.DRAFT)).toBe(ProductStatus.DRAFT);
    expect(pipe.transform('nonsense')).toBe('nonsense');
  });

  it('reads, creates, updates and deletes through the admin service methods', async () => {
    const dto = { title: 'White bra' };

    await controller.findOne(1);
    await controller.create(dto as CreateProductDto);
    await controller.update(1, dto as UpdateProductDto);
    await controller.remove(1);

    expect(productsService.findOneForAdmin).toHaveBeenCalledWith(1);
    expect(productsService.create).toHaveBeenCalledWith(dto);
    expect(productsService.update).toHaveBeenCalledWith(1, dto);
    expect(productsService.remove).toHaveBeenCalledWith(1);
  });

  it.each(['publish', 'archive', 'restore'] as const)(
    'routes %s to the service',
    async (action) => {
      await controller[action](1);

      expect(productsService[action]).toHaveBeenCalledWith(1);
    },
  );
});
