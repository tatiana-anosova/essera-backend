import { Test, TestingModule } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
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

  it('reads the profile of the given user', async () => {
    prisma.profile.findUnique.mockResolvedValue({ firstName: 'Ada' });

    await expect(service.getProfile('user-1')).resolves.toEqual({
      firstName: 'Ada',
    });

    const [{ where }] = prisma.profile.findUnique.mock.calls[0] as [
      { where: { userId: string } },
    ];

    expect(where).toEqual({ userId: 'user-1' });
  });

  describe('findAllForAdmin', () => {
    it('reads every profile, newest first, and nothing beyond the listed columns', async () => {
      await service.findAllForAdmin();

      expect(prisma.profile.findMany).toHaveBeenCalledWith({
        where: { role: undefined, OR: undefined },
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

      const [{ where }] = prisma.profile.findMany.mock.calls.at(0) as [
        { where: { OR?: unknown } },
      ];

      expect(where.OR).toBeUndefined();
    });

    it('filters on the role, alongside the search rather than instead of it', async () => {
      await service.findAllForAdmin('tati', UserRole.ADMIN);

      const [{ where }] = prisma.profile.findMany.mock.calls.at(0) as [
        { where: { role?: UserRole; OR?: unknown[] } },
      ];

      expect(where.role).toBe(UserRole.ADMIN);
      expect(where.OR).toHaveLength(3);
    });
  });
});
