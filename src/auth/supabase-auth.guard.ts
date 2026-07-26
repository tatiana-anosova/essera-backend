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

/**
 * Supabase signs access tokens either with the project's legacy HS256 JWT secret or, once the
 * project has migrated to asymmetric JWT signing keys, with a key published in the project's
 * JWKS. The algorithm advertised in the token header decides which one applies — verifying an
 * HS256 token against the JWKS always fails with "no applicable key found".
 */
@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  private readonly logger = new Logger(SupabaseAuthGuard.name);
  private jwksPromise?: Promise<Jwks>;

  private get jwksUrl(): string {
    const configured = process.env.SUPABASE_JWKS_URL;
    if (configured) return configured;

    const base = (process.env.SUPABASE_URL ?? '').replace(/\/+$/, '');
    return `${base}/auth/v1/.well-known/jwks.json`;
  }

  private get issuer(): string | undefined {
    const base = (process.env.SUPABASE_URL ?? '').replace(/\/+$/, '');
    return base ? `${base}/auth/v1` : undefined;
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

    if (!auth || typeof auth !== 'string' || !auth.startsWith('Bearer ')) {
      throw new UnauthorizedException('No bearer token');
    }

    const token = auth.slice(7);
    const { decodeProtectedHeader, jwtVerify } = await importJose();

    let alg: string | undefined;
    let kid: string | undefined;

    try {
      ({ alg, kid } = decodeProtectedHeader(token));

      const options = {
        issuer: this.issuer,
        audience: process.env.SUPABASE_JWT_AUD ?? DEFAULT_AUDIENCE,
      };

      const { payload } = alg?.startsWith('HS')
        ? await jwtVerify(token, this.hmacSecret(), options)
        : await jwtVerify(token, await this.getJwks(), options);

      req.user = {
        id: payload.sub as string,
        email: payload.email as string | undefined,
      };

      return true;
    } catch (error) {
      // Never log the token itself — only what is needed to tell the failure modes apart.
      this.logger.warn(
        `Token verification failed (alg=${alg ?? 'unknown'} kid=${kid ?? 'none'} ` +
          `issuer=${this.issuer ?? 'unset'} jwks=${this.jwksUrl}): ` +
          `${error instanceof Error ? `${error.name}: ${error.message}` : String(error)}`,
      );

      throw new UnauthorizedException('Invalid token');
    }
  }

  private hmacSecret(): Uint8Array {
    const secret = process.env.SUPABASE_JWT_SECRET;

    if (!secret) {
      throw new Error(
        'SUPABASE_JWT_SECRET is not set; it is required to verify HS256 Supabase tokens',
      );
    }

    return new TextEncoder().encode(secret);
  }
}
