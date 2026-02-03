import client from './axios';

describe('exportPost', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    global.fetch = jest.fn();
  });

  test('rejects and shows toast when server returns JSON error with 200', async () => {
    const headers = { get: (k) => 'application/json' };
    global.fetch.mockResolvedValue({ ok: true, headers, json: async () => ({ message: 'Access denied' }), status: 200 });
    await expect(client.exportPost('/computer-configs/export', {})).rejects.toThrow('Access denied');
    const container = document.getElementById('app-export-toast');
    expect(container).not.toBeNull();
    expect(container.textContent || container.innerText).toContain('Access denied');
  });

  test('rejects and shows toast when non-ok status returns text', async () => {
    const headers = { get: (k) => 'text/plain' };
    global.fetch.mockResolvedValue({ ok: false, headers, text: async () => 'Server busy', status: 503 });
    await expect(client.exportPost('/computer-configs/export', {})).rejects.toThrow();
    const container = document.getElementById('app-export-toast');
    expect(container).not.toBeNull();
  });
});
