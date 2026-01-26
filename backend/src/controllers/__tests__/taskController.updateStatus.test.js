jest.mock('../../db', () => ({
  connect: jest.fn()
}));

jest.mock('../../utils/auditLogger', () => jest.fn());
jest.mock('../../utils/notificationHelper', () => ({ createNotification: jest.fn() }));

const db = require('../../db');
const taskController = require('../taskController');

describe('updateTaskStatus', () => {
  it('allows creator to cancel (Đã hủy)', async () => {
    const mockClient = {
      query: jest.fn(),
      release: jest.fn()
    };

    // BEGIN
    mockClient.query.mockImplementation(async (sql, params) => {
      if (sql && sql.toString().includes('BEGIN')) return { rows: [] };
      if (sql && sql.toString().includes('SELECT * FROM tasks')) {
        return { rows: [{ id: 1, assignee_id: 2, creator_id: 1, title: 't1' }] };
      }
      // UPDATE/other queries
      return { rows: [] };
    });

    db.connect.mockResolvedValue(mockClient);

    const req = { params: { id: '1' }, body: { status: 'Đã hủy', details: 'test' }, user: { id: 1, fullName: 'Creator', permissions: [] } };
    const res = { status: jest.fn(() => res), json: jest.fn() };

    await taskController.updateTaskStatus(req, res);

    expect(mockClient.query).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String), status: 'Đã hủy' }));
  });
});
