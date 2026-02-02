import React, { useState, useEffect } from 'react';
import apiService from '../../services/apiService';
import useDepartments from '../../hooks/useDepartments';
import ModalWrapper from '../common/ModalWrapper';

// EditTaskModal: add department filter + dependent assignee list

const EditTaskModal = ({ isOpen, onClose, onSuccess, task, users }) => {
    const [formData, setFormData] = useState({
        title: '',
        assignee_id: '',
        due_date: '',
        priority: 'Trung bình',
        description: ''
    });
    const { departments } = useDepartments();
    const [allUsers, setAllUsers] = useState(Array.isArray(users) ? users : []);
    const [selectedDepartment, setSelectedDepartment] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (task) {
            setFormData({
                title: task.title || '',
                assignee_id: task.assignee_id || '',
                due_date: task.due_date ? new Date(task.due_date).toISOString().split('T')[0] : '',
                priority: task.priority || 'Trung bình',
                description: task.description || ''
            });
        }
    }, [task]);

    useEffect(() => {
        let mounted = true;
        const load = async () => {
            // departments provided by hook; no-op here for departments
            try {
                // Intentionally left blank
            } catch (e) { /* ignore */ }
            // if users prop not provided, fetch users list
            try {
                if (!Array.isArray(users) || users.length === 0) {
                    const us = await apiService.getUsers({ limit: 1000 });
                    if (!mounted) return;
                    const ulist = Array.isArray(us) ? us : (us.data || []);
                    setAllUsers(ulist);
                } else {
                    setAllUsers(users);
                }
            } catch (e) { /* ignore */ }
        };
        load();
        return () => { mounted = false; };
    }, [users]);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleDepartmentChange = (e) => {
        const dep = e.target.value;
        setSelectedDepartment(dep);
        // reset assignee if not in selected department
        const inDept = allUsers.find(u => String(u.id) === String(formData.assignee_id) && (String(u.department_id || u.department?.id || '') === String(dep)));
        if (!inDept) setFormData(fd => ({ ...fd, assignee_id: '' }));
    };

    const filteredAssignees = allUsers.filter(u => {
        if (!selectedDepartment) return true;
        return String(u.department_id || u.department?.id || '') === String(selectedDepartment);
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            await apiService.updateTask(task.id, formData);
            apiService.logEvent({ action: 'task.updated', resource_type: 'task', resource_id: task.id, details: formData.title || '', meta: { changes: formData } }).catch(() => {});
            onSuccess();
            onClose();
        } catch (err) {
            setError(err || 'Cập nhật thất bại. Vui lòng thử lại.');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <ModalWrapper isOpen={isOpen} onClose={onClose} maxWidth="max-w-lg" className="p-0 sm:p-6" coverHeader={true}>
                <h2 className="text-xl font-bold mb-4">Thay đổi thông tin công việc</h2>
                {error && <p className="text-red-500 bg-red-50 p-2 rounded-md text-sm mb-4">{error}</p>}
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Tên công việc</label>
                        <input name="title" value={formData.title} onChange={handleChange} required className="mt-1 input-style no-native-arrows" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Phòng ban / Đơn vị</label>
                        <select name="department" value={selectedDepartment} onChange={handleDepartmentChange} className="mt-1 input-style no-native-arrows">
                            <option value="">-- Tất cả --</option>
                            {departments.map(d => <option key={d.id} value={String(d.id)}>{d.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Người thực hiện</label>
                        <select name="assignee_id" value={formData.assignee_id} onChange={handleChange} className="mt-1 input-style no-native-arrows">
                            <option value="">-- Chọn người thực hiện --</option>
                            {filteredAssignees.map(user => <option key={user.id} value={String(user.id)}>{user.full_name}</option>)}
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Ngày hết hạn</label>
                            <input type="date" name="due_date" value={formData.due_date} onChange={handleChange} required className="mt-1 input-style no-native-arrows" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Độ ưu tiên</label>
                            <select name="priority" value={formData.priority} onChange={handleChange} className="mt-1 input-style no-native-arrows">
                                <option>Thấp</option>
                                <option>Trung bình</option>
                                <option>Cao</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Mô tả công việc</label>
                        <textarea name="description" rows="4" value={formData.description} onChange={handleChange} className="mt-1 input-style no-native-arrows" />
                    </div>
                    <div className="flex justify-end space-x-3 pt-4 border-t">
                        <button type="button" onClick={async () => {
                            if (!task || !task.id) return;
                            if (!window.confirm('Bạn chắc chắn muốn hủy công việc này?')) return;
                            try {
                                setLoading(true);
                                await apiService.updateTaskStatus(task.id, 'Đã hủy');
                                apiService.logEvent({ action: 'task.status.updated', resource_type: 'task', resource_id: task.id, details: 'Hủy bỏ bởi chỉnh sửa', meta: { status: 'Đã hủy' } }).catch(() => {});
                                if (typeof onSuccess === 'function') onSuccess();
                                onClose();
                            } catch (err) {
                                setError('Không thể hủy công việc.');
                            } finally { setLoading(false); }
                        }} className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded text-sm">Hủy bỏ công việc</button>
                        <button type="button" onClick={onClose} className="btn-secondary">Hủy</button>
                        <button type="submit" disabled={loading} className="btn-primary">
                            {loading ? 'Đang lưu...' : 'Lưu thay đổi'}
                        </button>
                    </div>
                </form>
            </ModalWrapper>
    );
};

export default EditTaskModal;