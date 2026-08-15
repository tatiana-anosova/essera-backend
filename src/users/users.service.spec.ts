import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';

const prisma = {
  profile: {
    findUnique: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
  },
};

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAllForAdmin', () => {
    it('reads every profile, newest first, and nothing beyond the listed columns', async () => {
      await service.findAllForAdmin();

      expect(prisma.profile.findMany).toHaveBeenCalledWith({
        where: undefined,
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
    });

    it('matches the search term against email and both names, case-insensitively', async () => {
      await service.findAllForAdmin('  Tati  ');

      const [{ where }] = prisma.profile.findMany.mock.calls.at(0) as [
        { where: { OR: unknown[] } },
      ];

      expect(where.OR).toEqual([
        { email: { contains: 'Tati', mode: 'insensitive' } },
        { firstName: { contains: 'Tati', mode: 'insensitive' } },
        { lastName: { contains: 'Tati', mode: 'insensitive' } },
      ]);
    });

    it('treats a blank search as no search at all', async () => {
      await service.findAllForAdmin('   ');

      const [call] = prisma.profile.findMany.mock.calls.at(0) as [
        { where?: unknown },
      ];

      expect(call).toHaveProperty('where', undefined);
    });
  });
});
