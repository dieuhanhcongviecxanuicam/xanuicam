import React, { useState, useEffect, useCallback } from 'react';
import apiService from '../services/apiService';
import Spinner from '../components/common/Spinner';
import { ShieldCheck, ToggleLeft, ToggleRight, Save } from 'lucide-react';
import Notification from '../components/common/Notification';

const AdminSettingsPage = () => {
    const [settings, setSettings] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [notification, setNotification] = useState({ message: '', type: '' });

    const fetchSettings = useCallback(async () => {
        setLoading(true);
        try {
            const res = await apiService.getSystemSettings();
            setSettings(res);
        } catch (error) {
            console.error("Lỗi tải cài đặt:", error);
            setNotification({ message: 'Không thể tải cài đặt hệ thống.', type: 'error'});
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchSettings();
    }, [fetchSettings]);

    const handleMaintenanceChange = (field, value) => {
        setSettings(prev => ({
            ...prev,
            maintenance_mode: {
                ...prev.maintenance_mode,
                [field]: value
            }
        }));
    };

    const handleSave = async () => {
        setSaving(true);
        setNotification({ message: '', type: '' });
        try {
            await apiService.updateMaintenanceMode(settings.maintenance_mode);
            setNotification({ message: 'Lưu cài đặt thành công!', type: 'success' });
        } catch (error) {
            setNotification({ message: 'Lỗi! Không thể lưu cài đặt.', type: 'error' });
            console.error("Lỗi lưu cài đặt:", error);
        } finally {
            setSaving(false);
        }
    };

    const handleClearUserUpdateActions = async () => {
        const ok = window.confirm('Xác nhận xóa tất cả bản ghi user_update_actions? (QA only)');
        if (!ok) return;
        setSaving(true);
        try {
            await apiService.clearUserUpdateActions();
            setNotification({ message: 'Đã xóa các bản ghi user_update_actions.', type: 'success' });
        } catch (error) {
            console.error('Lỗi khi xóa user_update_actions:', error);
            setNotification({ message: 'Không thể xóa user_update_actions.', type: 'error' });
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <Spinner fullPage />;
    if (!settings) return <p>Không thể tải dữ liệu cài đặt.</p>;

    const isMaintenanceEnabled = settings.maintenance_mode?.enabled;

    return (
        <div>
            <Notification 
                message={notification.message}
                type={notification.type}
                onClose={() => setNotification({ message: '', type: '' })}
            />
            <h1 className="text-3xl font-bold text-slate-800 mb-6 flex items-center">
                <ShieldCheck className="w-8 h-8 mr-3 text-blue-600"/>
                Cài đặt Hệ thống
            </h1>

            <div className="bg-white p-6 rounded-lg shadow-lg max-w-2xl">
                <h2 className="text-xl font-semibold text-slate-700">Chế độ Bảo trì</h2>
                <p className="text-sm text-slate-500 mt-1">
                    Khi bật, chỉ có Admin mới có thể truy cập hệ thống.
                </p>

                <div className="mt-6 flex items-center justify-between p-4 rounded-md bg-slate-50">
                    <span className="font-medium">{isMaintenanceEnabled ? 'Trạng thái bảo trì: ĐANG BẬT' : 'Trạng thái bảo trì: ĐANG TẮT'}</span>
                    <button onClick={() => handleMaintenanceChange('enabled', !isMaintenanceEnabled)}>
                        {isMaintenanceEnabled ? (
                            <ToggleRight className="w-10 h-10 text-green-500 cursor-pointer"/>
                        ) : (
                            <ToggleLeft className="w-10 h-10 text-slate-400 cursor-pointer"/>
                        )}
                    </button>
                </div>

                <div className={`mt-4 space-y-4 transition-all duration-300 ease-in-out ${isMaintenanceEnabled ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Tiêu đề thông báo</label>
                        <input
                            type="text"
                            value={settings.maintenance_mode.title}
                            onChange={(e) => handleMaintenanceChange('title', e.target.value)}
                            className="mt-1 input-style"
                        />
                    </div>
                    <div>
                         <label className="block text-sm font-medium text-slate-700">Nội dung thông báo</label>
                         <textarea
                            rows="3"
                            value={settings.maintenance_mode.message}
                            onChange={(e) => handleMaintenanceChange('message', e.target.value)}
                            className="mt-1 input-style"
                         />
                    </div>
                </div>
                
                <div className="mt-6 border-t pt-5 flex items-center justify-end">
                    <button
                        onClick={handleClearUserUpdateActions}
                        disabled={saving}
                        className="mr-auto inline-flex items-center justify-center px-3 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 shadow-sm disabled:bg-red-300"
                    >
                        Xóa user_update_actions
                    </button>
                     <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 shadow-sm disabled:bg-blue-300"
                    >
                        <Save className="w-4 h-4 mr-2"/>
                        {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AdminSettingsPage;