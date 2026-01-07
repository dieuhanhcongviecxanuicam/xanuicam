const request = require('supertest');

// We'll isolate module loading so we can mock pool before controllers are required
describe('POST /api/computer-configs/export integration', () => {
  let serverModule;
  beforeAll(() => {
    // Mock the DB pool to avoid real DB access
    jest.resetModules();
    const mockPool = {
      query: jest.fn((q, params) => {
        // Simple heuristic: if query contains 'WHERE u.id = ANY' return two users
        if (/WHERE u.id = ANY/.test(q) || /FROM users u/.test(q)) {
          return Promise.resolve({ rows: [
            { id: 1, full_name: 'Test User 1', username: 'test1', config: { hostname: 'host1', os: 'win' } },
            { id: 2, full_name: 'Test User 2', username: 'test2', config: { hostname: 'host2' } }
          ] });
        }
        return Promise.resolve({ rows: [] });
      })
    };
    jest.mock('../src/db', () => mockPool);
    // require server after mocking db
    serverModule = require('../server');
  });

  afterAll((done) => {
    try {
      if (serverModule && serverModule.server && serverModule.server.close) {
        serverModule.server.close(done);
      } else done();
    } catch (e) { done(); }
  });

  test('returns PDF with proper headers for selected users', async () => {
    const res = await request(serverModule.app)
      .post('/api/computer-configs/export')
      .send({ userIds: [1,2], format: 'pdf' })
      .set('Accept', 'application/pdf')
      .expect(200);

    expect(res.headers['content-type']).toMatch(/application\/pdf/);
    expect(res.headers['content-disposition']).toMatch(/xanuicam_computer/);
    // body should be non-empty
    expect(res.body && res.body.length).toBeGreaterThan(0);
  }, 20000);
});
