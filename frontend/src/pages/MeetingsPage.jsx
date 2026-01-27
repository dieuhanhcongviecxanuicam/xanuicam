// ubndxanuicam/frontend/src/pages/MeetingsPage.jsx

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Users2, ChevronLeft, ChevronRight } from 'lucide-react';
import { startOfWeek, endOfWeek, eachDayOfInterval, addDays, format, isSameDay } from 'date-fns';
import { vi } from 'date-fns/locale';
import apiService from '../services/apiService';
import Spinner from '../components/common/Spinner';
// Meeting registration removed here; page is read-only and shows approved room bookings per room
import MeetingModal from '../components/meetings/MeetingModal';
import MeetingDetailModal from '../components/meetings/MeetingDetailModal';
import Notification from '../components/common/Notification';
import AttachmentViewerModal from '../components/common/AttachmentViewerModal';

const MeetingsPage = () => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [meetings, setMeetings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [detailModalOpen, setDetailModalOpen] = useState(false);
    const [selectedBooking, setSelectedBooking] = useState(null);
    const [hoveredBooking, setHoveredBooking] = useState(null);
    const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
    const [departmentsMap, setDepartmentsMap] = useState({});
    const ROOMS = ['Phòng họp lầu 2', 'Hội trường UBND', 'Phòng tiếp công dân'];
    const [selectedRoom, setSelectedRoom] = useState(ROOMS[0]);
    const [notification, setNotification] = useState({ message: '', type: '' });
    const [viewAttachment, setViewAttachment] = useState(null);

    const { weekStart, weekEnd } = useMemo(() => {
        const start = startOfWeek(currentDate, { weekStartsOn: 1 });
        const end = endOfWeek(currentDate, { weekStartsOn: 1 });
        return { weekStart: start, weekEnd: end };
    }, [currentDate]);

    const days = eachDayOfInterval({ start: weekStart, end: weekEnd });
    const timeSlots = Array.from({ length: 11 }, (_, i) => i + 7); // 7h - 17h

    const fetchMeetings = useCallback(async () => {
        setLoading(true);
        try {
            // Lấy các booking đã được duyệt (room bookings)
            const data = await apiService.getRoomBookings({
                start: weekStart.toISOString(),
                end: weekEnd.toISOString(),
                room_name: selectedRoom,
            });
            setMeetings(data);
        } catch (error) {
            console.error("Lỗi khi tải lịch họp:", error);
            setNotification({ message: 'Không thể tải lịch họp.', type: 'error' });
        } finally {
            setLoading(false);
        }
    }, [weekStart, weekEnd, selectedRoom]);

    useEffect(() => {
        fetchMeetings();
    }, [fetchMeetings, selectedRoom]);

    useEffect(() => {
        let mounted = true;
        apiService.getDepartments().then(resp => {
            const list = Array.isArray(resp) ? resp : (resp && resp.data) ? resp.data : [];
            if (!mounted) return;
            const map = {};
            list.forEach(d => { map[d.id] = d.name; });
            setDepartmentsMap(map);
        }).catch(() => {});
        return () => { mounted = false; };
    }, []);

    const handleOpenModal = (day, hour) => {
        const slotStart = new Date(day);
        slotStart.setHours(hour, 0, 0, 0);
        const slotEnd = new Date(slotStart);
        slotEnd.setHours(slotStart.getHours() + 1, 0, 0, 0);

        const matched = meetings.find(m => {
            const mStart = new Date(m.start_time);
            const mEnd = new Date(m.end_time);
            const sameDay = isSameDay(mStart, day);
            return sameDay && mStart < slotEnd && mEnd >= slotStart;
        });

        if (!matched) return;
        // Only open details for approved bookings
        if (matched.status === 'Đã duyệt' || matched.status === 'approved' || matched.status === 'APPROVED') {
            setSelectedBooking(matched);
            setDetailModalOpen(true);
        } else {
            setNotification({ message: 'Không thể xem cuộc họp đang chờ phê duyệt', type: 'info' });
        }
    };

    const handleSuccess = () => {
        fetchMeetings();
        setNotification({ message: 'Yêu cầu đăng ký phòng họp đã được gửi!', type: 'success' });
    }

    return (
        <>
            <Notification
                message={notification.message}
                type={notification.type}
                onClose={() => setNotification({ message: '', type: '' })}
            />
            <MeetingModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={handleSuccess}
            />
            <MeetingDetailModal
                isOpen={detailModalOpen}
                onClose={() => { setDetailModalOpen(false); setSelectedBooking(null); }}
                booking={selectedBooking}
                departmentsMap={departmentsMap}
                onNotify={(payload) => setNotification(payload)}
            />
            <div>
                 <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                    <div className="flex items-center">
                        <Users2 className="w-8 h-8 text-cyan-600 mr-4" />
                        <div>
                            <h1 className="text-3xl font-bold text-slate-800">Họp & Hội nghị</h1>
                            <p className="mt-1 text-slate-500">Xem và tải tài liệu cuộc họp.</p>
                        </div>
                    </div>
                     <div className="flex items-center gap-2">
                        <button onClick={() => setCurrentDate(addDays(currentDate, -7))} className="p-2 rounded-full hover:bg-slate-100"><ChevronLeft size={20} /></button>
                        <span className="text-lg font-semibold text-slate-700 w-48 text-center">
                            {format(weekStart, 'dd/MM')} - {format(weekEnd, 'dd/MM/yyyy')}
                        </span>
                        <button onClick={() => setCurrentDate(addDays(currentDate, 7))} className="p-2 rounded-full hover:bg-slate-100"><ChevronRight size={20} /></button>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-lg shadow-lg overflow-x-auto">
                    <div className="mb-4 flex gap-2">
                        {ROOMS.map(r => (
                            <button key={r} onClick={() => setSelectedRoom(r)} className={`px-3 py-1 rounded ${r === selectedRoom ? 'bg-cyan-600 text-white' : 'bg-slate-100'}`}>{r}</button>
                        ))}
                    </div>
                    {loading ? <div className="h-[500px] flex justify-center items-center"><Spinner /></div> : (
                        <div className="grid grid-cols-[140px_repeat(11,1fr)]">
                            {/* Top-left empty cell */}
                            <div className="p-2"></div>
                            {/* Time headers across top */}
                            {timeSlots.map(hour => (
                                <div key={`th-${hour}`} className="text-center p-2 border-b border-r">
                                    <p className="font-semibold text-sm">{hour}:00</p>
                                </div>
                            ))}

                            {/* Rows for each day: first column day label, then time slots as cells */}
                            {days.map(day => (
                                <React.Fragment key={`row-${day.toString()}`}>
                                    <div className="p-2 text-left font-semibold border-r flex items-center gap-3">
                                        <p className="text-xs text-slate-500 mb-0">{format(day, 'dd/MM')}</p>
                                        <p className="capitalize text-sm mb-0">{format(day, 'eee', { locale: vi })}</p>
                                    </div>
                                    {timeSlots.map(hour => {
                                        const slotStart = new Date(day);
                                        slotStart.setHours(hour, 0, 0, 0);
                                        const slotEnd = new Date(slotStart);
                                        slotEnd.setHours(slotStart.getHours() + 1, 0, 0, 0);

                                        const matched = meetings.find(m => {
                                            const mStart = new Date(m.start_time);
                                            const mEnd = new Date(m.end_time);
                                            const sameDay = isSameDay(mStart, day);
                                            // treat end time as inclusive for display: if meeting ends exactly at slot start, color that slot
                                            return sameDay && mStart < slotEnd && mEnd >= slotStart;
                                        });
                                        const hasMeeting = !!matched;

                                        const getMeetingClass = (m) => {
                                            if (!m) return '';
                                            const now = new Date();
                                            const mStart = new Date(m.start_time);
                                            const mEnd = new Date(m.end_time);
                                            const status = (m.status || '').toString().toLowerCase();

                                            // Pending approval (yellow)
                                            if (status.includes('chờ') || status.includes('pending') || status.includes('wait')) {
                                                return 'bg-amber-400 text-white';
                                            }
                                            // Rejected (red)
                                            if (status.includes('từ chối') || status.includes('tu ch') || status.includes('reject') || status.includes('rejected')) {
                                                return 'bg-red-500 text-white';
                                            }
                                            // Time-based statuses
                                            if (mEnd < now) {
                                                // past: slightly darker light gray for better contrast
                                                return 'bg-gray-300 text-slate-600';
                                            }
                                            if (mStart <= now && now < mEnd) {
                                                // ongoing: green with gradient highlight
                                                return 'bg-gradient-to-r from-cyan-700 to-cyan-500 text-white';
                                            }
                                            // upcoming: use same green as current (solid)
                                            return 'bg-cyan-600 text-white';
                                        };

                                        const bgClass = matched ? getMeetingClass(matched) : '';

                                        return (
                                            <div
                                                key={`${day.toString()}-${hour}`}
                                                onClick={() => handleOpenModal(day, hour)}
                                                onMouseEnter={() => matched && setHoveredBooking(matched)}
                                                onMouseMove={(e) => { if (matched) setTooltipPos({ x: e.clientX, y: e.clientY }); }}
                                                onMouseLeave={() => setHoveredBooking(null)}
                                                className={`p-1 h-12 cursor-pointer ${hasMeeting ? `${bgClass} border-0` : 'border-b border-r bg-white'} `}
                                            />
                                        );
                                    })}
                                </React.Fragment>
                            ))}
                        </div>
                    )}
                            {/* Hover tooltip */}
                    {hoveredBooking && (() => {
                        const backendBase = (process.env.REACT_APP_API_BASE_URL ? process.env.REACT_APP_API_BASE_URL.replace(/\/api\/?$/, '') : (process.env.NODE_ENV === 'development' ? 'http://localhost:5000' : ''));
                        return (
                        <div style={{ position: 'fixed', left: tooltipPos.x + 12, top: tooltipPos.y + 12, zIndex: 60, maxWidth: 360 }} className="bg-white border p-3 rounded shadow-lg">
                                    <div className="text-xs text-slate-600">{hoveredBooking.room_name}{/* room shown */}</div>
                                    <div className="mt-1">
                                        <span className="text-sm text-cyan-600">{new Date(hoveredBooking.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} đến {new Date(hoveredBooking.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        <span className="text-sm text-slate-400 ml-2">ngày {new Date(hoveredBooking.created_at || hoveredBooking.start_time).toLocaleDateString()}</span>
                                    </div>
                                    <div className="text-xs mt-2">{hoveredBooking.description}</div>
                                    <div className="text-xs mt-2">Đơn vị triển khai: {hoveredBooking.department_name || departmentsMap[hoveredBooking.department_id] || '-'}</div>
                                    <div className="text-xs">Số lượng: {hoveredBooking.attendees_count || '-'}</div>
                                    <div className="text-xs">Màn hình LED: {hoveredBooking.has_led ? 'Có' : 'Không'}</div>
                            {hoveredBooking.attachment_path && (
                                <div className="mt-2 text-xs">
                                    {(() => {
                                        try {
                                            const paths = typeof hoveredBooking.attachment_path === 'string' ? JSON.parse(hoveredBooking.attachment_path) : hoveredBooking.attachment_path;
                                            const arr = Array.isArray(paths) ? paths : [hoveredBooking.attachment_path];
                                            return arr.map((p, i) => {
                                                const name = p ? String(p).split('/').pop() : `file-${i}`;
                                                const url = `${backendBase}/${String(p).replace(/^\/+/, '')}`;
                                                return (
                                                    <div key={i} className="flex items-center justify-between gap-3">
                                                        <div className="text-sm text-slate-700 truncate" style={{ maxWidth: 220 }}>{name}</div>
                                                        <div className="flex items-center gap-2">
                                                                    <button onClick={() => window.open(url, '_blank', 'noopener,noreferrer')} className="px-2 py-1 bg-cyan-600 text-white rounded text-xs">Tải</button>
                                                                    <button onClick={() => setViewAttachment({ file_path: p, file_name: name })} className="px-2 py-1 bg-cyan-100 text-cyan-800 rounded text-xs">Xem</button>
                                                        </div>
                                                    </div>
                                                );
                                            });
                                        } catch (e) {
                                            const single = hoveredBooking.attachment_path;
                                            const name = single ? String(single).split('/').pop() : 'Tệp đính kèm';
                                            const url = `${backendBase}/${String(single).replace(/^\/+/, '')}`;
                                            return (
                                                <div key={name} className="flex items-center justify-between gap-3">
                                                    <div className="text-sm text-slate-700 truncate" style={{ maxWidth: 220 }}>{name}</div>
                                                    <div className="flex items-center gap-2">
                                                                <button onClick={() => window.open(url, '_blank', 'noopener,noreferrer')} className="px-2 py-1 bg-cyan-600 text-white rounded text-xs">Tải</button>
                                                                <button onClick={() => setViewAttachment({ file_path: single, file_name: name })} className="px-2 py-1 bg-cyan-100 text-cyan-800 rounded text-xs">Xem</button>
                                                    </div>
                                                </div>
                                            );
                                        }
                                    })()}
                                </div>
                            )}
                            {viewAttachment && (
                                <AttachmentViewerModal attachment={{ file_path: viewAttachment.file_path, file_name: viewAttachment.file_name }} onClose={() => setViewAttachment(null)} />
                            )}
                        </div>
                        )
                    })()}
                </div>
            </div>
        </>
    );
};

export default MeetingsPage;