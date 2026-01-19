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
  );
};

export default Header;