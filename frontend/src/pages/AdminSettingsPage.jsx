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

    const handleSaveMaintenance = async () => {
        setSaving(true);
        setNotification({ message: '', type: '' });
        try {
            await apiService.updateMaintenanceMode(settings.maintenance_mode);
            setNotification({ message: 'Lưu cài đặt bảo trì thành công!', type: 'success' });
        } catch (error) {
            setNotification({ message: 'Lỗi! Không thể lưu cài đặt bảo trì.', type: 'error' });
            console.error("Lỗi lưu cài đặt:", error);
        } finally {
            setSaving(false);
        }
    };

    const handleSaveNotification = async () => {
        setSaving(true);
        setNotification({ message: '', type: '' });
        try {
            await apiService.updateBroadcastNotification(settings.broadcast_notification || {});
            setNotification({ message: 'Lưu thông báo thành công!', type: 'success' });
        } catch (error) {
            setNotification({ message: 'Lỗi! Không thể lưu thông báo.', type: 'error' });
            console.error('Lỗi lưu thông báo:', error);
        } finally {
            setSaving(false);
        }
    };

    // removed clear user_update_actions button per UI update

    if (loading) return <Spinner fullPage />;
    if (!settings) return <p>Không thể tải dữ liệu cài đặt.</p>;

    const isMaintenanceEnabled = settings.maintenance_mode?.enabled;
    const isBroadcastEnabled = settings.broadcast_notification?.enabled;

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

            <div className="space-y-6">
                <div className="bg-white p-6 rounded-lg shadow-lg max-w-2xl">
                    <h2 className="text-xl font-semibold text-slate-700">Gửi thông báo</h2>
                    <p className="text-sm text-slate-500 mt-1">Gửi thông báo tới tất cả tài khoản trên website. Các trường chi tiết chỉ hiển thị khi bật.</p>

                    <div className="mt-6 flex items-center justify-between p-4 rounded-md bg-slate-50">
                        <span className="font-medium">{isBroadcastEnabled ? 'Trạng thái thông báo: ĐANG BẬT' : 'Trạng thái thông báo: ĐANG TẮT'}</span>
                        <button onClick={() => setSettings(prev=>({ ...prev, broadcast_notification: { ...(prev.broadcast_notification||{}), enabled: !isBroadcastEnabled } }))}>
                            {isBroadcastEnabled ? (
                                <ToggleRight className="w-10 h-10 text-green-500 cursor-pointer"/>
                            ) : (
                                <ToggleLeft className="w-10 h-10 text-slate-400 cursor-pointer"/>
                            )}
                        </button>
                    </div>

                    <div className={`mt-4 space-y-4 transition-all duration-300 ease-in-out ${isBroadcastEnabled ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Tiêu đề thông báo</label>
                            <input type="text" className="mt-1 input-style" value={settings.broadcast_notification?.title || ''} onChange={(e)=> setSettings(prev=> ({ ...prev, broadcast_notification: { ...(prev.broadcast_notification||{}), title: e.target.value } }))} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Nội dung thông báo</label>
                            <textarea rows="4" className="mt-1 input-style" value={settings.broadcast_notification?.message || ''} onChange={(e)=> setSettings(prev=> ({ ...prev, broadcast_notification: { ...(prev.broadcast_notification||{}), message: e.target.value } }))} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700">Thời gian bắt đầu</label>
                                <input type="datetime-local" className="mt-1 input-style" value={settings.broadcast_notification?.start_time ? settings.broadcast_notification.start_time.replace('Z','') : ''} onChange={(e)=> setSettings(prev=> ({ ...prev, broadcast_notification: { ...(prev.broadcast_notification||{}), start_time: e.target.value } }))} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700">Thời gian kết thúc</label>
                                <input type="datetime-local" className="mt-1 input-style" value={settings.broadcast_notification?.end_time ? settings.broadcast_notification.end_time.replace('Z','') : ''} onChange={(e)=> setSettings(prev=> ({ ...prev, broadcast_notification: { ...(prev.broadcast_notification||{}), end_time: e.target.value } }))} />
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 border-t pt-5 flex items-center justify-end">
                        <button onClick={handleSaveNotification} disabled={saving} className="flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 shadow-sm disabled:bg-blue-300">
                            <Save className="w-4 h-4 mr-2" />
                            {saving ? 'Đang lưu...' : 'Lưu thông báo'}
                        </button>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-lg max-w-2xl">
                    <h2 className="text-xl font-semibold text-slate-700">Bảo trì hệ thống</h2>
                    <p className="text-sm text-slate-500 mt-1">Nội dung hiển thị khi website ở chế độ bảo trì. Các trường chi tiết chỉ hiển thị khi bật.</p>

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
                            <label className="block text-sm font-medium text-slate-700">Tiêu đề thông báo chính</label>
                            <input type="text" className="mt-1 input-style" value={settings.maintenance_mode?.main_title || ''} onChange={(e)=> handleMaintenanceChange('main_title', e.target.value)} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Tiêu đề thông báo phụ</label>
                            <input type="text" className="mt-1 input-style" value={settings.maintenance_mode?.sub_title || ''} onChange={(e)=> handleMaintenanceChange('sub_title', e.target.value)} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Nội dung chi tiết thông báo</label>
                            <textarea rows="5" className="mt-1 input-style" value={settings.maintenance_mode?.detailed_message || settings.maintenance_mode?.message || ''} onChange={(e)=> handleMaintenanceChange('detailed_message', e.target.value)} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700">Thời gian bắt đầu</label>
                                <input type="datetime-local" className="mt-1 input-style" value={settings.maintenance_mode?.start_time ? settings.maintenance_mode.start_time.replace('Z','') : ''} onChange={(e)=> handleMaintenanceChange('start_time', e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700">Thời gian kết thúc</label>
                                <input type="datetime-local" className="mt-1 input-style" value={settings.maintenance_mode?.end_time ? settings.maintenance_mode.end_time.replace('Z','') : ''} onChange={(e)=> handleMaintenanceChange('end_time', e.target.value)} />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Danh sách tài khoản ưu tiên (Whitelist) - tối đa 3 (username hoặc id)</label>
                            <div className="grid grid-cols-3 gap-2 mt-2">
                                {[0,1,2].map(i => (
                                    <input key={i} type="text" className="input-style" value={(settings.maintenance_mode?.whitelist||[])[i]||''} onChange={(e)=>{
                                        const w = Array.isArray(settings.maintenance_mode?.whitelist) ? settings.maintenance_mode.whitelist.slice(0) : [];
                                        w[i] = e.target.value;
                                        handleMaintenanceChange('whitelist', w);
                                    }} />
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 border-t pt-5 flex items-center justify-end">
                        <button onClick={handleSaveMaintenance} disabled={saving} className="flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 shadow-sm disabled:bg-blue-300">
                            <Save className="w-4 h-4 mr-2" />
                            {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminSettingsPage;