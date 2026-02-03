import React, { useState, useEffect, useCallback } from 'react';
import { Check, X, Calendar, Clock, User, Building } from 'lucide-react';
import apiService from '../../services/apiService';
import Spinner from '../../components/common/Spinner';
import Notification from '../../components/common/Notification';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

const ApprovalPage = () => {
    const [pendingItems, setPendingItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [notification, setNotification] = useState({ message: '', type: '' });

    const fetchApprovals = useCallback(async () => {
        setLoading(true);
        try {
            // Call combined approvals endpoint
            const items = await apiService.getApprovals();
            setPendingItems(items);
        } catch (error) {
            setNotification({ message: 'Không thể tải danh sách cần phê duyệt.', type: 'error' });
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchApprovals();
    }, [fetchApprovals]);
    const handleApproval = async (item, newStatus) => {
        try {
            if (item.type === 'meeting') {
                await apiService.updateMeetingStatus(item.orig_id, newStatus);
            } else if (item.type === 'room_booking') {
                await apiService.updateRoomBookingStatus(item.orig_id, newStatus);
            }
            setNotification({
                message: newStatus === 'Đã duyệt' ? 'Phê duyệt thành công!' : 'Đã từ chối yêu cầu.',
                type: 'success'
            });
            fetchApprovals(); // reload list
        } catch (error) {
            setNotification({ message: error || 'Hành động thất bại.', type: 'error' });
        }
    };

    return (
        <>
            <Notification
                message={notification.message}
                type={notification.type}
                onClose={() => setNotification({ message: '', type: '' })}
            />
            <div>
                <h1 className="text-3xl font-bold text-slate-800 mb-6">Phê duyệt Yêu cầu</h1>
                
                <div className="bg-white p-6 rounded-lg shadow-lg">
                    <h2 className="text-xl font-semibold text-slate-700 mb-4">Lịch họp đang chờ phê duyệt</h2>
                    {loading ? (
                        <div className="flex justify-center items-center py-10"><Spinner /></div>
                    ) : pendingItems.length > 0 ? (
                        <ul className="divide-y divide-slate-200">
                            {pendingItems.map(item => (
                                <li key={item.id} className="py-4 flex flex-col sm:flex-row items-start justify-between gap-4">
                                    <div className="flex-grow">
                                        <p className="font-bold text-slate-800">{item.title}</p>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-slate-600 mt-2">
                                            <span className="flex items-center"><User size={14} className="mr-1.5 text-slate-400"/> {item.requester_name}</span>
                                            <span className="flex items-center"><Calendar size={14} className="mr-1.5 text-slate-400"/> {format(new Date(item.start_time), 'dd/MM/yyyy', { locale: vi })}</span>
                                            <span className="flex items-center"><Clock size={14} className="mr-1.5 text-slate-400"/> {format(new Date(item.start_time), 'HH:mm')} - {format(new Date(item.end_time), 'HH:mm')}</span>
                                            <span className="flex items-center"><Building size={14} className="mr-1.5 text-slate-400"/> {item.room}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <button onClick={() => handleApproval(item, 'Từ chối')} className="btn-secondary p-2 bg-red-100 text-red-700 border-red-200 hover:bg-red-200">
                                            <X size={18} />
                                        </button>
                                        <button onClick={() => handleApproval(item, 'Đã duyệt')} className="btn-secondary p-2 bg-green-100 text-green-700 border-green-200 hover:bg-green-200">
                                            <Check size={18} />
                                        </button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-center py-10 text-slate-500">Không có yêu cầu nào đang chờ phê duyệt.</p>
                    )}
                </div>
            </div>
        </>
    );
};

export default ApprovalPage;