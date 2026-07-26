import {
  CanActivate,
  ExecutionContext,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';

import type { Request } from 'express';
import type { createRemoteJWKSet } from 'jose';

type Jwks = ReturnType<typeof createRemoteJWKSet>;

const importJose = () => import('jose');

const DEFAULT_AUDIENCE = 'authenticated';
const SYMMETRIC_ALG = 'HS256';
const ASYMMETRIC_ALGS = ['ES256', 'RS256'];

/** A server-side misconfiguration — not something the caller's token can be blamed for. */
class ConfigurationError extends Error {}

/**
 * Supabase signs access tokens either with the project's legacy HS256 JWT secret or, once the
 * project has migrated to asymmetric JWT signing keys, with a key published in the project's
 * JWKS. The algorithm advertised in the token header decides which one applies — verifying an
 * HS256 token against the JWKS always fails with "no applicable key found".
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
    this.jwksUrl =
      process.env.SUPABASE_JWKS_URL ??
      `${baseUrl}/auth/v1/.well-known/jwks.json`;
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

      const { payload } =
        alg === SYMMETRIC_ALG
          ? await jwtVerify(token, this.hmacSecret(), {
              ...options,
              algorithms: [SYMMETRIC_ALG],
            })
          : await jwtVerify(token, await this.assertAsymmetric(alg), {
              ...options,
              algorithms: ASYMMETRIC_ALGS,
            });

      req.user = {
        id: payload.sub as string,
        email: payload.email as string | undefined,
      };

      return true;
    } catch (error) {
      // Never log the token or the signing secret — only what tells the failure modes apart.
      this.logger.warn(
        `Token verification failed (alg=${alg ?? 'unknown'} kid=${kid ?? 'none'} ` +
          `issuer=${this.issuer} jwks=${this.jwksUrl}): ` +
          `${error instanceof Error ? `${error.name}: ${error.message}` : String(error)}`,
      );

      if (error instanceof ConfigurationError) {
        throw new InternalServerErrorException(
          'Token verification is not configured',
        );
      }

      throw new UnauthorizedException('Invalid token');
    }
  }

  private async assertAsymmetric(alg: string | undefined): Promise<Jwks> {
    if (!alg || !ASYMMETRIC_ALGS.includes(alg)) {
      throw new Error(`Unsupported token algorithm: ${alg ?? 'none'}`);
    }

    return this.getJwks();
  }

  private hmacSecret(): Uint8Array {
    const secret = process.env.SUPABASE_JWT_SECRET;

    if (!secret) {
      throw new ConfigurationError(
        'SUPABASE_JWT_SECRET is not set; it is required to verify legacy HS256 Supabase tokens',
      );
    }

    return new TextEncoder().encode(secret);
  }
}
