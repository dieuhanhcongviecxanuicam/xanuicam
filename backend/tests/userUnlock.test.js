const userController = require('../src/controllers/userController');

jest.mock('../src/db', () => ({
  connect: jest.fn()
}));

jest.mock('../src/utils/auditLogger', () => jest.fn());

const pool = require('../src/db');
const logActivity = require('../src/utils/auditLogger');

describe('unlockUser', () => {
  let client;
  beforeEach(() => {
    client = {
      query: jest.fn(),
      release: jest.fn()
    };
    pool.connect.mockResolvedValue(client);
    logActivity.mockResolvedValue();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test('unlocks user and resets failed_attempts', async () => {
    const req = { params: { id: '42' }, user: { id: 1, fullName: 'Admin', is_superadmin: true } };
    const res = { json: jest.fn(), status: jest.fn(() => res) };

    // Simulate SELECT returning the user
    client.query.mockImplementation(async (sql, params) => {
      if (sql.startsWith('SELECT full_name')) return { rows: [{ full_name: 'Nguyen Van A', is_superadmin: false }] };
      return { rows: [] };
    });

    await userController.unlockUser(req, res);

    // Expect connect called
    expect(pool.connect).toHaveBeenCalled();
    // Expect update to reset failed_attempts
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE users SET failed_attempts = 0'), [ '42' ]);
    // Expect commit and json response
    expect(client.query).toHaveBeenCalledWith('COMMIT');
    expect(res.json).toHaveBeenCalledWith({ message: 'Tài khoản đã được mở khóa.' });
  });
});
