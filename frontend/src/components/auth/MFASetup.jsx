import React, { useState, useEffect } from 'react';
import apiService from '../../services/apiService';
import useAuth from '../../hooks/useAuth';
import api from '../../api/axios';
import deviceMeta from '../../utils/deviceMetadata';
import { formatDateTime, formatTimeAgo } from '../../utils/formatDate';
import PasswordModal from '../common/PasswordModal';
import DeviceDetailsModal from '../common/DeviceDetailsModal';

export default function MFASetup({ onDone }) {
  const [qr, setQr] = useState(null);
  const [base32, setBase32] = useState(null);
  const [token, setToken] = useState('');
  const [message, setMessage] = useState('');
  const [showDisableModal, setShowDisableModal] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [showLogoutOthersModal, setShowLogoutOthersModal] = useState(false);
  const [logoutOthersPassword, setLogoutOthersPassword] = useState('');
  const [sessions, setSessions] = useState([]);
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [uniqueDevices, setUniqueDevices] = useState([]);
  const [showDeviceModal, setShowDeviceModal] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const { user, logout } = useAuth();

  

  const start = async () => {
    try {
      const res = await apiService.mfaSetup();
      setQr(res.otpauth_url);
      setBase32(res.base32);
    } catch (e) {
      setMessage('Không thể tạo MFA: ' + (e?.message || ''));
    }
  };

  
  const loadInfo = async () => {
    try {
      const res = await apiService.mfaInfo();
      // Do not clear `base32` here — rotating or creating a secret sets it
      // in the local state and calling loadInfo afterwards should not
      // overwrite the ephemeral secret shown to the user.
      const fetched = res.sessions || [];
      setSessions(fetched);
      // Group sessions by fingerprint (fallback to ua.raw + ip) to compute unique devices
      const groups = new Map();
      for (const s of fetched) {
        const key = s.fingerprint || `${s.ua?.raw||''}|${s.ip||''}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(s);
      }
      const uniqueDevices = Array.from(groups.entries()).map(([fingerprint, sessions]) => ({ fingerprint, sessions }));
      setUniqueDevices(uniqueDevices);
      setMfaEnabled(res.mfaEnabled || false);
      // If we're in activation flow (there is a generated QR) but the server
      // reports no sessions, log the user out to avoid a partially-configured
      // MFA state being left open without any active session/device.
      if (qr && (!fetched || fetched.length === 0)) {
        try { logout(); } catch (e) { /* ignore */ }
        return;
      }
    } catch (e) {
      // ignore
    }
  };

  // loadInfo fetches sessions and related device info when user or QR changes.
  // Intentionally not including `loadInfo` in deps because it is re-created
  // on every render; we only want to run this when `user` changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadInfo(); }, [user]);

  const verify = async () => {
    try {
      // collect device metadata at activation and send to server to persist with session
      let device = null;
      try { device = await deviceMeta.collectDeviceMetadata(); } catch(e){ device = null; }
      await apiService.mfaVerify({ token, device });
      setMessage('Kích hoạt MFA thành công.');
      setMfaEnabled(true);
      // clear ephemeral secret/qr after successful activation
      setQr(null);
      setBase32(null);
      setToken('');
      await loadInfo();
    } catch (e) {
      setMessage('Xác thực thất bại.');
    }
  };

  const confirmDisable = async () => {
    try {
      // Ensure Authorization header is present — explicitly include token to avoid
      // race conditions where axios interceptor may not have the token yet.
      const tkn = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      if (tkn) {
        await api.post('/auth/mfa/disable', { password: disablePassword }, { headers: { Authorization: `Bearer ${tkn}` } });
      } else {
        await apiService.mfaDisable({ password: disablePassword });
      }
      setMessage('MFA đã bị vô hiệu hóa.');
      setMfaEnabled(false);
      setQr(null);
      setBase32(null);
      setToken('');
      setShowDisableModal(false);
      // Attempt to refresh MFA info so UI reflects true server state. If the
      // server invalidated sessions (expected), loadInfo() may trigger a 401
      // and the global interceptor will redirect to /login — in that case
      // force logout to ensure a clean state for re-login.
      try {
        await loadInfo();
      } catch (e) {
        // ignore — the interceptor may have redirected already
      }
      try { logout(); } catch (e) {}
      return;
    } catch (e) {
      // Try to extract server message for clearer UX
      let msg = 'Không thể tắt MFA.';
      if (e && e.response && e.response.data && e.response.data.message) msg = e.response.data.message;
      else if (e && e.message) msg = e.message;
      setMessage(msg);
    }
  };

  const copySecret = async () => {
    if (!base32) return;
    try { await navigator.clipboard.writeText(base32); setMessage('Đã sao chép secret vào clipboard.'); } catch(e){ setMessage('Không thể sao chép.'); }
  };

  const downloadQR = async () => {
    if (!qr) return;
    const localUrl = `/api/auth/mfa/qr?data=${encodeURIComponent(qr)}`;
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const resp = await fetch(localUrl, { headers });
      if (!resp.ok) {
        if (resp.status === 401) {
          setMessage('Bạn cần đăng nhập để tải QR.');
          return;
        }
        throw new Error('Fetch failed');
      }
      const blob = await resp.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = 'mfa-qr.png';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
      return;
    } catch (e) {
      // Fallback to external QR provider which does not require auth
      try {
        const external = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(qr)}&size=400x400`;
        const a = document.createElement('a');
        a.href = external;
        a.download = 'mfa-qr.png';
        document.body.appendChild(a);
        a.click();
        a.remove();
      } catch (e2) {
        setMessage('Không thể tải QR.');
      }
    }
  };

  const rotate = async () => {
    try {
      const res = await apiService.mfaRotate();
      setQr(res.otpauth_url);
      setBase32(res.base32);
      setMessage('Đã tạo secret mới. Vui lòng xác thực lại để kích hoạt.');
      loadInfo();
    } catch (e) {
      setMessage('Không thể thay đổi secret.');
    }
  };

  // const DAYS_TTL = 30;  // kept for future TTL use

  return (
    <div className="p-4 bg-white rounded shadow">
      <h3 className="text-lg font-semibold mb-2">MFA (Xác thực hai yếu tố)</h3>
      <div className="space-y-3">
        {!mfaEnabled && !qr && <button onClick={start} className="btn-primary">Bật MFA</button>}
          {qr && (
          <div>
            <p className="text-sm">Quét mã QR trong ứng dụng Authenticator hoặc nhập mã thủ công:</p>
            <div className="mt-2">
              <img src={`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(qr)}&size=200x200`} alt="QR" />
            </div>
            <p className="mt-2 text-xs break-all">Secret: {base32}</p>
            <div className="mt-2 flex gap-2">
              <button onClick={copySecret} className="btn-secondary">Sao chép</button>
              <button onClick={rotate} className="btn-secondary">Thay đổi</button>
              <button onClick={downloadQR} className="btn-secondary">Tải QR MFA</button>
            </div>
            <div className="mt-2">
              <input value={token} onChange={e=>setToken(e.target.value)} placeholder="Mã OTP" className="input-style" />
            </div>
            <div className="mt-2 flex gap-2">
              <button onClick={verify} className="btn-primary">Xác thực & Kích hoạt</button>
            </div>
          </div>
        )}
        {mfaEnabled && !qr && (
          <div>
            <div className="mt-2">
              <button onClick={()=>setShowDisableModal(true)} className="btn-primary bg-red-600 hover:bg-red-700 text-white">Tắt MFA</button>
            </div>
          </div>
        )}

        <PasswordModal
          open={showDisableModal}
          title="Xác nhận tắt MFA"
          description="Vui lòng nhập mật khẩu để tắt tính năng MFA."
          value={disablePassword}
          onChange={setDisablePassword}
          onCancel={() => setShowDisableModal(false)}
          onConfirm={confirmDisable}
          confirmLabel="Xác nhận"
        />
        <div className="mt-4">
          <h4 className="font-medium">Thiết bị & Phiên đăng nhập</h4>
        {sessions.length === 0 ? <p className="text-sm text-slate-500">Chưa có phiên nào.</p> : (
            <ul className="mt-2 space-y-2 text-sm">
              {uniqueDevices.map(d => (
                <li key={d.fingerprint} className="p-2 border rounded">
                  <div className="flex justify-between items-start">
                    <div>
                      {/* show primary session info for grouped device */}
                      {d.sessions[0] && (
                        <>
                          <div className="font-medium">{d.sessions[0].ua?.browser ? `${d.sessions[0].ua.browser} ${d.sessions[0].ua.version||''}` : (d.sessions[0].deviceType || d.sessions[0].os || 'Unknown')}</div>
                          <div className="text-xs text-slate-600">Ngôn ngữ: {d.sessions[0].ua?.language || d.sessions[0].metadata?.language || '—'}</div>
                          <div className="text-xs text-slate-600">User Agent: {d.sessions[0].ua?.raw || d.sessions[0].metadata?.ua || '—'}</div>
                          <div className="text-xs text-slate-600">Múi giờ: {d.sessions[0].metadata?.timezone || '—'}</div>
                          <div className="text-xs text-slate-600">Số phiên trên thiết bị: {d.sessions.length}</div>
                        </>
                      )}
                    </div>
                    <div className="text-right text-xs text-slate-600">
                      <div>{formatDateTime(d.sessions[0]?.createdAt)}</div>
                      <div>{formatTimeAgo(d.sessions[0]?.lastSeenAt)}</div>
                      <div className="mt-2 flex flex-col sm:flex-row sm:items-center gap-2 justify-end">
                        <button onClick={() => { setSelectedDevice({ fingerprint: d.fingerprint, sessions: d.sessions }); setShowDeviceModal(true); }} className="btn-secondary btn-sm">Xem chi tiết</button>
                        <button onClick={async ()=>{
                          try {
                            for (const s of d.sessions) {
                              await apiService.logoutSession(s.sessionId);
                            }
                            try { localStorage.setItem('ubndx_logout_fp', JSON.stringify({ fingerprint: d.fingerprint, ts: Date.now() })); } catch(e){}
                            setMessage('Đã đăng xuất thiết bị.');
                            await loadInfo();
                            setTimeout(()=> window.location.reload(), 300);
                          } catch(e){
                            setMessage('Không thể đăng xuất thiết bị.');
                          }
                        }} className="btn-secondary btn-sm">Đăng xuất thiết bị</button>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        {uniqueDevices.length >= 3 && (
          <div className="mt-3 p-3 border rounded bg-yellow-50 text-sm text-slate-800">
            <div className="font-medium">Bạn đang đăng nhập trên {uniqueDevices.length} thiết bị. Giới hạn tối đa là 3 thiết bị.</div>
                <div className="mt-2">
                  <button onClick={()=> setShowLogoutOthersModal(true)} className="btn-primary">Đăng xuất các thiết bị khác</button>
                </div>
          </div>
        )}
        </div>
        {message && <p className="text-sm text-slate-600">{message}</p>}
      </div>
      <PasswordModal
        open={showLogoutOthersModal}
        title="Xác nhận đăng xuất các thiết bị khác"
        description="Vui lòng nhập mật khẩu để đăng xuất các thiết bị khác."
        value={logoutOthersPassword}
        onChange={setLogoutOthersPassword}
        onCancel={()=>{ setShowLogoutOthersModal(false); setLogoutOthersPassword(''); }}
        onConfirm={async ()=>{
          try {
            if (!logoutOthersPassword) return;
            await api.post('/auth/sessions/logout-others', { identifier: user?.username || user?.id || '', password: logoutOthersPassword });
            setMessage('Đã đăng xuất các thiết bị khác.');
            await loadInfo();
            setShowLogoutOthersModal(false);
            setLogoutOthersPassword('');
            window.location.reload();
          } catch(e){ setMessage('Không thể đăng xuất các thiết bị khác.'); }
        }}
        confirmLabel="Xác nhận"
      />
      <DeviceDetailsModal open={showDeviceModal} device={selectedDevice} onClose={() => { setShowDeviceModal(false); setSelectedDevice(null); }} />
    </div>
  );
}
