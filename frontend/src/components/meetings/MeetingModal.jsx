import React, { useState, useEffect, useMemo } from 'react';
import apiService from '../../services/apiService';
import useDepartments from '../../hooks/useDepartments';
import { X } from 'lucide-react';
import ModalWrapper from '../common/ModalWrapper';

const MeetingModal = ({ isOpen, onClose, onSuccess, initialDateTime }) => {
    const [formData, setFormData] = useState({
        title: '',
        room: '',
        startTime: '',
        endTime: '',
        participants: [],
        description: ''
    });
    const [allUsers, setAllUsers] = useState([]);
    const { departments: allDepartments } = useDepartments();
    const [selectedDept, setSelectedDept] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen) {
            const fetchData = async () => {
                try {
                    const usersRes = await apiService.getUsers({ limit: 1000 }); // Lấy toàn bộ user
                        setAllUsers(usersRes.data || []);
                } catch (err) {
                    console.error("Lỗi khi tải dữ liệu:", err);
                    setError("Không thể tải dữ liệu cần thiết.");
                }
            };
            fetchData();
            
            if (initialDateTime) {
                const start = initialDateTime;
                const snappedStart = new Date(Math.round(start.getTime() / (15 * 60 * 1000)) * (15 * 60 * 1000));
                const end = new Date(snappedStart.getTime() + 60 * 60 * 1000);
                setFormData(prev => ({
                    ...prev,
                    startTime: snappedStart.toISOString().slice(0, 16),
                    endTime: end.toISOString().slice(0, 16),
                }));
            }
        } else {
            setFormData({ title: '', room: '', startTime: '', endTime: '', participants: [], description: '' });
            setSelectedDept('');
            setError('');
        }
    }, [isOpen, initialDateTime]);

    const filteredUsers = useMemo(() => {
        if (!selectedDept) return allUsers;
        return allUsers.filter(user => String(user.department_id) === String(selectedDept));
    }, [selectedDept, allUsers]);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleParticipantChange = (userId) => {
        const id = parseInt(userId, 10);
        setFormData(prev => {
            const newParticipants = prev.participants.includes(id)
                ? prev.participants.filter(pId => pId !== id)
                : [...prev.participants, id];
            return { ...prev, participants: newParticipants };
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            await apiService.createMeeting(formData);
            onSuccess();
            onClose();
        } catch (err) {
            setError(err || 'Không thể tạo cuộc họp. Vui lòng kiểm tra lại thông tin.');
        } finally {
            setLoading(false);
        }
    };
    
    if (!isOpen) return null;

    return (
        <ModalWrapper isOpen={isOpen} onClose={onClose} maxWidth="max-w-lg" className="p-6 max-h-[90vh] flex flex-col">
                 <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-slate-800">
                        Đăng ký lịch họp
                        {formData.participants.length > 0 && (
                            <span className="ml-3 text-sm font-semibold text-blue-700 bg-blue-100 px-2.5 py-1 rounded-full">
                                Đã chọn {formData.participants.length}
                            </span>
                        )}
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X /></button>
                </div>

                {error && <p className="text-red-500 text-sm mb-4 bg-red-50 p-3 rounded-lg">{error}</p>}
                <form id="meeting-form" onSubmit={handleSubmit} className="space-y-4 overflow-y-auto flex-grow pr-2">
                     <div>
                        <label className="block text-sm font-medium text-slate-700">Tiêu đề cuộc họp</label>
                        <input name="title" value={formData.title} onChange={handleChange} required className="mt-1 input-style" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Bắt đầu</label>
                            <input
                                name="startTime"
                                type="datetime-local"
                                value={formData.startTime}
                                onChange={handleChange}
                                required
                                className="mt-1 input-style"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Kết thúc</label>
                            <input
                                name="endTime"
                                type="datetime-local"
                                value={formData.endTime}
                                onChange={handleChange}
                                required
                                className="mt-1 input-style"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Phòng họp</label>
                        <select name="room" value={formData.room} onChange={handleChange} required className="mt-1 input-style">
                            <option value="">-- Chọn phòng --</option>
                            <option>Phòng họp lầu 2</option>
                            <option>Hội trường UBND</option>
                            <option>Phòng tiếp công dân</option>
                        </select>
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-slate-700">Nội dung (tùy chọn)</label>
                        <textarea name="description" value={formData.description} onChange={handleChange} rows="3" className="mt-1 input-style" />
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-slate-700">Lọc theo phòng ban</label>
                        <select value={selectedDept} onChange={(e) => setSelectedDept(e.target.value)} className="mt-1 input-style">
                            <option value="">-- Tất cả người dùng --</option>
                            {allDepartments.map(dept => <option key={dept.id} value={String(dept.id)}>{dept.name}</option>)}
                        </select>
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Thành phần tham dự</label>
                        <div className="max-h-40 overflow-y-auto border rounded-md p-2 space-y-2">
                            {filteredUsers.map(user => (
                                <div key={user.id} className="flex items-center">
                                    <input
                                        type="checkbox"
                                        id={`user-${user.id}`}
                                        checked={formData.participants.includes(user.id)}
                                        onChange={() => handleParticipantChange(user.id)}
                                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <label htmlFor={`user-${user.id}`} className="ml-2 text-sm text-slate-800">{user.full_name}</label>
                                </div>
                            ))}
                        </div>
                    </div>
                </form>
                <div className="flex justify-end space-x-3 pt-4 border-t mt-6">
                    <button type="button" onClick={onClose} className="btn-secondary">Hủy</button>
                    <button type="submit" form="meeting-form" disabled={loading} className="btn-primary">
                        {loading ? 'Đang lưu...' : 'Lưu lịch họp'}
                    </button>
                </div>
            </ModalWrapper>
    );
};

export default MeetingModal;