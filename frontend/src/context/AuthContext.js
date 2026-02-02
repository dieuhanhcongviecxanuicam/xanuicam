// ubndxanuicam/frontend/src/context/AuthContext.js
// VERSION 2.0 - ADDED DETAILED JSDOC COMMENTS FOR CLARITY

import React, { createContext, useState, useEffect, useCallback } from 'react';
import { jwtDecode } from 'jwt-decode';
import apiService from '../services/apiService';
import { computeFingerprint } from '../utils/fingerprint';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  /**
   * @function logout
   * @description Đăng xuất người dùng bằng cách xóa token và reset state.
   * Tự động chuyển hướng về trang đăng nhập.
   */
  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setUser(null);
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
  }, []);

  /**
   * @function fetchUserFromToken
   * @description Lấy thông tin người dùng từ token trong localStorage khi tải lại trang.
   * Tự động kiểm tra và xử lý token hết hạn.
   */
  const fetchUserFromToken = useCallback(() => {
    setLoading(true);
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const decoded = jwtDecode(token);
        // Kiểm tra xem token đã hết hạn chưa (exp tính bằng giây, cần nhân 1000)
        if (decoded.exp * 1000 < Date.now()) {
          logout();
        } else {
          // Sanitize role: remove any " - Cấp ..." suffix if present
          const u = { ...decoded.user };
          if (u && u.role && typeof u.role === 'string') {
            const idx = u.role.indexOf(' - Cấp');
            if (idx !== -1) u.role = u.role.slice(0, idx).trim();
          }

          // If department is missing, attempt to fetch full user record
          if (!u.department && u.id) {
            (async () => {
              try {
                const full = await apiService.getUserById(u.id);
                if (full) {
                  u.department = full.department_name || u.department;
                  u.fullName = full.full_name || u.fullName;
                }
                setUser(u);
              } catch (e) {
                // fallback to token info if API call fails
                setUser(u);
              }
            })();
          } else {
            setUser(u);
          }
        }
      } catch (error) {
        console.error("Token không hợp lệ, đang đăng xuất:", error);
        logout();
      }
    }
    setLoading(false);
  }, [logout]);

  // Chạy một lần khi component được mount để kiểm tra trạng thái đăng nhập
  useEffect(() => {
    fetchUserFromToken();
  }, [fetchUserFromToken]);

  // Compute local fingerprint and listen for logout broadcasts from other tabs
  useEffect(() => {
    let localFp = null;
    (async () => {
      try {
        // If a fingerprint was stored earlier (login), reuse it
        const cached = localStorage.getItem('ubndx_fp');
        if (cached) {
          localFp = cached;
        } else {
          // attempt to compute minimal metadata fingerprint for this tab
          const meta = { language: navigator.language || null, userAgent: navigator.userAgent || null, platform: navigator.platform || null };
          const fp = await computeFingerprint(meta);
          if (fp) {
            localFp = fp;
            try { localStorage.setItem('ubndx_fp', fp); } catch (e) {}
          }
        }
      } catch (e) {}
    })();

    const onStorage = (ev) => {
      try {
        if (!ev.key) return;
        if (ev.key === 'ubndx_logout_fp' && ev.newValue) {
          const payload = JSON.parse(ev.newValue);
          if (!payload || !payload.fingerprint) return;
          if (localFp && payload.fingerprint === localFp) {
            // This device was targeted for logout
            logout();
          }
        }
      } catch (e) {
        // ignore
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [logout]);

  /**
   * @function login
   * @description Xử lý khi người dùng đăng nhập thành công.
   * @param {string} token - Token JWT nhận được từ server.
   */
  const login = (token) => {
    localStorage.setItem('token', token);
    const decoded = jwtDecode(token);
    const u = { ...decoded.user };
    if (u && u.role && typeof u.role === 'string') {
      const idx = u.role.indexOf(' - Cấp');
      if (idx !== -1) u.role = u.role.slice(0, idx).trim();
    }
    setUser(u);
  };
  
  /**
   * @function updateUserContext
   * @description Cập nhật context với token mới, giúp đồng bộ thông tin người dùng
   * (vd: avatar, tên) ngay lập tức sau khi cập nhật hồ sơ.
   * @param {string} newToken - Token JWT mới được trả về từ server.
   */
  const updateUserContext = (newToken) => {
    localStorage.setItem('token', newToken); // Lưu token mới nhất
    const decoded = jwtDecode(newToken);
    const u = { ...decoded.user };
    if (u && u.role && typeof u.role === 'string') {
      const idx = u.role.indexOf(' - Cấp');
      if (idx !== -1) u.role = u.role.slice(0, idx).trim();
    }
    setUser(u); // Cập nhật state với thông tin từ token mới
  };

  /**
   * @function hasPermission
   * @description Kiểm tra xem người dùng có quyền hạn yêu cầu hay không.
   * @param {string[]} requiredPermissions - Mảng các quyền cần kiểm tra.
   * @returns {boolean} - true nếu người dùng có đủ quyền, ngược lại là false.
   */
  const hasPermission = (requiredPermissions = []) => {
    if (!user || !user.permissions) return false;
    if (user.permissions.includes('full_access')) return true;
    // Support two forms:
    // - Array: require ALL permissions (legacy)
    // - Object: { any: ['p1','p2'] } or { all: ['p1','p2'] }
    if (Array.isArray(requiredPermissions)) {
      return requiredPermissions.every(p => user.permissions.includes(p));
    }
    if (requiredPermissions && requiredPermissions.any) {
      return requiredPermissions.any.some(p => user.permissions.includes(p));
    }
    if (requiredPermissions && requiredPermissions.all) {
      return requiredPermissions.all.every(p => user.permissions.includes(p));
    }
    return false;
  };

  const authContextValue = {
    user,
    loading,
    login,
    logout,
    hasPermission,
    updateUserContext,
  };

  return (
    <AuthContext.Provider value={authContextValue}>
      {/* Chỉ render các component con khi đã kiểm tra xong token */}
      {!loading && children}
    </AuthContext.Provider>
  );
};

export default AuthContext;