// ubndxanuicam/frontend/src/components/layout/Header.jsx
// VERSION 2.3 - FINAL RESPONSIVE FIX FOR NOTIFICATIONS

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import apiService from '../../services/apiService';
import { Bell, ChevronDown, LogOut, User, Menu, CheckCheck } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import defaultAvatar from '../../assets/images/default-avatar.png';

const Header = ({ setSidebarOpen }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loadingNotifs, setLoadingNotifs] = useState(true);
  const [broadcast, setBroadcast] = useState(null);
  const [showBroadcast, setShowBroadcast] = useState(false);
  const BACKEND_URL = process.env.REACT_APP_API_BASE_URL.replace('/api', '');

  const fetchNotifications = useCallback(async () => {
      setLoadingNotifs(true);
      try {
          const notifs = await apiService.getNotifications();
          setNotifications(notifs);
      } catch (error) {
          console.error("Không thể tải thông báo:", error);
      } finally {
          setLoadingNotifs(false);
      }
  }, []);

  useEffect(() => {
      if (user) {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 30000);
        return () => clearInterval(interval);
      }
  }, [user, fetchNotifications]);

  // Fetch public broadcast notification and show modal when active
  useEffect(() => {
    let mounted = true;
        const checkBroadcast = async () => {
      try {
        const res = await apiService.getPublicBroadcastNotification();
        if (!mounted || !res) return;
        const data = res;
        if (!data || !data.enabled) return;
        const now = Date.now();
        const start = data.start_time ? new Date(data.start_time).getTime() : null;
        const end = data.end_time ? new Date(data.end_time).getTime() : null;
        const within = (!start || now >= start) && (!end || now <= end);
        if (!within) return;
        const dismissKey = `broadcast_dismissed_${data.id || 'system'}`;
        const raw = localStorage.getItem(dismissKey);
        if (raw) {
          try {
            const obj = JSON.parse(raw);
            const now2 = Date.now();
            const currentId = data.id || 'system';
            const fetchedUpdated = data.updated_at || data.updatedAt || null;
            // If stored matches current broadcast id and is not expired and updatedAt matches, skip showing
            if (obj && obj.id === currentId && obj.expiresAt && now2 < obj.expiresAt) {
              if (!obj.updatedAt || !fetchedUpdated || obj.updatedAt === fetchedUpdated) {
                return;
              }
            }
          } catch (e) {
            // ignore malformed value
          }
        }
        setBroadcast(data);
        setShowBroadcast(true);
      } catch (e) {
        // ignore
      }
    };
    checkBroadcast();
    // no interval; only fetch on mount
    return () => { mounted = false; };
  }, []);

  

  

  const hasUnread = useMemo(() => notifications.some(n => !n.is_read), [notifications]);

  const handleNotificationClick = async (notification) => {
      setIsNotificationsOpen(false);
      if (!notification.is_read) {
          try {
              await apiService.markNotificationAsRead(notification.id);
              setNotifications(prev => prev.map(n => 
                  n.id === notification.id ? { ...n, is_read: true } : n
              ));
          } catch (error) {
              console.error("Lỗi khi đánh dấu thông báo đã đọc:", error);
          }
      }
      if (notification.link) {
          navigate(notification.link);
      }
  };

  const handleMarkAllAsRead = async () => {
      try {
          await apiService.markAllNotificationsAsRead();
          setNotifications(prev => prev.map(n => ({...n, is_read: true})));
      } catch (error) {
          console.error("Lỗi khi đánh dấu tất cả đã đọc:", error);
      }
  };

  return (
    <>
    <header className="relative z-20 bg-white shadow-sm">
      <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8 h-16">
        <button onClick={() => setSidebarOpen(true)} className="md:hidden text-slate-500">
            <Menu />
        </button>
        
        <div className="flex-1"></div>
        <div className="flex items-center space-x-4">
          <div className="relative">
            <button onClick={() => setIsNotificationsOpen(!isNotificationsOpen)} className="text-slate-500 hover:text-slate-700">
                <Bell />
                {hasUnread && <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-white"></span>}
            </button>
             {isNotificationsOpen && (
                 // NÂNG CẤP CUỐI CÙNG: Sử dụng transform để căn chỉnh, đảm bảo tương thích
                 <div 
                    className="absolute mt-2 w-80 bg-white rounded-md shadow-lg z-30 right-0 md:right-0 md:transform-none transform-gpu translate-x-1/4 sm:translate-x-0"
                    onMouseLeave={() => setIsNotificationsOpen(false)}
                >
                     <div className="flex justify-between items-center px-4 py-2 font-semibold text-sm border-b">
                        <span>Thông báo</span>
                        {hasUnread && (
                            <button onClick={handleMarkAllAsRead} className="text-xs text-blue-600 hover:underline flex items-center">
                                <CheckCheck size={14} className="mr-1"/>
                                Đánh dấu đã đọc
                            </button>
                        )}
                     </div>
                     <div className="max-h-80 overflow-y-auto">
                        {loadingNotifs ? <p className="text-center text-sm p-4">Đang tải...</p> : notifications.length > 0 ? notifications.map(notif => (
                             <div 
                                key={notif.id} 
                                className={`px-4 py-3 hover:bg-slate-50 border-b cursor-pointer ${!notif.is_read ? 'bg-blue-50' : ''}`}
                                onClick={() => handleNotificationClick(notif)}
                            >
                                 <p className="text-sm text-slate-700">{notif.message}</p>
                                 <p className="text-xs text-slate-400 mt-1">
                                    {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true, locale: vi })}
                                 </p>
                             </div>
                        )) : (
                            <p className="text-sm text-slate-500 text-center py-4">Không có thông báo mới.</p>
                        )}
                     </div>
                 </div>
             )}
          </div>
          <div className="relative">
            <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="flex items-center space-x-2">
              <img className="w-8 h-8 rounded-full object-cover" src={user.avatar ? `${BACKEND_URL}/${user.avatar}` : defaultAvatar} alt="User avatar"/>
              <div className="hidden md:block">
                <div className="text-sm font-semibold text-slate-800">{user.fullName}</div>
                <div className="text-xs text-slate-500">{user.role}</div>
              </div>
              <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${isMenuOpen ? 'rotate-180' : ''}`} />
            </button>
            {isMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-30" onClick={() => setIsMenuOpen(false)}>
                <Link to="/settings/profile" className="flex items-center w-full px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">
                  <User className="w-4 h-4 mr-2" /> Hồ sơ cá nhân
                </Link>
                <button onClick={logout} className="w-full flex items-center px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">
                  <LogOut className="w-4 h-4 mr-2" /> Đăng xuất
                </button>
              </div>
            )}
          </div>
          
        </div>
      </div>
      
    </header>
    {showBroadcast && broadcast && (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black opacity-40"
        onClick={() => {
          try {
            const id = broadcast.id || 'system';
            // Temporary dismissal: 1 hour from now
            const expiresAt = Date.now() + 1 * 60 * 60 * 1000;
            const updatedAt = broadcast.updated_at || broadcast.updatedAt || null;
            localStorage.setItem(`broadcast_dismissed_${id}`, JSON.stringify({ id, expiresAt, updatedAt }));
          } catch (e) {
            localStorage.setItem(`broadcast_dismissed_${broadcast.id || 'system'}`, '1');
          }
          setShowBroadcast(false);
        }}
      />
        <div className="bg-white rounded-lg shadow-xl max-w-xl w-full mx-4 z-60 p-6 relative">
          <button
            onClick={() => {
              try {
                const id = broadcast.id || 'system';
                const expiresAt = broadcast.end_time ? new Date(broadcast.end_time).getTime() : (Date.now() + 24 * 60 * 60 * 1000);
                localStorage.setItem(`broadcast_dismissed_${id}`, JSON.stringify({ id, expiresAt }));
              } catch (e) {
                // fallback
                localStorage.setItem(`broadcast_dismissed_${broadcast.id || 'system'}`, '1');
              }
              setShowBroadcast(false);
            }}
            aria-label="Close broadcast"
            className="absolute top-3 right-3 inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <span aria-hidden>✕</span>
          </button>
          {broadcast.title && <h3 className="text-lg font-bold mb-2">{broadcast.title}</h3>}
          {broadcast.sub_title && <div className="text-sm text-slate-600 mb-3">{broadcast.sub_title}</div>}
          {broadcast.message && <div className="text-sm text-slate-700 mb-4">{broadcast.message}</div>}
          {broadcast.start_time || broadcast.end_time ? (
            <div className="text-xs text-slate-500 bg-yellow-50 border border-yellow-100 p-2 rounded">
              <strong>Thời gian:</strong>{' '}
              {broadcast.start_time ? new Date(broadcast.start_time).toLocaleString() : '—'}
              {' '}→{' '}
              {broadcast.end_time ? new Date(broadcast.end_time).toLocaleString() : '—'}
            </div>
          ) : null}
        </div>
      </div>
    )}
    </>
  );
};

export default Header;