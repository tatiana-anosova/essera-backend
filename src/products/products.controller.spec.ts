import { Test, TestingModule } from '@nestjs/testing';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { RolesGuard } from '../auth/roles.guard';

const allow = { canActivate: () => true };

const productsService = {
  findAll: jest.fn(),
  findOne: jest.fn(),
  findBySlug: jest.fn(),
};

describe('ProductsController', () => {
  let controller: ProductsController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [{ provide: ProductsService, useValue: productsService }],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue(allow)
      .overrideGuard(RolesGuard)
      .useValue(allow)
      .compile();

    controller = module.get(ProductsController);
  });

  it('serves the storefront reads from the public service methods', async () => {
    productsService.findAll.mockResolvedValue([]);
    productsService.findOne.mockResolvedValue({ id: 1 });
    productsService.findBySlug.mockResolvedValue({ slug: 'white-bra' });

    await controller.findAll();
    await controller.findOne(1);
    await controller.findBySlug('white-bra');

    expect(productsService.findAll).toHaveBeenCalledWith();
    expect(productsService.findOne).toHaveBeenCalledWith(1);
    expect(productsService.findBySlug).toHaveBeenCalledWith('white-bra');
  });

  it('no longer exposes product mutations; they moved to /admin/products', () => {
    expect(controller).not.toHaveProperty('create');
    expect(controller).not.toHaveProperty('update');
    expect(controller).not.toHaveProperty('remove');
  });
});
