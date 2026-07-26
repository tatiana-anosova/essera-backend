import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';

import type { Request } from 'express';
import type { createRemoteJWKSet } from 'jose';

type Jwks = ReturnType<typeof createRemoteJWKSet>;

const importJose = () => import('jose');

const DEFAULT_AUDIENCE = 'authenticated';
const ALGORITHMS = ['ES256', 'RS256'];

/**
 * Verifies Supabase access tokens locally against the project's JWKS, which is how Supabase
 * recommends validating tokens once a project uses asymmetric JWT signing keys: the public key
 * is fetched (and cached) from the project, so no round trip to the Auth server is needed per
 * request and no signing secret ever lives in this service.
 */
@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  private readonly logger = new Logger(SupabaseAuthGuard.name);
  private readonly issuer: string;
  private readonly jwksUrl: string;
  private jwksPromise?: Promise<Jwks>;

  constructor() {
    const baseUrl = (process.env.SUPABASE_URL ?? '').trim().replace(/\/+$/, '');

    if (!baseUrl) {
      throw new Error(
        'SUPABASE_URL is required: it is the expected token issuer and the source of the JWKS URL',
      );
    }

    this.issuer = `${baseUrl}/auth/v1`;
    this.jwksUrl = `${baseUrl}/auth/v1/.well-known/jwks.json`;
  }

  private getJwks(): Promise<Jwks> {
    this.jwksPromise ??= importJose().then(({ createRemoteJWKSet }) =>
      createRemoteJWKSet(new URL(this.jwksUrl)),
    );

    return this.jwksPromise;
  }

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request>();
    const auth = req.headers.authorization;

    if (!auth?.startsWith('Bearer ')) {
      throw new UnauthorizedException('No bearer token');
    }

    const token = auth.slice(7);
    const { jwtVerify } = await importJose();

    try {
      const { payload } = await jwtVerify(token, await this.getJwks(), {
        issuer: this.issuer,
        audience: process.env.SUPABASE_JWT_AUD ?? DEFAULT_AUDIENCE,
        algorithms: ALGORITHMS,
      });

      req.user = {
        id: payload.sub as string,
        email: payload.email as string | undefined,
      };

      return true;
    } catch (error) {
      // Never log the token — only what is needed to tell the failure modes apart.
      this.logger.warn(
        `Token verification failed (issuer=${this.issuer} jwks=${this.jwksUrl}): ` +
          `${error instanceof Error ? `${error.name}: ${error.message}` : String(error)}`,
      );

      throw new UnauthorizedException('Invalid token');
    }
  }
}
