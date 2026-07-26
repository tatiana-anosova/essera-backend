import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { GenerateKeyPairResult, JWK } from 'jose';
import { SupabaseAuthGuard } from './supabase-auth.guard';

const SUPABASE_URL = 'https://project.supabase.co';
const JWKS_URL = `${SUPABASE_URL}/auth/v1/.well-known/jwks.json`;
const KID = 'signing-key-1';

const context = (headers: Record<string, string>) => {
  const req = { headers } as {
    headers: Record<string, string>;
    user?: unknown;
  };

  return {
    ctx: {
      switchToHttp: () => ({ getRequest: () => req }),
    } as unknown as ExecutionContext,
    req,
  };
};

const validClaims = {
  sub: '00000000-0000-0000-0000-000000000001',
  email: 'admin@essera.com',
  iss: `${SUPABASE_URL}/auth/v1`,
  aud: 'authenticated',
};

describe('SupabaseAuthGuard', () => {
  let guard: SupabaseAuthGuard;
  let keys: GenerateKeyPairResult;
  let publicJwk: JWK;
  let fetchSpy: jest.SpiedFunction<typeof fetch>;

  const sign = async (
    claims: Record<string, unknown> = validClaims,
    key = keys.privateKey,
  ) => {
    const { SignJWT } = await import('jose');

    return new SignJWT(claims)
      .setProtectedHeader({ alg: 'ES256', kid: KID })
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(key);
  };

  beforeAll(async () => {
    const { generateKeyPair, exportJWK } = await import('jose');

    keys = await generateKeyPair('ES256', { extractable: true });
    publicJwk = await exportJWK(keys.publicKey);
  });

  beforeEach(() => {
    process.env.SUPABASE_URL = SUPABASE_URL;

    fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(
          JSON.stringify({ keys: [{ ...publicJwk, alg: 'ES256', kid: KID }] }),
          { headers: { 'content-type': 'application/json' } },
        ),
      );

    guard = new SupabaseAuthGuard();
    jest.spyOn(guard['logger'], 'warn').mockImplementation(() => {});
  });

  afterEach(() => fetchSpy.mockRestore());

  it('accepts a token signed by the project signing key and exposes the user', async () => {
    const { ctx, req } = context({ authorization: `Bearer ${await sign()}` });

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(req.user).toEqual({ id: validClaims.sub, email: validClaims.email });
    const requested = fetchSpy.mock.calls[0][0] as { toString(): string };
    expect(requested.toString()).toBe(JWKS_URL);
  });

  it('fetches the JWKS once and reuses it across requests', async () => {
    const first = context({ authorization: `Bearer ${await sign()}` });
    const second = context({ authorization: `Bearer ${await sign()}` });

    await guard.canActivate(first.ctx);
    await guard.canActivate(second.ctx);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('rejects a token signed by a key that is not in the JWKS', async () => {
    const { generateKeyPair } = await import('jose');
    const other = await generateKeyPair('ES256', { extractable: true });
    const { ctx } = context({
      authorization: `Bearer ${await sign(validClaims, other.privateKey)}`,
    });

    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects a token issued by another Supabase project', async () => {
    const token = await sign({
      ...validClaims,
      iss: 'https://other.supabase.co/auth/v1',
    });
    const { ctx } = context({ authorization: `Bearer ${token}` });

    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects a token whose audience is not authenticated', async () => {
    const { ctx } = context({
      authorization: `Bearer ${await sign({ ...validClaims, aud: 'anon' })}`,
    });

    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects an expired token', async () => {
    const { SignJWT } = await import('jose');
    const token = await new SignJWT(validClaims)
      .setProtectedHeader({ alg: 'ES256', kid: KID })
      .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
      .sign(keys.privateKey);

    const { ctx } = context({ authorization: `Bearer ${token}` });

    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects a symmetric HS256 token', async () => {
    const { SignJWT } = await import('jose');
    const token = await new SignJWT(validClaims)
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode('legacy-jwt-secret'));

    const { ctx } = context({ authorization: `Bearer ${token}` });

    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects a request without a bearer token', async () => {
    const { ctx } = context({});

    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('refuses to start without SUPABASE_URL rather than skipping issuer validation', () => {
    delete process.env.SUPABASE_URL;

    expect(() => new SupabaseAuthGuard()).toThrow(/SUPABASE_URL is required/);
  });
});
