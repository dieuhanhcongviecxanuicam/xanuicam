import React, { useEffect, useState } from 'react';
import apiService from '../services/apiService';
import useAuth from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';

const DeletedRoomAttachmentsPage = () => {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const { user } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        const fetch = async () => {
            setLoading(true);
            try {
                const data = await apiService.getDeletedRoomBookingAttachments({ limit: 500 });
                setItems(Array.isArray(data) ? data : []);
            } catch (e) {
                setError(e && e.message ? e.message : 'Không thể tải danh sách tệp đã xóa.');
            } finally { setLoading(false); }
        };
        fetch();
    }, []);

    const handleRestore = async (id) => {
        if (!window.confirm('Khôi phục tệp này vào đăng ký phòng họp?')) return;
        try {
            await apiService.restoreDeletedRoomBookingAttachment(id);
            setItems(prev => prev.filter(i => i.id !== id));
            alert('Khôi phục thành công.');
        } catch (e) {
            alert((e && e.message) || 'Khôi phục thất bại');
        }
    };

    if (!user || !(Array.isArray(user.permissions) && (user.permissions.includes('room_booking_management') || user.permissions.includes('full_access')))) {
        return <div className="p-6">Bạn không có quyền truy cập trang này.</div>;
    }

    return (
        <div className="p-6">
            <div className="flex items-center justify-between mb-4">
                <h1 className="text-2xl font-bold">Tệp đã xóa - Đăng ký phòng họp</h1>
                <div>
                    <button onClick={() => navigate('/meeting-room')} className="btn">Quay lại Lịch đặt phòng</button>
                </div>
            </div>
            {loading ? <p>Đang tải...</p> : (
                <>
                    {error && <p className="text-red-500">{error}</p>}
                    <div className="overflow-auto bg-white rounded shadow p-4">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left">
                                    <th>ID</th>
                                    <th>Booking ID</th>
                                    <th>Tên tệp</th>
                                    <th>Đường dẫn</th>
                                    <th>Kích thước</th>
                                    <th>Người xóa</th>
                                    <th>Thời gian</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map(it => (
                                    <tr key={it.id} className="border-t">
                                        <td>{it.id}</td>
                                        <td>{it.booking_id}</td>
                                        <td>{it.file_name || (it.file_path||'').split('/').pop()}</td>
                                        <td className="truncate max-w-xs">{it.file_path}</td>
                                        <td>{it.file_size ? (Number(it.file_size)/1024).toFixed(1) + ' KB' : ''}</td>
                                        <td>{it.deleted_by_name || it.deleted_by || it.user_id || ''}</td>
                                        <td>{it.deleted_at ? new Date(it.deleted_at).toLocaleString() : ''}</td>
                                        <td><button onClick={()=>handleRestore(it.id)} className="text-sm bg-green-600 text-white px-2 py-1 rounded">Khôi phục</button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </div>
    );
};

export default DeletedRoomAttachmentsPage;
