const request = require('supertest');

describe('PATCH /api/tasks/:id/status integration', () => {
  let serverModule;
  beforeAll(() => {
    jest.resetModules();

    // Mock DB pool/client used by controllers
    const mockClient = {
      query: jest.fn(async (q, params) => {
        if (/BEGIN|COMMIT|ROLLBACK/.test(q)) return Promise.resolve();
        if (/INSERT INTO tasks/.test(q)) {
          return Promise.resolve({ rows: [{ id: 100, title: 'Test task from integration', creator_id: 1, assignee_id: 1, status: 'Mới tạo' }] });
        }
        if (/SELECT \* FROM tasks WHERE id = \$1/.test(q)) {
          const id = (params && params[0]) || 100;
          return Promise.resolve({ rows: [{ id, title: 'Test task from integration', creator_id: 1, assignee_id: 1, status: 'Mới tạo' }] });
        }
        // Generic fallback
        return Promise.resolve({ rows: [] });
      }),
      release: jest.fn()
    };

    const mockPool = {
      connect: jest.fn().mockResolvedValue(mockClient),
      query: jest.fn((q, params) => mockClient.query(q, params))
    };

    jest.mock('../../src/db', () => mockPool);

    // Mock auth middleware to attach a test user with edit/delete permission
    jest.mock('../../src/middlewares/authMiddleware', () => ({
      verifyTokenOptional: (req, res, next) => { req.user = { id: 1, fullName: 'Test User', permissions: ['create_task','edit_delete_task'] }; next(); },
      verifyToken: (req, res, next) => { req.user = { id: 1, fullName: 'Test User', permissions: ['create_task','edit_delete_task'] }; next(); },
      hasPermission: (required) => (req, res, next) => { return next(); },
      hasAnyPermission: (required) => (req, res, next) => { return next(); }
    }));

    // Mock audit logger and notifications (no-op)
    jest.mock('../../src/utils/auditLogger', () => jest.fn());
    jest.mock('../../src/utils/notificationHelper', () => ({ createNotification: jest.fn() }));

    // Limit mounted routes during this integration test to avoid requiring
    // unrelated route modules that may depend on environment or DB.
    jest.mock('../../src/routes', () => {
      const express = require('express');
      const router = express.Router();
      try {
        const taskRoutes = require('../../src/routes/taskRoutes');
        if (taskRoutes) router.use('/tasks', taskRoutes);
      } catch (e) {
        // best-effort: if taskRoutes can't be required, return empty router
      }
      return router;
    });

    // Some route modules are required directly by server.js (e.g. authRoutes).
    // Mock them to simple empty routers so server can initialize for the test.
    jest.mock('../../src/routes/authRoutes', () => {
      const express = require('express');
      return express.Router();
    });

    serverModule = require('../../server');
  });

  afterAll((done) => {
    try {
      if (serverModule && serverModule.server && serverModule.server.close) {
        serverModule.server.close(done);
      } else done();
    } catch (e) { done(); }
  });

  test('creator or edit_delete_task can cancel a task', async () => {
    const agent = request(serverModule.app);

    // Create a task as the mocked user
    const createRes = await agent
      .post('/api/tasks')
      .send({ title: 'Integration test', description: 'auto', assignee_id: 1, due_date: '2026-01-30', priority: 'Trung bình' })
      .expect(201);

    const id = createRes.body.id;

    // Attempt to cancel
    const patchRes = await agent
      .patch(`/api/tasks/${id}/status`)
      .send({ status: 'Đã hủy', details: 'cancel from integration test' })
      .expect(200);

    expect(patchRes.body).toHaveProperty('status', 'Đã hủy');
  });
});
