import { Test, TestingModule } from '@nestjs/testing';
import { DetailsController } from './details.controller';
import { DetailsService } from './details.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { RolesGuard } from '../auth/roles.guard';

const allow = { canActivate: () => true };

const detailsService = {
  getByProductId: jest.fn(),
  getBySlug: jest.fn(),
};

describe('DetailsController', () => {
  let controller: DetailsController;

  beforeEach(async () => {
    jest.clearAllMocks();
    detailsService.getByProductId.mockResolvedValue([
      { key: 'fabric', title: 'Fabric', content: 'Silk' },
    ]);
    detailsService.getBySlug.mockResolvedValue([
      { key: 'fabric', title: 'Fabric', content: 'Silk' },
    ]);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DetailsController],
      providers: [{ provide: DetailsService, useValue: detailsService }],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue(allow)
      .overrideGuard(RolesGuard)
      .useValue(allow)
      .compile();

    controller = module.get(DetailsController);
  });

  it('serves the public reads through the status-checked service methods', async () => {
    await expect(controller.getByProductId(1)).resolves.toEqual([
      { key: 'fabric', title: 'Fabric', content: 'Silk' },
    ]);
    await expect(controller.getBySlug('white-bra')).resolves.toEqual([
      { key: 'fabric', title: 'Fabric', content: 'Silk' },
    ]);

    expect(detailsService.getByProductId).toHaveBeenCalledWith(1);
    expect(detailsService.getBySlug).toHaveBeenCalledWith('white-bra');
  });
});
