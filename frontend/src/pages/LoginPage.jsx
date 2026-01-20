// ubndxanuicam/frontend/src/pages/LoginPage.jsx
// VERSION 3.0 - STANDARDIZED ASSET IMPORTS

import React, { useState, useContext, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import AuthContext from '../context/AuthContext';
import api from '../api/axios';
import { Lock, User } from 'lucide-react';
import { computeFingerprint } from '../utils/fingerprint';
// Use public logo-thumbnail.png for login and header to ensure availability in production
import bgLogin from '../assets/images/background-login-HCC.png';
import bgSubmerged from '../assets/images/background-login.png';
import '../styles/loginBackground.css';
import PasswordModal from '../components/common/PasswordModal';
import DeviceManagerModal from '../components/auth/DeviceManagerModal';

const LoginPage = () => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [requireMfa, setRequireMfa] = useState(false);
  const [method, setMethod] = useState('password'); // 'password' or 'mfa'
  const [error, setError] = useState('');
  const [deviceLimitInfo, setDeviceLimitInfo] = useState(null);
  const [showLogoutOthersModal, setShowLogoutOthersModal] = useState(false);
  const [showDeviceManagerModal, setShowDeviceManagerModal] = useState(false);
  const [logoutPassword, setLogoutPassword] = useState('');
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [autoRetryBusy, setAutoRetryBusy] = useState(false);
  const [attemptsLeft, setAttemptsLeft] = useState(null);
  const [loading, setLoading] = useState(false);
  const { user, login } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || "/";

  // Decorations removed: keep login logic minimal and performant

  useEffect(() => {
    if (user) {
      navigate(from, { replace: true });
    }
  }, [user, navigate, from]);

  // Decorations and animated background have been removed to simplify the login page.

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      // Collect richer device metadata from the browser
      const gatherDeviceMetadata = async () => {
        const plugins = Array.from(navigator.plugins || []).map(p => p.name).slice(0,10);
        const connection = (navigator.connection || navigator.mozConnection || navigator.webkitConnection) || {};
        // canvas fingerprint: draw and hash
        let canvasHash = null;
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 200; canvas.height = 50;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#f5f5f5'; ctx.fillRect(0,0,200,50);
          ctx.textBaseline = 'top'; ctx.font = '14px Arial'; ctx.fillStyle = '#000'; ctx.fillText('UBND XANUICAM', 2, 2);
          const data = canvas.toDataURL();
          const enc = new TextEncoder().encode(data);
          const hashBuf = await crypto.subtle.digest('SHA-256', enc);
          const hashArray = Array.from(new Uint8Array(hashBuf));
          canvasHash = hashArray.map(b => b.toString(16).padStart(2,'0')).join('');
        } catch (e) { canvasHash = null; }

        return {
          language: navigator.language || null,
          languages: navigator.languages || null,
          browserUA: navigator.userAgent || null,
          platform: navigator.platform || null,
          hardwareConcurrency: navigator.hardwareConcurrency || null,
          deviceMemory: navigator.deviceMemory || null,
          screen: { width: window.screen.width, height: window.screen.height, pixelRatio: window.devicePixelRatio || 1 },
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
          connectionType: connection.effectiveType || connection.type || null,
          plugins,
          canvasHash,
          // note: fonts/audio/webgl fingerprints require user interaction or external libs; omitted for now
        };
      };

      const deviceMetadata = await gatherDeviceMetadata();
      const fp = await computeFingerprint(deviceMetadata);
      const devicePayload = {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        metadata: deviceMetadata,
        fingerprint: fp,
      };

      // persist this tab's fingerprint so other tabs can compare and react to logout broadcasts
      try { if (fp) localStorage.setItem('ubndx_fp', fp); } catch (e) {}

      let response;
      if (method === 'mfa') {
        if (!mfaCode) {
          setError('Vui lòng nhập mã 6 chữ số.');
          setLoading(false);
          return;
        }
        response = await api.post('/auth/login', { identifier, mfaOnly: true, mfaToken: mfaCode, device: devicePayload });
      } else {
        // If MFA is already required (we showed the MFA input), include the code
        const body = { identifier, password, device: devicePayload };
        if (requireMfa && mfaCode) body.mfaToken = mfaCode;
        response = await api.post('/auth/login', body);
      }

      // Server may respond with needMfa when user has MFA enabled but no code provided
      if (response.data && response.data.needMfa) {
        setRequireMfa(true);
        setError('Tài khoản yêu cầu mã MFA. Vui lòng nhập mã 6 chữ số.');
        setLoading(false);
        return;
      }

      // Normal successful login returns a token
      if (response.data && response.data.token) {
        login(response.data.token);
        setAttemptsLeft(null);
        navigate(from, { replace: true });
        return;
      }

      setError('Lỗi đăng nhập: phản hồi không hợp lệ từ server.');
    } catch (err) {
      // Log for diagnostics: record status and body when auth fails repeatedly
      try {
        if (process.env.NODE_ENV === 'development') {
          console.error('Login error', { status: err.response?.status, data: err.response?.data });
        }
      } catch (e) {}
      const data = err.response?.data;
      if (data) {
        // If server provides attemptsLeft, compute failed count and display Vietnamese message
        if (data.attemptsLeft !== undefined) {
          const remaining = Number(data.attemptsLeft);
          setAttemptsLeft(remaining);
          if (remaining > 0) {
            setError(`Sai mật khẩu, bạn còn ${remaining} lần thử lại!`);
          } else {
            setError('Tài khoản bị tạm khóa do nhập sai 5/5 lần. Vui lòng liên hệ quản trị viên để mở khóa.');
          }
        } else if (data.lockedUntil) {
          // Show remaining lock duration
          try {
            const lockedDate = new Date(data.lockedUntil);
            const mins = Math.ceil((lockedDate.getTime() - Date.now()) / 60000);
            setError(`Tài khoản bị tạm khóa. Vui lòng thử lại sau ${mins} phút hoặc liên hệ quản trị.`);
          } catch (e) {
            setError(data.message || 'Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên.');
          }
        } else if (err.response?.status === 403 && /khóa/i.test(String(data.message || ''))) {
          setAttemptsLeft(0);
          setError(data.message || 'Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên.');
        } else if (err.response?.status === 403 && /đăng nhập trên/i.test(String(data.message || ''))) {
          // Device limit reached; surface modal UI to manage sessions and auto-open manager
          setDeviceLimitInfo({ message: data.message, activeDevices: data.activeDevices || null, allowDeviceManagement: data.allowDeviceManagement });
          setError('Bạn đã đăng nhập quá số thiết bị cho phép. Vui lòng quản lý thiết bị.');
          if (data.allowDeviceManagement !== false) setShowDeviceManagerModal(true);
        } else {
          setError(data.message || 'Lỗi kết nối máy chủ. Vui lòng thử lại.');
        }
      } else {
        setError('Lỗi kết nối máy chủ. Vui lòng thử lại.');
      }
    } finally {
        setLoading(false);
    }
  };

  // Extracted performLogin so other flows (auto-retry) can call it programmatically
  const performLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const devicePayload = {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        hardwareConcurrency: navigator.hardwareConcurrency || null,
        screen: { width: window.screen.width, height: window.screen.height },
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      };
      const body = { identifier, password, device: devicePayload };
      if (requireMfa && mfaCode) body.mfaToken = mfaCode;
      const response = await api.post('/auth/login', body);
      if (response.data && response.data.token) {
        login(response.data.token);
        setAttemptsLeft(null);
        navigate(from, { replace: true });
        return { ok: true };
      }
      return { ok: false, message: 'Phản hồi không hợp lệ từ server.' };
    } catch (err) {
      const data = err.response?.data;
      if (data) {
        if (data.attemptsLeft !== undefined) {
          const remaining = Number(data.attemptsLeft);
          setAttemptsLeft(remaining);
          if (remaining > 0) setError(`Sai mật khẩu, bạn còn ${remaining} lần thử lại!`);
          else setError('Tài khoản đã bị tạm khóa do nhập sai 5/5 lần. Vui lòng liên hệ quản trị viên.');
        } else if (err.response?.status === 429) {
          setError(data.message || 'Quá nhiều yêu cầu. Vui lòng thử lại sau.');
        } else if (err.response?.status === 403 && /đăng nhập trên/i.test(String(data.message || ''))) {
          setDeviceLimitInfo({ message: data.message, activeDevices: data.activeDevices || null, allowDeviceManagement: data.allowDeviceManagement });
          setError('Bạn đã đăng nhập quá số thiết bị cho phép. Vui lòng quản lý thiết bị.');
          if (data.allowDeviceManagement !== false) setShowDeviceManagerModal(true);
        } else {
          setError(data.message || 'Lỗi kết nối máy chủ. Vui lòng thử lại.');
        }
      } else setError('Lỗi kết nối máy chủ. Vui lòng thử lại.');
      return { ok: false, message: err.response?.data?.message };
    } finally {
      setLoading(false);
    }
  };

  const confirmLogoutOthers = async () => {
    if (!identifier) return setError('Vui lòng nhập tên đăng nhập trước.');
    if (!logoutPassword) return setError('Vui lòng nhập mật khẩu để xác nhận.');
    setLogoutBusy(true);
    try {
      await api.post('/auth/sessions/logout-others', { identifier, password: (logoutPassword || '').trim() });
      // success — clear notice and attempt login again automatically
      setDeviceLimitInfo(null);
      setShowLogoutOthersModal(false);
      setLogoutPassword('');
      // auto-retry login with clearer UX
      setAutoRetryBusy(true);
      // Small delay to allow DB to settle and background workers to commit
      await new Promise(r => setTimeout(r, 500));
      const attempt = await performLogin();
      setAutoRetryBusy(false);
      if (!attempt.ok) {
        // If device limit still reported, inform user to retry manually
        if (attempt.message && /thiết bị/i.test(attempt.message)) {
          setError('Đăng xuất các thiết bị khác đã được thực hiện. Vui lòng thử đăng nhập lại.');
        } else {
          setError(attempt.message || 'Đăng nhập tự động không thành công. Vui lòng thử lại.');
        }
      }
    } catch (e) {
      const data = e.response?.data;
      setError(data?.message || 'Không thể đăng xuất thiết bị khác.');
    } finally {
      setLogoutBusy(false);
    }
  };

  // no decoration params needed

  return (
    <div className="relative flex items-center justify-center min-h-screen bg-slate-100">
      <div className="login-bg-container" aria-hidden="true">
        {/* Submerged rotating background (behind the glass layer) */}
        <div className="login-bg-submerged" aria-hidden="true">
          <img src={bgSubmerged} alt="" className="login-bg-submerged-image" />
          <div className="login-bg-submerged-overlay" />
        </div>

        <div className="login-bg-glass">
          <img src={bgLogin} alt="" className="login-bg-image" />
          <div className="login-bg-gradient" />
        </div>

        {/* Animated external gradient blobs for Fluent-like motion */}
        <div className="login-bg-blob login-bg-blob--one" />
        <div className="login-bg-blob login-bg-blob--two" />
        <div className="login-bg-blob login-bg-blob--three" />
      </div>
      <div className="w-full max-w-sm p-8 space-y-8 bg-white rounded-xl shadow-lg z-10 login-card">
        <div className="text-center">
          <img src="/logo-thumbnail.png" alt="Logo UBND xã Núi Cấm" className="w-20 h-20 mx-auto mb-4 object-contain" />
          <p className="text-2xl font-extrabold text-red-600 text-shadow-lg mb-1">UBND XÃ NÚI CẤM</p>
          <h1 className="text-1g font-semibold text-blue-600 text-shadow-md uppercase tracking-wide">HỆ THỐNG ĐIỀU HÀNH CÔNG VIỆC</h1>
        </div>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex flex-col items-center gap-2 mb-2">
            <div className="flex justify-center gap-2">
              <button type="button" onClick={() => { setMethod('password'); setRequireMfa(false); }} className={`px-3 py-1 rounded text-sm ${method==='password' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'}`}>Nhập mật khẩu</button>
              <button type="button" onClick={() => { setMethod('mfa'); setRequireMfa(false); }} className={`px-3 py-1 rounded text-sm ${method==='mfa' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'}`}>Authenticator (MFA)</button>
            </div>
            <p className="text-xs text-slate-500 text-center max-w-xs">
              {method === 'password' ? 'Đăng nhập bằng tên đăng nhập và mật khẩu.' : 'Đăng nhập bằng 6 số từ ứng dụng Authenticator.'}
            </p>
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <User className="w-5 h-5 text-slate-400" />
            </div>
            <input
              id="identifier"
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
              aria-label="Tên đăng nhập"
              autoComplete="username"
              className="w-full px-3 py-2 pl-10 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Nhập tên đăng nhập"
            />
          </div>
          {method === 'password' && (
            <div className="relative">
               <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <Lock className="w-5 h-5 text-slate-400" />
              </div>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                aria-label="Mật khẩu"
                autoComplete="current-password"
                className="w-full px-3 py-2 pl-10 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="••••••••"
              />
              {attemptsLeft !== null && (
                <p className="mt-2 text-xs text-right text-red-600">{attemptsLeft > 0 ? `Còn ${attemptsLeft} lần thử` : 'Tài khoản đã bị tạm khóa'}</p>
              )}
            </div>
          )}

          {(method === 'mfa' || requireMfa) && (
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                {/* show a different icon for MFA (key-like) or reuse Lock if not available */}
                <svg className="w-5 h-5 text-slate-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c1.657 0 3-1.343 3-3S13.657 5 12 5 9 6.343 9 8s1.343 3 3 3zM12 13v6" />
                </svg>
              </div>
              <input
                id="mfa"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                required={method === 'mfa' || requireMfa}
                aria-label="Mã MFA"
                autoComplete="one-time-code"
                className="w-full px-3 py-2 pl-10 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Nhập mã 6 chữ số"
              />
            </div>
          )}
          {error && <p className="text-sm text-center text-red-600">{error}</p>}
          {autoRetryBusy && <p className="text-sm text-center text-blue-600">Đang thử đăng nhập lại tự động...</p>}
          {deviceLimitInfo && (
            <div className="mt-3 p-3 border rounded bg-yellow-50 text-sm text-slate-800">
              <div className="font-medium">{deviceLimitInfo.message}</div>
                <div className="mt-2 flex gap-2">
                <button type="button" onClick={() => setShowDeviceManagerModal(true)} className="btn-secondary">Quản lý thiết bị</button>
                <button type="button" onClick={() => setShowLogoutOthersModal(true)} className="btn-primary">Đăng xuất các thiết bị khác</button>
                <button type="button" onClick={() => { setDeviceLimitInfo(null); }} className="btn-secondary">Đóng</button>
              </div>
            </div>
          )}

          <DeviceManagerModal open={showDeviceManagerModal} onClose={() => setShowDeviceManagerModal(false)} identifier={identifier} />

          <PasswordModal
            open={showLogoutOthersModal}
            title="Xác nhận đăng xuất các thiết bị khác"
            description="Nhập mật khẩu của bạn để đăng xuất tất cả các thiết bị."
            value={logoutPassword}
            onChange={setLogoutPassword}
            onCancel={() => { setShowLogoutOthersModal(false); setLogoutPassword(''); }}
            onConfirm={confirmLogoutOthers}
            confirmLabel={logoutBusy ? 'Đang xử lý...' : 'Xác nhận'}
          />
          <div>
            <button
              type="submit"
              className="w-full py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              disabled={loading}
            >
              {loading ? 'Đang xử lý...' : 'Đăng nhập'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;