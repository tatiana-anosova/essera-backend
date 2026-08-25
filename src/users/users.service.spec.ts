import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';

describe('UsersService', () => {
  const profile = { findUnique: jest.fn() };
  let service: UsersService;

  beforeEach(async () => {
    profile.findUnique.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: { profile } },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('reads the profile of the given user', async () => {
    profile.findUnique.mockResolvedValue({ firstName: 'Ada' });

    await expect(service.getProfile('user-1')).resolves.toEqual({
      firstName: 'Ada',
    });

    const [{ where }] = profile.findUnique.mock.calls[0] as [
      { where: { userId: string } },
    ];

    expect(where).toEqual({ userId: 'user-1' });
  });
});
