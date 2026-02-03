import React, { useEffect, useState } from 'react';
import ModalWrapper from '../common/ModalWrapper';
import api from '../../api/axios';

const DeviceManagerModal = ({ open, onClose, identifier }) => {
  const [password, setPassword] = useState('');
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [busySid, setBusySid] = useState(null);

  useEffect(() => {
    if (!open) {
      setPassword(''); setSessions([]); setError(''); setBusySid(null);
    }
  }, [open]);

  const fetchSessions = async () => {
    if (!identifier) return setError('Vui lòng nhập tên đăng nhập trước.');
    if (!password) return setError('Vui lòng nhập mật khẩu để xem các thiết bị.');
    setError(''); setLoading(true);
    try {
      console.debug('[DeviceManager] POST /auth/sessions/list', { identifier, body: { identifier, password } });
      const res = await api.post('/auth/sessions/list', { identifier, password });
      console.debug('[DeviceManager] response', { status: res.status, data: res.data });
      setSessions(res.data.sessions || res.data?.sessions || []);
    } catch (e) {
      console.error('[DeviceManager] sessions list error', e?.response?.status, e?.response?.data || e.message);
      setError(e.response?.data?.message || 'Không thể tải danh sách thiết bị.');
    } finally {
      setLoading(false);
    }
  };

  const logoutSession = async (sid) => {
    if (!identifier || !password) return setError('Vui lòng nhập tên đăng nhập và mật khẩu.');
    setBusySid(sid); setError('');
    try {
      console.debug('[DeviceManager] POST logout-credential', { url: `/auth/sessions/${sid}/logout-credential`, body: { identifier } });
      const res = await api.post(`/auth/sessions/${sid}/logout-credential`, { identifier, password });
      console.debug('[DeviceManager] logout response', { status: res.status, data: res.data });
      setSessions(prev => prev.filter(s => s.sessionId !== sid));
    } catch (e) {
      console.error('[DeviceManager] logout error', e?.response?.status, e?.response?.data || e.message);
      setError(e.response?.data?.message || 'Không thể đăng xuất thiết bị này.');
    } finally {
      setBusySid(null);
    }
  };

  const logoutAllOthers = async () => {
    if (!identifier || !password) return setError('Vui lòng nhập tên đăng nhập và mật khẩu.');
    setLoading(true); setError('');
    try {
      console.debug('[DeviceManager] POST /auth/sessions/logout-others', { identifier });
      const res = await api.post('/auth/sessions/logout-others', { identifier, password });
      console.debug('[DeviceManager] logout-others response', { status: res.status, data: res.data });
      // After success, refresh sessions list (should be empty or reduced)
      await fetchSessions();
    } catch (e) {
      console.error('[DeviceManager] logout-others error', e?.response?.status, e?.response?.data || e.message);
      setError(e.response?.data?.message || 'Không thể đăng xuất tất cả thiết bị khác.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalWrapper isOpen={open} onClose={onClose} maxWidth="max-w-2xl" className="p-4">
      <div className="bg-white rounded-lg shadow-lg w-full p-4">
        <h3 className="text-lg font-semibold">Quản lý thiết bị</h3>
        <p className="text-sm text-slate-500 mt-2">Xem và đăng xuất các phiên đang hoạt động cho tài khoản.</p>

        <div className="mt-4 space-y-3">
          <div>
            <label className="block text-xs text-slate-600">Tên đăng nhập</label>
            <input type="text" value={identifier || ''} disabled className="w-full px-3 py-2 border rounded bg-slate-50" />
          </div>
          <div>
            <label className="block text-xs text-slate-600">Mật khẩu</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-3 py-2 border rounded" placeholder="Nhập mật khẩu để xác thực" />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-2">
            <button onClick={fetchSessions} className="btn-primary" disabled={loading}>{loading ? 'Đang tải...' : 'Tải danh sách thiết bị'}</button>
            <button onClick={logoutAllOthers} className="btn-warning" disabled={loading}>{loading ? 'Đang xử lý...' : 'Đăng xuất tất cả thiết bị khác'}</button>
            <button onClick={onClose} className="btn-secondary">Đóng</button>
          </div>
        </div>

        <div className="mt-4">
          {sessions.length === 0 ? (
            <p className="text-sm text-slate-500">Chưa có phiên nào hoặc chưa tải.</p>
          ) : (
            <ul className="mt-2 space-y-2 text-sm">
              {sessions.map(s => (
                <li key={s.sessionId} className="p-2 border rounded flex justify-between items-center">
                  <div>
                    <div className="font-medium">{s.deviceType || s.ua?.os || 'Unknown'}</div>
                    <div className="text-xs text-slate-500">{s.ua?.raw || s.ip || ''}</div>
                    <div className="text-xs text-slate-400">Tạo: {new Date(s.createdAt).toLocaleString()}</div>
                  </div>
                  <div>
                    <button onClick={() => logoutSession(s.sessionId)} className="btn-secondary" disabled={busySid === s.sessionId}>{busySid === s.sessionId ? 'Đang...' : 'Đăng xuất'}</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </ModalWrapper>
  );
};

export default DeviceManagerModal;
