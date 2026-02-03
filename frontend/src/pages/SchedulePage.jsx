// ubndxanuicam/frontend/src/pages/SchedulePage.jsx
// VERSION 2.2 - FINALIZED WITH CORRECT DATE COMPARISON

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import useAuth from '../hooks/useAuth';
import apiService from '../services/apiService';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isToday, addMonths, subMonths, startOfWeek, endOfWeek, isSameMonth, isSameDay } from 'date-fns';
import { vi } from 'date-fns/locale';
import EventModal from '../components/schedule/EventModal';
import Spinner from '../components/common/Spinner';
import Notification from '../components/common/Notification';

const SchedulePage = () => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [notification, setNotification] = useState({ message: '', type: '' });

    const { hasPermission } = useAuth();
    const canManageEvents = hasPermission(['event_management']);

    const monthStart = useMemo(() => startOfMonth(currentDate), [currentDate]);
    const monthEnd = useMemo(() => endOfMonth(currentDate), [currentDate]);
    
    const fetchEvents = useCallback(async () => {
        setLoading(true);
        try {
            const params = {
                start: startOfWeek(monthStart, { weekStartsOn: 1 }).toISOString(),
                end: endOfWeek(monthEnd, { weekStartsOn: 1 }).toISOString(),
            };
            const data = await apiService.getEvents(params);
            setEvents(data);
        } catch (error) {
            console.error("Lỗi khi tải sự kiện:", error);
            setNotification({ message: 'Không thể tải dữ liệu lịch làm việc.', type: 'error' });
        } finally {
            setLoading(false);
        }
    }, [monthStart, monthEnd]);

    useEffect(() => {
        fetchEvents();
    }, [fetchEvents]);
    
    const daysInMonth = useMemo(() => eachDayOfInterval({ 
        start: startOfWeek(monthStart, { weekStartsOn: 1 }), 
        end: endOfWeek(monthEnd, { weekStartsOn: 1 }) 
    }), [monthStart, monthEnd]);

    const handleOpenModal = (event = null, date = new Date()) => {
        if (!canManageEvents && event === null) return;
        setSelectedEvent(event);
        setSelectedDate(date);
        setIsModalOpen(true);
    };

    const handleSuccess = () => {
        fetchEvents();
        setNotification({ message: selectedEvent ? 'Cập nhật sự kiện thành công!' : 'Tạo sự kiện mới thành công!', type: 'success' });
    };

    return (
        <>
            <Notification 
                message={notification.message}
                type={notification.type}
                onClose={() => setNotification({ message: '', type: '' })}
            />
            <EventModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={handleSuccess}
                eventData={selectedEvent}
                selectedDate={selectedDate}
            />
            <div>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                    <div className="flex items-center">
                        <Calendar className="w-8 h-8 text-red-600 mr-4" />
                        <div>
                            <h1 className="text-3xl font-bold text-slate-800">Lịch làm việc</h1>
                            <p className="mt-1 text-slate-500">Quản lý lịch trình và sự kiện của đơn vị.</p>
                        </div>
                    </div>
                    {/* Action buttons */}
                    <div className="flex items-center gap-2">
                        {canManageEvents && (
                            <>
                                <button onClick={() => window.location.href = '/schedule/deleted-attachments'} className="ml-3 inline-flex items-center px-3 py-1 bg-gray-100 rounded text-sm">Tệp đã xóa</button>
                                <button onClick={() => window.location.href = '/schedule/deleted'} className="ml-3 inline-flex items-center px-3 py-1 bg-gray-100 rounded text-sm">Lịch đã xóa</button>
                            </>
                        )}
                    </div>
                </div>
                <div className="bg-white p-4 sm:p-6 rounded-lg shadow-lg">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="p-2 rounded-full hover:bg-slate-100"><ChevronLeft size={20} /></button>
                            <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-2 rounded-full hover:bg-slate-100"><ChevronRight size={20} /></button>
                            <button onClick={() => setCurrentDate(new Date())} className="px-3 py-1.5 text-sm border rounded-md hover:bg-slate-50">Hôm nay</button>
                        </div>
                        <h2 className="text-xl font-semibold text-slate-800 capitalize">
                            {format(currentDate, 'MMMM yyyy', { locale: vi })}
                        </h2>
                    </div>

                    <div className="grid grid-cols-7 border-t border-l border-slate-200">
                        {['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ Nhật'].map(day => (
                            <div key={day} className="text-center py-2 text-xs font-semibold text-slate-600 bg-slate-50 border-r border-b">
                                {day}
                            </div>
                        ))}
                        
                        {daysInMonth.map(day => {
                            const dayEvents = events.filter(e => isSameDay(new Date(e.start_time), day));
                            const dayCellClass = `relative border-r border-b p-2 min-h-[120px] ${!isSameMonth(day, currentDate) ? 'bg-slate-50' : 'bg-white'} ${canManageEvents ? 'cursor-pointer hover:bg-slate-50' : ''}`;
                            return (
                                <div
                                    key={day.toString()}
                                    className={dayCellClass}
                                    onClick={() => { if (canManageEvents) handleOpenModal(null, day); }}
                                    title={canManageEvents && dayEvents.length === 0 ? 'Thêm lịch mới' : undefined}
                                >
                                    <time dateTime={format(day, 'yyyy-MM-dd')} className={`text-sm font-semibold ${isToday(day) ? 'bg-blue-600 text-white rounded-full w-7 h-7 flex items-center justify-center' : 'text-slate-700'}`}>
                                        {format(day, 'd')}
                                    </time>
                                    <div className="mt-1 space-y-1">
                                        {dayEvents.map((event) => (
                                            <div key={event.id} onClick={(e) => { e.stopPropagation(); handleOpenModal(event, day); }} className={`text-xs p-1 bg-blue-100 text-blue-800 rounded truncate ${canManageEvents ? 'cursor-pointer hover:bg-blue-200' : ''}`}>
                                                {format(new Date(event.start_time), 'HH:mm')} - {event.title}
                                            </div>
                                        ))}
                                        {/* empty placeholder area - hover shows tooltip to add event */}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    {loading && <div className="py-4"><Spinner /></div>}
                </div>
            </div>
        </>
    );
};

export default SchedulePage;