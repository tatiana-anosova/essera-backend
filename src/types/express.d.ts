import 'express';
import type { UserRole } from '@prisma/client';

declare module 'express-serve-static-core' {
  interface Request {
    user?: { id: string; email?: string; role?: UserRole };
  }
}
