import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { SupabaseAuthGuard } from './supabase-auth.guard';

const SUPABASE_URL = 'https://project.supabase.co';
const JWT_SECRET = 'super-secret-legacy-jwt-secret-value';

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

const signHs256 = async (
  claims: Record<string, unknown>,
  secret = JWT_SECRET,
) => {
  const { SignJWT } = await import('jose');

  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode(secret));
};

const validClaims = {
  sub: '00000000-0000-0000-0000-000000000001',
  email: 'admin@essera.com',
  iss: `${SUPABASE_URL}/auth/v1`,
  aud: 'authenticated',
};

describe('SupabaseAuthGuard', () => {
  let guard: SupabaseAuthGuard;

  beforeEach(() => {
    process.env.SUPABASE_URL = SUPABASE_URL;
    process.env.SUPABASE_JWT_SECRET = JWT_SECRET;
    delete process.env.SUPABASE_JWKS_URL;

    guard = new SupabaseAuthGuard();
    jest.spyOn(guard['logger'], 'warn').mockImplementation(() => {});
  });

  it('accepts a legacy HS256 Supabase token and exposes the user', async () => {
    const { ctx, req } = context({
      authorization: `Bearer ${await signHs256(validClaims)}`,
    });

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(req.user).toEqual({ id: validClaims.sub, email: validClaims.email });
  });

  it('rejects an HS256 token signed with a different secret', async () => {
    const token = await signHs256(validClaims, 'not-the-project-secret');
    const { ctx } = context({ authorization: `Bearer ${token}` });

    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects a token issued by another Supabase project', async () => {
    const token = await signHs256({
      ...validClaims,
      iss: 'https://other.supabase.co/auth/v1',
    });
    const { ctx } = context({ authorization: `Bearer ${token}` });

    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects a token whose audience is not authenticated', async () => {
    const token = await signHs256({ ...validClaims, aud: 'anon' });
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

  it('verifies asymmetric tokens against the configured JWKS URL', async () => {
    process.env.SUPABASE_JWKS_URL =
      'https://project.supabase.co/custom/jwks.json';

    const { SignJWT, generateKeyPair, exportJWK } = await import('jose');
    const { privateKey, publicKey } = await generateKeyPair('ES256', {
      extractable: true,
    });
    const jwk = await exportJWK(publicKey);

    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ keys: [{ ...jwk, alg: 'ES256', kid: 'key-1' }] }),
        {
          headers: { 'content-type': 'application/json' },
        },
      ),
    );

    const token = await new SignJWT(validClaims)
      .setProtectedHeader({ alg: 'ES256', kid: 'key-1' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(privateKey);

    const { ctx, req } = context({ authorization: `Bearer ${token}` });

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(req.user).toEqual({ id: validClaims.sub, email: validClaims.email });
    expect(`${fetchSpy.mock.calls[0][0] as URL}`).toBe(
      process.env.SUPABASE_JWKS_URL,
    );

    fetchSpy.mockRestore();
  });
});
