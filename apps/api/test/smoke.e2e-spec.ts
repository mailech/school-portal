import request from 'supertest';

/**
 * Black-box smoke test against a RUNNING API (default http://localhost:4000).
 * Start the stack first:  pnpm dev:api  (with the DB migrated + seeded), then:
 *   pnpm --filter @app/api test:smoke
 * It is read-only + auth-only, so it never mutates demo data.
 */
const API = process.env.SMOKE_API_URL ?? 'http://localhost:4000';
const agent = () => request(API);

describe('API smoke (requires the API to be running)', () => {
  let cookies: string[] = [];
  let adminCookies: string[] = [];

  it('health check is ok', async () => {
    const res = await agent().get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.db).toBe('up');
  });

  it('rejects unauthenticated access with 401', async () => {
    const res = await agent().get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('logs in the accountant and sets httpOnly cookies', async () => {
    const res = await agent()
      .post('/api/auth/login')
      .send({ email: 'accountant@school.test', password: 'Account@12345' });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('ACCOUNTANT');
    cookies = res.headers['set-cookie'] as unknown as string[];
    expect(cookies.join(';')).toContain('access_token');
    expect(cookies.join(';')).toContain('HttpOnly');
  });

  it('rejects a bad password with a typed 401', async () => {
    const res = await agent()
      .post('/api/auth/login')
      .send({ email: 'accountant@school.test', password: 'wrong-password' });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('returns the dues board with status counts', async () => {
    const res = await agent().get('/api/dues/board').set('Cookie', cookies);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('counts');
    expect(res.body.counts).toHaveProperty('OVERDUE');
    expect(Array.isArray(res.body.rows)).toBe(true);
  });

  it('enforces RBAC: accountant cannot list staff (403)', async () => {
    const res = await agent().get('/api/users').set('Cookie', cookies);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('logs in the admin', async () => {
    const res = await agent()
      .post('/api/auth/login')
      .send({ email: 'admin@school.test', password: 'Admin@12345' });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('ADMIN');
    adminCookies = res.headers['set-cookie'] as unknown as string[];
  });

  it('admin can list staff (200)', async () => {
    const res = await agent().get('/api/users').set('Cookie', adminCookies);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('validates input: fee upsert with a non-summing total is rejected (admin)', async () => {
    const res = await agent()
      .put('/api/fees')
      .set('Cookie', adminCookies)
      .send({
        schoolClassId: 'nonexistent',
        totalAmount: 100,
        installments: [{ installmentNumber: 1, amount: 40, dueDate: '2026-08-01' }],
      });
    // 400 (validation) — the installments don't sum to the total.
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_FAILED');
    expect(res.body.details?.[0]?.message).toContain('sum');
  });
});
