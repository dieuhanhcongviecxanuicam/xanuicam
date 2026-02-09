import React, { useEffect, useState } from 'react';
import apiService from '../services/apiService';
import useAuth from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';

const DeletedRoomBookingsPage = () => {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const { user } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        const fetch = async () => {
            setLoading(true);
            try {
                const data = await apiService.getDeletedRoomBookings({ limit: 500 });
                setItems(Array.isArray(data) ? data : []);
            } catch (e) {
                setError(e && e.message ? e.message : 'Không thể tải danh sách cuộc họp đã xóa.');
            } finally { setLoading(false); }
        };
        fetch();
    }, []);

    const handleRestore = async (id) => {
        if (!window.confirm('Khôi phục cuộc họp đã xóa này về lịch đặt phòng?')) return;
        try {
            await apiService.restoreDeletedRoomBooking(id);
            setItems(prev => prev.filter(i => i.id !== id));
            try { apiService.logEvent({ module: 'Đặt phòng', action: 'Khôi phục', details: `Khôi phục lịch`, resource_type: 'room_booking', resource_id: id }).catch(()=>{}); } catch(e){}
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
                <h1 className="text-2xl font-bold">Cuộc họp đã xóa - Đăng ký phòng họp</h1>
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
                                    <th>Tiêu đề</th>
                                    <th>Phòng</th>
                                    <th>Người đặt</th>
                                    <th>Bắt đầu</th>
                                    <th>Kết thúc</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map(it => (
                                    <tr key={it.id} className="border-t">
                                        <td>{it.id}</td>
                                        <td className="truncate max-w-xs">{it.title}</td>
                                        <td>{it.room_name}</td>
                                        <td>{it.booker_name || it.booker || ''}</td>
                                        <td>{it.start_time ? new Date(it.start_time).toLocaleString() : ''}</td>
                                        <td>{it.end_time ? new Date(it.end_time).toLocaleString() : ''}</td>
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

export default DeletedRoomBookingsPage;
