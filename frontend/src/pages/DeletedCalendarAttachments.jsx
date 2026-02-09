import React, { useEffect, useState } from 'react';
import apiService from '../services/apiService';
import Notification from '../components/common/Notification';

const DeletedCalendarAttachments = () => {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [notif, setNotif] = useState({ message: '', type: '' });

    const fetchItems = async () => {
        setLoading(true);
        try {
            const data = await apiService.getDeletedCalendarAttachments();
            setItems(data || []);
        } catch (e) {
            console.error('Failed to load deleted attachments', e);
            setNotif({ message: 'Không thể tải danh sách tệp đã xóa.', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchItems(); }, []);

    const handleRestore = async (id, fileName) => {
        try {
            await apiService.restoreDeletedCalendarAttachment(id);
            setNotif({ message: `Đã khôi phục tệp ${fileName} thành công!`, type: 'success' });
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
                <h2 className="text-xl font-semibold">Tệp đã xóa - Lịch làm việc</h2>
                <div>
                    <button onClick={() => window.location.href = '/schedule'} className="text-sm px-3 py-1 bg-gray-100 rounded">Quay lại Lịch làm việc</button>
                </div>
            </div>
            {loading ? <div>Đang tải...</div> : (
                <div className="bg-white rounded shadow p-4">
                    {items.length === 0 ? <div className="text-sm text-slate-500">Không có tệp nào trong kho lưu trữ.</div> : (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-slate-600">
                                    <th>Tên tệp</th>
                                    <th>Sự kiện</th>
                                    <th>Người xóa</th>
                                    <th>Ngày xóa</th>
                                    <th>Kích thước</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map(it => (
                                    <tr key={it.id} className="border-t">
                                        <td><a href={it.file_path} target="_blank" rel="noreferrer" className="text-blue-600">{it.file_name || it.file_path.split('/').pop()}</a></td>
                                        <td>{it.event_id}</td>
                                        <td>{it.deleted_by || it.user_id || '-'}</td>
                                        <td>{it.deleted_at ? new Date(it.deleted_at).toLocaleString() : '-'}</td>
                                        <td>{it.file_size ? `${(it.file_size/1024).toFixed(1)} KB` : '-'}</td>
                                        <td><button className="btn-primary text-xs" onClick={() => handleRestore(it.id, it.file_name || it.file_path.split('/').pop())}>Khôi phục</button></td>
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

export default DeletedCalendarAttachments;
