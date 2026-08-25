import { ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { SupabaseAuthGuard } from './supabase-auth.guard';

/**
 * Lets a request through without a token, but still verifies one when it is
 * sent, so a route can serve guests and attach `req.user` for signed-in buyers.
 * A token that is present and invalid is still rejected.
 */
@Injectable()
export class OptionalSupabaseAuthGuard extends SupabaseAuthGuard {
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request>();

    if (!req.headers.authorization) return true;

    return super.canActivate(ctx);
  }
}
