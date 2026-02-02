import React, { useEffect, useState } from 'react';
import apiService from '../services/apiService';
import Notification from '../components/common/Notification';

const DeletedCalendarEvents = () => {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [notif, setNotif] = useState({ message: '', type: '' });

    const fetchItems = async () => {
        setLoading(true);
        try {
            const data = await apiService.getDeletedCalendarEvents();
            setItems(data || []);
        } catch (e) {
            console.error('Failed to load deleted events', e);
            setNotif({ message: 'Không thể tải danh sách lịch đã xóa.', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchItems(); }, []);

    const handleRestore = async (id, title) => {
        try {
            await apiService.restoreDeletedCalendarEvent(id);
            setNotif({ message: `Đã khôi phục lịch "${title}" thành công!`, type: 'success' });
            fetchItems();
        } catch (e) {
            console.error('Restore failed', e);
            setNotif({ message: 'Khôi phục thất bại.', type: 'error' });
        }
    };

    return (
        <div className="p-6">
            <Notification message={notif.message} type={notif.type} onClose={() => setNotif({ message: '', type: '' })} />
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Lịch đã xóa</h2>
                <div>
                    <button onClick={() => window.location.href = '/schedule'} className="text-sm px-3 py-1 bg-gray-100 rounded">Quay lại Lịch làm việc</button>
                </div>
            </div>
            {loading ? <div>Đang tải...</div> : (
                <div className="bg-white rounded shadow p-4">
                    {items.length === 0 ? <div className="text-sm text-slate-500">Không có lịch nào trong kho lưu trữ.</div> : (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-slate-600">
                                    <th>Tiêu đề</th>
                                    <th>Thời gian</th>
                                    <th>Người tạo</th>
                                    <th>Ngày xóa</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map(it => (
                                    <tr key={it.id} className="border-t">
                                        <td>{it.title}</td>
                                        <td>{it.start_time ? new Date(it.start_time).toLocaleString() : '-'} - {it.end_time ? new Date(it.end_time).toLocaleString() : '-'}</td>
                                        <td>{it.user_id || it.deleted_by || '-'}</td>
                                        <td>{it.deleted_at ? new Date(it.deleted_at).toLocaleString() : '-'}</td>
                                        <td><button className="btn-primary text-xs" onClick={() => handleRestore(it.id, it.title)}>Khôi phục</button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}
        </div>
    );
};

export default DeletedCalendarEvents;
