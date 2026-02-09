// ubndxanuicam/frontend/src/pages/MeetingRoomPage.jsx
// VERSION 2.2 - RE-ENGINEERED LAYOUT AND LOGIC

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { CalendarPlus, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, addDays } from 'date-fns';
import { vi } from 'date-fns/locale';
import apiService from '../services/apiService';
import useAuth from '../hooks/useAuth';
import Spinner from '../components/common/Spinner';
import RoomBookingModal from '../components/meetings/RoomBookingModal';
import Notification from '../components/common/Notification';
import DeleteConfirmationModal from '../components/common/DeleteConfirmationModal';
import './MeetingRoomPage.css';

const ROOMS = ['Phòng họp lầu 2', 'Hội trường UBND', 'Phòng tiếp công dân'];

const MeetingRoomPage = () => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalState, setModalState] = useState({ isOpen: false, room: null, time: null });
    const [editingBooking, setEditingBooking] = useState(null);
    const [popover, setPopover] = useState({ visible: false, x: 0, y: 0, booking: null });
    const { user } = useAuth();
    const [notification, setNotification] = useState({ message: '', type: '' });
    const [confirmDelete, setConfirmDelete] = useState({ open: false, booking: null });
    const [dayStartHour, setDayStartHour] = useState(7);
    const [dayEndHour, setDayEndHour] = useState(17);
    // mergeGapMinutes removed (not used) to avoid ESLint unused-vars warnings

    const { weekStart, weekEnd } = useMemo(() => {
        const start = startOfWeek(currentDate, { weekStartsOn: 1 });
        const end = endOfWeek(currentDate, { weekStartsOn: 1 });
        return { weekStart: start, weekEnd: end };
    }, [currentDate]);

    const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

    const fetchBookings = useCallback(async () => {
        setLoading(true);
        try {
            const params = { start: weekStart.toISOString(), end: weekEnd.toISOString() };
            const data = await apiService.getRoomBookings(params);
            setBookings(data);
        } catch (error) {
            setNotification({ message: 'Không thể tải lịch đặt phòng.', type: 'error' });
        } finally {
            setLoading(false);
        }
    }, [weekStart, weekEnd]);

    useEffect(() => {
        fetchBookings();
    }, [fetchBookings]);

    const handleCellClick = (room, day, hour = 7) => {
        const selectedTime = new Date(day);
        selectedTime.setHours(hour, 0, 0, 0);
        setEditingBooking(null);
        setModalState({ isOpen: true, room, time: selectedTime });
    };

    const handleSuccess = (ctx) => {
        fetchBookings();
        // allow child to pass context e.g. { action: 'deleted_file', filename }
        if (ctx && ctx.action === 'deleted_file') {
            setNotification({ message: `Đã xóa file ${ctx.filename} thành công!`, type: 'success' });
        } else {
            setNotification({ message: 'Yêu cầu đặt phòng đã được gửi đi!', type: 'success' });
        }
    };
    
    // Booking color/group helpers were removed to avoid unused-vars warnings
    
    // CẢI TIẾN: Nhóm các lịch đặt theo phòng và ngày để dễ render
    const bookingsByRoomAndDay = useMemo(() => {
        const grouped = {};
        bookings.forEach(b => {
            const dayKey = format(new Date(b.start_time), 'yyyy-MM-dd');
            if (!grouped[b.room_name]) grouped[b.room_name] = {};
            if (!grouped[b.room_name][dayKey]) grouped[b.room_name][dayKey] = [];
            grouped[b.room_name][dayKey].push(b);
        });
        return grouped;
    }, [bookings]);

    const getBookingGradient = (booking) => {
        const now = Date.now();
        const end = booking && booking.end_time ? new Date(booking.end_time).getTime() : 0;
        // Past meetings -> dark gray
        if (end && end < now) return 'linear-gradient(90deg,#6b7280,#374151)';
        const status = (booking && booking.status) ? String(booking.status).toLowerCase() : '';
        // Rejected -> red
        if (status.includes('từ chối') || status.includes('tucho') ) return 'linear-gradient(90deg,#ef4444,#dc2626)';
        // Pending -> yellow
        if (status.includes('chờ') || status.includes('chờ phê duyệt')) return 'linear-gradient(90deg,#facc15,#f59e0b)';
        // Approved -> green gradient
        if (status.includes('đã duyệt') || status.includes('duyệt')) return 'linear-gradient(90deg,#06b6d4,#0891b2)';
        // Default upcoming -> green
        return 'linear-gradient(90deg,#06b6d4,#0891b2)';
    };

    return (
        <>
            <style>{`
                .moving-gradient { background-size: 200% 100%; animation: moveGradient 6s linear infinite; }
                @keyframes moveGradient { 0% { background-position: 0% 50%; } 100% { background-position: 100% 50%; } }
            `}</style>
            <Notification message={notification.message} type={notification.type} onClose={() => setNotification({ message: '', type: '' })} />
            <RoomBookingModal 
                isOpen={modalState.isOpen}
                onClose={() => { setModalState({ isOpen: false, room: null, time: null }); setEditingBooking(null); }}
                onSuccess={handleSuccess}
                selectedRoom={modalState.room}
                selectedTime={modalState.time}
                booking={editingBooking}
            />
            {/* Delete confirmation modal for bookings */}
            {confirmDelete.open && (
                <DeleteConfirmationModal isOpen={true} onClose={() => setConfirmDelete({ open: false, booking: null })} title="Xác nhận xóa lịch" message={`Bạn có chắc muốn xóa lịch "${confirmDelete.booking?.title || ''}" không?`} onConfirm={async () => {
                    try {
                        await apiService.deleteRoomBooking(confirmDelete.booking.id);
                        try { apiService.logEvent({ module: 'Đặt phòng', action: 'Xóa', details: confirmDelete.booking?.title || '', resource_type: 'room_booking', resource_id: confirmDelete.booking.id, change: confirmDelete.booking }).catch(()=>{}); } catch(e){}
                        await fetchBookings();
                        setNotification({ message: 'Xóa thành công', type: 'success' });
                    } catch (err) {
                        const msg = err && err.message ? err.message : (typeof err === 'string' ? err : JSON.stringify(err));
                        setNotification({ message: msg || 'Xóa thất bại', type: 'error' });
                    }
                }} />
            )}
            <div>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                    <div className="flex items-center">
                        <CalendarPlus className="w-8 h-8 text-teal-600 mr-4" />
                        <div>
                            <h1 className="text-3xl font-bold text-slate-800">Đăng ký phòng họp</h1>
                            <p className="mt-1 text-slate-500">Xem và đặt lịch sử dụng phòng họp, hội trường.</p>
                        </div>
                        {/* Global popover: render once, positioned by `popover` state */}
                        {popover.visible && popover.booking && (
                                <div className="booking-popover" style={{ position: 'fixed', left: popover.x, top: popover.y, zIndex: 60, minWidth: 260 }}>
                                    <div className="bg-white shadow rounded p-3 text-sm text-slate-800">
                                        {popover.booking.map((b, i) => (
                                            <div key={i} className="mb-2">
                                                <div className="font-semibold">{b.title}</div>
                                                {b.leader_name && <div className="text-xs text-slate-600">Chủ trì: <strong className="text-red-600">{b.leader_name}</strong></div>}
                                                <div className="text-xs text-slate-500 flex items-center gap-2">
                                                    <span>Ngày <strong className="text-blue-600">{format(new Date(b.start_time), 'dd/MM/yyyy')}</strong></span>
                                                    <span className="text-slate-600">vào lúc</span>
                                                    <strong className="text-blue-600">{format(new Date(b.start_time), 'HH:mm')} - {format(new Date(b.end_time), 'HH:mm')}</strong>
                                                </div>
                                                {(() => {
                                                    const a = Number(b.attendees_count);
                                                    const o = Number(b.other_invited_count);
                                                    const parts = [];
                                                    if (!isNaN(a) && a > 0) {
                                                        parts.push(<div key="a" className="popover-attendees text-xs mt-1">Số lượng Đại biểu: <strong>{a}</strong></div>);
                                                    }
                                                    if (!isNaN(o) && o > 0) {
                                                        parts.push(<div key="o" className="popover-attendees text-xs mt-1">Khách mời: <strong>{o}</strong></div>);
                                                    }
                                                    return parts.length ? parts : null;
                                                })()}
                                                { (b.basis_super || b.basis_commune) && (
                                                    <div className="mt-2 flex items-center gap-2">
                                                        {b.basis_super && <span className="basis-super-badge">{b.basis_super}</span>}
                                                        {b.basis_commune && <span className="basis-commune-badge">{b.basis_commune}</span>}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setCurrentDate(addDays(currentDate, -7))} className="p-2 rounded-full hover:bg-slate-100"><ChevronLeft size={20} /></button>
                        <span className="text-lg font-semibold text-slate-700 w-48 text-center">
                            {format(weekStart, 'dd/MM')} - {format(weekEnd, 'dd/MM/yyyy')}
                        </span>
                        <button onClick={() => setCurrentDate(addDays(currentDate, 7))} className="p-2 rounded-full hover:bg-slate-100"><ChevronRight size={20} /></button>
                        <div className="ml-3 flex items-center gap-3 time-range">
                            <span className="text-sm text-slate-600">Khung giờ</span>
                            <div className="inline-flex items-center rounded-md bg-white border shadow-sm overflow-hidden">
                                <select value={dayStartHour} onChange={(e) => setDayStartHour(parseInt(e.target.value))} className="time-select">
                                    {Array.from({length:24}).map((_,h)=>(<option key={h} value={h}>{String(h).padStart(2,'0')}:00</option>))}
                                </select>
                                <div className="px-2 text-sm text-slate-500">—</div>
                                <select value={dayEndHour} onChange={(e) => setDayEndHour(parseInt(e.target.value))} className="time-select">
                                    {Array.from({length:24}).map((_,h)=>(<option key={h} value={h}>{String(h).padStart(2,'0')}:00</option>))}
                                </select>
                            </div>
                        </div>
                        {user && Array.isArray(user.permissions) && (user.permissions.includes('room_booking_management') || user.permissions.includes('full_access')) && (
                            <>
                                <button onClick={() => window.location.href = '/meeting-room/deleted-attachments'} className="ml-3 inline-flex items-center px-3 py-1 bg-gray-100 rounded text-sm">Tệp đã xóa</button>
                                <button onClick={() => window.location.href = '/meeting-room/deleted'} className="ml-3 inline-flex items-center px-3 py-1 bg-gray-100 rounded text-sm">Cuộc họp đã xóa</button>
                            </>
                        )}
                    </div>
                </div>

                <div className="bg-white p-4 rounded-lg shadow-lg overflow-x-auto">
                    {loading ? <div className="h-[500px] flex justify-center items-center"><Spinner/></div> : (
                        <div className="grid meeting-grid">
                            {/* Header: Cột trống và các ngày trong tuần */}
                            <div className="sticky left-0 bg-white z-10"></div>
                            {days.map(day => (
                                <div key={day.toString()} className="text-center p-2 border-b border-l">
                                    <p className="font-semibold text-sm capitalize">{format(day, 'eee', { locale: vi })}</p>
                                    <p className="text-lg">{format(day, 'd')}</p>
                                </div>
                            ))}
                            
                            {/* Body: Tên phòng và lưới lịch */}
                            {ROOMS.map(room => (
                                <React.Fragment key={room}>
                                    <div className="sticky left-0 bg-white z-10 font-bold text-slate-700 text-sm p-2 border-b border-r flex items-center justify-center text-center room-name">{room}</div>
                                    {days.map(day => {
                                        const dayKey = format(day, 'yyyy-MM-dd');
                                        const dayBookings = bookingsByRoomAndDay[room]?.[dayKey] || [];
                                        // Sort bookings by start_time and group adjacent ones so
                                        // they can be rendered as a single animated gradient bar.
                                        // New approach: compute fixed horizontal slots (hourly) across the configured day range
                                        // and merge contiguous occupied slots into spans. This ensures contiguous occupied time
                                        // ranges (e.g., 07:00-11:00) render as a single block regardless of how many bookings inside.
                                        const dayStart = new Date(day);
                                        dayStart.setHours(dayStartHour,0,0,0);
                                        const dayEnd = new Date(day);
                                        dayEnd.setHours(dayEndHour,0,0,0);
                                        const sorted = Array.isArray(dayBookings) ? [...dayBookings].sort((a,b)=>new Date(a.start_time) - new Date(b.start_time)) : [];

                                        const slots = [];
                                        const slotMinutes = 60; // hourly slots
                                        const totalSlots = Math.max(1, Math.floor((dayEnd.getTime() - dayStart.getTime()) / (slotMinutes * 60 * 1000)));
                                        for (let si = 0; si < totalSlots; si++) {
                                            const sStart = new Date(dayStart.getTime() + si * slotMinutes * 60 * 1000);
                                            const sEnd = new Date(sStart.getTime() + slotMinutes * 60 * 1000);
                                            const bookingsInSlot = sorted.filter(b => new Date(b.start_time).getTime() < sEnd.getTime() && new Date(b.end_time).getTime() > sStart.getTime());
                                            slots.push({ start: sStart, end: sEnd, bookings: bookingsInSlot, occupied: bookingsInSlot.length > 0 });
                                        }

                                        const spans = [];
                                        for (let i = 0; i < slots.length; i++) {
                                            if (!slots[i].occupied) continue;
                                            let j = i;
                                            const mergedBookings = [...slots[i].bookings];
                                            while (j + 1 < slots.length && slots[j + 1].occupied) {
                                                mergedBookings.push(...slots[j + 1].bookings);
                                                j++;
                                            }
                                            spans.push({ startSlot: i, endSlot: j, bookings: mergedBookings });
                                            i = j;
                                        }

                                        // Use spans as groups for rendering
                                        const groups = spans.map(s => ({ bookings: s.bookings, spanStart: s.startSlot, spanEnd: s.endSlot }));

                                        // compute a sensible min height based on number of stacked groups
                                        const cellMinHeight = Math.max(140, (groups.length * 48) + 24);

                                        // prepare placement into up to 2 rows to avoid overlap; earlier bookings prefer row 0
                                        const groupsSorted = groups.map(g => ({ ...g, startTime: new Date(g.bookings[0].start_time).getTime(), endTime: new Date(g.bookings[g.bookings.length-1].end_time).getTime() })).sort((a,b)=>a.startTime - b.startTime);
                                        const rows = [[], []];
                                        const placedGroups = groupsSorted.map(g => ({ ...g }));
                                        // helper to compute left and width percentage within day
                                        const computeLR = (g) => {
                                            const firstBooking = g.bookings[0];
                                            const lastBooking = g.bookings[g.bookings.length - 1];
                                            const start = new Date(firstBooking.start_time);
                                            const end = new Date(lastBooking.end_time);
                                            const dayStart = new Date(day);
                                            dayStart.setHours(dayStartHour,0,0,0);
                                            const dayEnd = new Date(day);
                                            dayEnd.setHours(dayEndHour,0,0,0);
                                            const clampStart = Math.max(start.getTime(), dayStart.getTime());
                                            const clampEnd = Math.min(end.getTime(), dayEnd.getTime());
                                            const total = (dayEnd.getTime() - dayStart.getTime()) || 1;
                                            const left = ((clampStart - dayStart.getTime()) / total) * 100;
                                            const width = Math.max(1, ((clampEnd - clampStart) / total) * 100);
                                            return { left, width };
                                        };
                                        for (const g of placedGroups) {
                                            const lr = computeLR(g);
                                            let placed = false;
                                            for (let ri = 0; ri < rows.length; ri++) {
                                                const overlaps = rows[ri].some(ex => {
                                                    const exlr = computeLR(ex);
                                                    return !(lr.right <= exlr.left || lr.left >= exlr.right);
                                                });
                                                if (!overlaps) { rows[ri].push(g); g._row = ri; placed = true; break; }
                                            }
                                            if (!placed) { g._row = Math.min(2, rows.length); rows.push([g]); }
                                        }

                                        return (
                                            <div key={day.toString()} className="cell-with-bars border-b border-l bg-slate-50/50 hover:bg-slate-100 cursor-pointer" style={{ minHeight: `${cellMinHeight}px` }} onClick={() => handleCellClick(room, day, 7)}>
                                                <div className="cell-inner p-1" style={{ position: 'relative', minHeight: '100%' }}>
                                                {placedGroups.map((g, gi) => {
                                                    const firstBooking = g.bookings[0];
                                                    const lastBooking = g.bookings[g.bookings.length - 1];
                                                    const now = Date.now();
                                                    const ongoing = g.bookings.some(b => now >= new Date(b.start_time).getTime() && now <= new Date(b.end_time).getTime());
                                                    const gradient = getBookingGradient(firstBooking);
                                                    const rowIndex = (typeof g._row === 'number') ? g._row : 0;
                                                    const barTop = 12 + rowIndex * 56;
                                                    // dedupe bookings for popover
                                                    const unique = Array.from(new Map(g.bookings.map(b => [b.id, b])).values());
                                                    return (
                                                        <div
                                                            key={`group-${gi}`}
                                                            style={{ left: `0%`, width: `100%`, top: `${barTop}px`, zIndex: ongoing ? 30 : 10, background: gradient }}
                                                            className={`booking-bar ${ongoing ? 'moving-gradient' : ''}`}
                                                            onClick={(e) => { e.stopPropagation(); setEditingBooking(firstBooking); setModalState({ isOpen: true, room: firstBooking.room_name, time: firstBooking.start_time }); }}
                                                            onMouseEnter={(e) => {
                                                                const r = e.currentTarget.getBoundingClientRect();
                                                                const popWidth = 360;
                                                                let px = r.right + 8;
                                                                if (px + popWidth > (window.innerWidth - 8)) {
                                                                    px = Math.max(8, r.left - popWidth - 8);
                                                                }
                                                                // estimate popover height and flip vertically if it would overflow bottom
                                                                const estHeight = Math.min(480, unique.length * 72 + 40);
                                                                let py = r.top;
                                                                if (r.top + estHeight > window.innerHeight - 8) {
                                                                    py = Math.max(8, r.bottom - estHeight - 8);
                                                                }
                                                                setPopover({ visible: true, x: px, y: py, booking: unique });
                                                            }}
                                                            onMouseLeave={() => setPopover({ visible: false, x: 0, y: 0, booking: null })}
                                                        >
                                                            <div className="flex-1 min-w-0 text-left">
                                                                {(() => {
                                                                    const a = Number(firstBooking.attendees_count) || 0;
                                                                    const o = Number(firstBooking.other_invited_count) || 0;
                                                                    const total = a + o;
                                                                    return (
                                                                        <div className="bar-title-row" title={firstBooking.title}>
                                                                            <span className="bar-title">{firstBooking.title}</span>
                                                                            {total > 0 && <span className="bar-count">({total}+)</span>}
                                                                        </div>
                                                                    );
                                                                })()}
                                                                <p className="text-white/80 text-[11px]">{format(new Date(firstBooking.start_time), 'HH:mm')} - {format(new Date(lastBooking.end_time), 'HH:mm')}</p>
                                                                {(firstBooking.basis_super || firstBooking.basis_commune) && (
                                                                    <p className="text-white/80 text-[11px] mt-1 truncate">{[firstBooking.basis_super, firstBooking.basis_commune].filter(Boolean).join(' > ')}</p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                                </div>
                                                {/* popover rendered globally (moved below grid) */}
                                            </div>
                                        )
                                    })}
                                </React.Fragment>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

export default MeetingRoomPage;