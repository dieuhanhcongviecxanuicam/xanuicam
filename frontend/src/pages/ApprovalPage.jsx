// ubndxanuicam/frontend/src/pages/admin/ApprovalPage.jsx
// VERSION 2.1 - CONSOLIDATED APPROVALS FOR MEETINGS AND BOOKINGS

import React, { useState, useEffect, useCallback } from 'react';
import { Check, X, Calendar, Clock, User, Users, Building } from 'lucide-react';
import apiService from '../../services/apiService';
import Spinner from '../../components/common/Spinner';
import Notification from '../../components/common/Notification';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

const ApprovalPage = () => {
    const [pendingMeetings, setPendingMeetings] = useState([]);
    const [pendingBookings, setPendingBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [notification, setNotification] = useState({ message: '', type: '' });

    /**
     * Tải đồng thời cả hai danh sách đang chờ phê duyệt để tối ưu.
     */
    const fetchApprovals = useCallback(async () => {
        setLoading(true);
        try {
            const [meetings, bookings] = await Promise.all([
                apiService.getMeetings({ status: 'Chờ phê duyệt' }),
                apiService.getRoomBookings({ status: 'Chờ phê duyệt' })
            ]);
            setPendingMeetings(meetings);
            setPendingBookings(bookings);
        } catch (error) {
            setNotification({ message: 'Không thể tải danh sách cần phê duyệt.', type: 'error' });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchApprovals();
    }, [fetchApprovals]);

    /**
     * Xử lý phê duyệt hoặc từ chối một cuộc họp.
     */
    const handleMeetingApproval = async (meetingId, newStatus) => {
        try {
            await apiService.updateMeetingStatus(meetingId, newStatus);
            setNotification({
                message: newStatus === 'Đã duyệt' ? 'Phê duyệt cuộc họp thành công!' : 'Đã từ chối cuộc họp.',
                type: 'success'
            });
            fetchApprovals(); // Tải lại danh sách
        } catch (error) {
            setNotification({ message: error || 'Hành động thất bại.', type: 'error' });
        }
    };

    /**
     * Xử lý phê duyệt hoặc từ chối một lượt đặt phòng.
     */
    const handleBookingApproval = async (bookingId, newStatus) => {
        try {
            await apiService.updateRoomBookingStatus(bookingId, newStatus);
            setNotification({
                message: newStatus === 'Đã duyệt' ? 'Phê duyệt đặt phòng thành công!' : 'Đã từ chối yêu cầu đặt phòng.',
                type: 'success'
            });
            fetchApprovals(); // Tải lại danh sách
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
                
                {/* Bảng Lịch họp */}
                <div className="bg-white p-6 rounded-lg shadow-lg mb-8">
                    <h2 className="text-xl font-semibold text-slate-700 mb-4">Lịch họp đang chờ phê duyệt</h2>
                    {loading ? (
                        <div className="flex justify-center items-center py-10"><Spinner /></div>
                    ) : pendingMeetings.length > 0 ? (
                        <ul className="divide-y divide-slate-200">
                            {pendingMeetings.map(meeting => (
                                <li key={meeting.id} className="py-4 flex flex-col sm:flex-row items-start justify-between gap-4">
                                    <div className="flex-grow">
                                        <p className="font-bold text-slate-800">{meeting.title}</p>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-slate-600 mt-2">
                                            <span className="flex items-center"><User size={14} className="mr-1.5 text-slate-400"/> {meeting.organizer_name}</span>
                                            <span className="flex items-center"><Calendar size={14} className="mr-1.5 text-slate-400"/> {format(new Date(meeting.start_time), 'dd/MM/yyyy', { locale: vi })}</span>
                                            <span className="flex items-center"><Clock size={14} className="mr-1.5 text-slate-400"/> {format(new Date(meeting.start_time), 'HH:mm')} - {format(new Date(meeting.end_time), 'HH:mm')}</span>
                                            <span className="flex items-center"><Building size={14} className="mr-1.5 text-slate-400"/> {meeting.room}</span>
                                            <span className="col-span-full flex items-center"><Users size={14} className="mr-1.5 text-slate-400"/> {meeting.participants?.length || 0} người tham gia</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <button onClick={() => handleMeetingApproval(meeting.id, 'Từ chối')} className="btn-secondary p-2 bg-red-100 text-red-700 border-red-200 hover:bg-red-200">
                                            <X size={18} />
                                        </button>
                                        <button onClick={() => handleMeetingApproval(meeting.id, 'Đã duyệt')} className="btn-secondary p-2 bg-green-100 text-green-700 border-green-200 hover:bg-green-200">
                                            <Check size={18} />
                                        </button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-center py-10 text-slate-500">Không có yêu cầu họp nào đang chờ phê duyệt.</p>
                    )}
                </div>

                {/* Bảng Đặt phòng họp */}
                <div className="bg-white p-6 rounded-lg shadow-lg">
                    <h2 className="text-xl font-semibold text-slate-700 mb-4">Lịch đặt phòng đang chờ phê duyệt</h2>
                     {loading ? (
                        <div className="flex justify-center items-center py-10"><Spinner /></div>
                    ) : pendingBookings.length > 0 ? (
                        <ul className="divide-y divide-slate-200">
                            {pendingBookings.map(booking => (
                                <li key={booking.id} className="py-4 flex flex-col sm:flex-row items-start justify-between gap-4">
                                    <div className="flex-grow">
                                        <p className="font-bold text-slate-800">{booking.title}</p>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-slate-600 mt-2">
                                            <span className="flex items-center"><User size={14} className="mr-1.5 text-slate-400"/> {booking.booker_name}</span>
                                            <span className="flex items-center"><Calendar size={14} className="mr-1.5 text-slate-400"/> {format(new Date(booking.start_time), 'dd/MM/yyyy', { locale: vi })}</span>
                                            <span className="flex items-center"><Clock size={14} className="mr-1.5 text-slate-400"/> {format(new Date(booking.start_time), 'HH:mm')} - {format(new Date(booking.end_time), 'HH:mm')}</span>
                                            <span className="flex items-center"><Building size={14} className="mr-1.5 text-slate-400"/> {booking.room_name}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <button onClick={() => handleBookingApproval(booking.id, 'Từ chối')} className="btn-secondary p-2 bg-red-100 text-red-700 border-red-200 hover:bg-red-200"><X size={18} /></button>
                                        <button onClick={() => handleBookingApproval(booking.id, 'Đã duyệt')} className="btn-secondary p-2 bg-green-100 text-green-700 border-green-200 hover:bg-green-200"><Check size={18} /></button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : (
                         <p className="text-center py-10 text-slate-500">Không có yêu cầu đặt phòng nào đang chờ.</p>
                    )}
                </div>
            </div>
        </>
    );
};

export default ApprovalPage;