import React, { useEffect, useState, useCallback } from 'react';
import useAuth from '../../hooks/useAuth';
import apiService from '../../services/apiService';
import Spinner from '../../components/common/Spinner';
import Notification from '../../components/common/Notification';

const channelKey = (userId) => `notification_prefs_${userId}`;

const NotificationsPage = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [notifications, setNotifications] = useState([]);
    const [tasks, setTasks] = useState([]);
    const [department, setDepartment] = useState(null);
    const [prefs, setPrefs] = useState({ email: true, inApp: true, push: false });
    const [notice, setNotice] = useState({ message: '', type: '' });

    const loadData = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            const [n, t, u, p] = await Promise.all([
                apiService.getNotifications(),
                apiService.getUserTasks(user.id),
                apiService.getUserById(user.id),
                apiService.getNotificationPrefs()
            ]);
            setNotifications(n || []);
            setTasks(t || []);
            setDepartment(u?.department_name ? { id: u.department_id, name: u.department_name, manager: u.department_manager_name } : null);
            if (p) setPrefs({ email: !!p.email, inApp: !!p.in_app, push: !!p.push });
            else {
                // fallback to localStorage for older installs
                try {
                    const raw = localStorage.getItem(channelKey(user.id));
                    if (raw) setPrefs(JSON.parse(raw));
                } catch (e) {}
            }
        } catch (error) {
            console.error('Không thể tải dữ liệu thông báo:', error);
            setNotice({ message: 'Không thể tải dữ liệu thông báo.', type: 'error' });
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const savePrefs = async (newPrefs) => {
        setPrefs(newPrefs);
        try { await apiService.updateNotificationPrefs({ email: newPrefs.email, inApp: newPrefs.inApp, push: newPrefs.push }); setNotice({ message: 'Cài đặt thông báo đã được lưu.', type: 'success' }); } catch (e) {
            // fallback: persist locally if backend fails
            try { localStorage.setItem(channelKey(user.id), JSON.stringify(newPrefs)); } catch (ee) {}
            setNotice({ message: 'Không thể lưu lên server, đã lưu cục bộ.', type: 'warning' });
        }
        // lightweight audit event
        try { apiService.logEvent({ action: 'notification_prefs_changed', details: newPrefs }); } catch (e) {}
    };

    const markAllRead = async () => {
        try {
            await apiService.markAllNotificationsAsRead();
            setNotifications(n => n.map(x => ({ ...x, is_read: true })))
            setNotice({ message: 'Đã đánh dấu tất cả là đã đọc.', type: 'success' });
        } catch (e) {
            setNotice({ message: 'Không thể đánh dấu tất cả là đã đọc.', type: 'error' });
        }
    };

    const markRead = async (id) => {
        try {
            await apiService.markNotificationAsRead(id);
            setNotifications(n => n.map(x => x.id === id ? { ...x, is_read: true } : x));
        } catch (e) {
            setNotice({ message: 'Không thể đánh dấu thông báo.', type: 'error' });
        }
    };

    if (loading) return <div className="bg-white rounded-lg shadow p-6"><Spinner /></div>;

    return (
        <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold">Thông báo</h3>
            {notice.message && <div className="mt-4"><Notification type={notice.type} message={notice.message} /></div>}

            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                <section className="col-span-2">
                    <div className="flex items-center justify-between">
                        <h4 className="font-medium">Thông báo gần đây</h4>
                        <button onClick={markAllRead} className="text-sm text-blue-600 hover:underline">Đánh dấu tất cả đã đọc</button>
                    </div>
                    <div className="mt-3 space-y-3">
                        {notifications.length === 0 && <p className="text-slate-600">Không có thông báo mới.</p>}
                        {notifications.map(n => (
                            <div key={n.id} className={`p-3 rounded border ${n.is_read ? 'bg-slate-50' : 'bg-white'}`}>
                                <div className="flex items-start justify-between">
                                    <div>
                                        <div className="text-sm text-slate-800">{n.message}</div>
                                        {n.link && <a href={n.link} className="text-xs text-blue-600 hover:underline">Mở</a>}
                                        <div className="text-xs text-slate-400">{new Date(n.created_at).toLocaleString()}</div>
                                    </div>
                                    <div className="ml-3 flex flex-col gap-2">
                                        {!n.is_read && <button onClick={() => markRead(n.id)} className="text-xs text-green-600">Đánh dấu đã đọc</button>}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                <aside className="col-span-1 border-l pl-4">
                    <div>
                        <h4 className="font-medium">Cài đặt kênh</h4>
                        <div className="mt-3 space-y-2">
                            <label className="flex items-center justify-between">
                                <span className="text-sm">Email</span>
                                <input type="checkbox" checked={prefs.email} onChange={(e) => savePrefs({ ...prefs, email: e.target.checked })} />
                            </label>
                            <label className="flex items-center justify-between">
                                <span className="text-sm">Trong ứng dụng</span>
                                <input type="checkbox" checked={prefs.inApp} onChange={(e) => savePrefs({ ...prefs, inApp: e.target.checked })} />
                            </label>
                            <label className="flex items-center justify-between">
                                <span className="text-sm">Push (trình duyệt)</span>
                                <input type="checkbox" checked={prefs.push} onChange={(e) => savePrefs({ ...prefs, push: e.target.checked })} />
                            </label>
                        </div>
                    </div>

                    <div className="mt-6">
                        <h4 className="font-medium">Công việc được giao</h4>
                        {tasks.length === 0 && <p className="text-slate-600">Bạn không có công việc được giao.</p>}
                        <ul className="mt-2 space-y-2">
                            {tasks.slice(0,6).map(t => (
                                <li key={t.id} className="text-sm">
                                    <a href={`/tasks/${t.id}`} className="text-blue-600 hover:underline">{t.title}</a>
                                    <div className="text-xs text-slate-400">{t.status} • Hạn: {t.due_date ? new Date(t.due_date).toLocaleDateString() : '—'}</div>
                                </li>
                            ))}
                        </ul>
                        {tasks.length > 6 && <div className="text-xs mt-2 text-slate-500">Hiển thị 6 công việc gần nhất</div>}
                    </div>

                    <div className="mt-6">
                        <h4 className="font-medium">Phòng ban</h4>
                        {department ? (
                            <div className="text-sm">
                                <div>{department.name}</div>
                                <div className="text-xs text-slate-500">Người phụ trách: {department.manager || '—'}</div>
                                <div className="mt-2">
                                    <button onClick={() => setNotice({ message: 'Tùy chọn phòng ban lưu cục bộ (demo).', type: 'info' })} className="px-3 py-1 text-sm bg-gray-100 rounded">Quản lý cài đặt phòng ban</button>
                                </div>
                            </div>
                        ) : <p className="text-slate-600">Bạn chưa thuộc phòng ban nào.</p>}
                    </div>
                </aside>
            </div>
        </div>
    );
};

export default NotificationsPage;
