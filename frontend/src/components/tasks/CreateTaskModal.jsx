// ubndxanuicam/frontend/src/components/tasks/CreateTaskModal.jsx
// VERSION 2.2 - ADDED SMART ASSIGNEE DEFAULTS

import React, { useState, useEffect, useMemo } from 'react';
import { X } from 'lucide-react';
import apiService from '../../services/apiService';
import ModalWrapper from '../common/ModalWrapper';

const CreateTaskModal = ({ isOpen, onClose, onTaskCreated }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assigneeId, setAssigneeId] = useState(''); // Mặc định là chuỗi rỗng
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState('Trung bình');
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [selectedDept, setSelectedDept] = useState('');
  const [error, setError] = useState('');
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (isOpen) {
      const fetchData = async () => {
        setLoadingData(true);
        try {
          const [usersRes, deptsRes] = await Promise.all([
            apiService.getUsers({ limit: 1000 }),      
            apiService.getDepartments({ limit: 1000 }) 
          ]);
          setUsers(usersRes.data || []);
          setDepartments(deptsRes.data || []);
        } catch (err) {
          console.error("Lỗi tải dữ liệu:", err);
          setError("Không thể tải dữ liệu cần thiết cho việc tạo công việc.");
        } finally {
            setLoadingData(false);
        }
      };
      fetchData();
    } else {
        // Reset form khi modal đóng
        setTitle('');
        setDescription('');
        setAssigneeId('');
        setDueDate('');
        setPriority('Trung bình');
        setSelectedDept('');
        setError('');
    }
  }, [isOpen]);

  const filteredUsers = useMemo(() => {
    if (!selectedDept) return users;
    return users.filter(user => user.department_id === parseInt(selectedDept));
  }, [selectedDept, users]);

  // NÂNG CẤP: Tự động chọn người phụ trách khi phòng ban thay đổi
  useEffect(() => {
    if (selectedDept) {
        const department = departments.find(d => d.id === parseInt(selectedDept));
        if (department && department.manager_id) {
            // Kiểm tra xem manager có trong danh sách user đã lọc không
            const managerExistsInList = filteredUsers.some(u => u.id === department.manager_id);
            if(managerExistsInList) {
                setAssigneeId(department.manager_id);
            } else {
                setAssigneeId(''); // Reset nếu không tìm thấy
            }
        } else {
            setAssigneeId(''); // Reset nếu phòng ban không có người phụ trách
        }
    } else {
        setAssigneeId(''); // Reset khi chọn "Tất cả người dùng"
    }
  }, [selectedDept, departments, filteredUsers]);


  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!assigneeId) {
        setError('Vui lòng chọn người thực hiện công việc.');
        return;
    }
    setError('');
    try {
      await apiService.createTask({
        title, 
        description, 
        assignee_id: assigneeId, 
        due_date: dueDate, 
        priority 
      });
      try { apiService.logEvent({ action: 'task.created', resource_type: 'task', details: title, meta: { assignee_id: assigneeId } }); } catch(e){}
      onTaskCreated();
    } catch (err) {
      setError(err || 'Không thể tạo công việc.');
    }
  };

  if (!isOpen) return null;

  return (
    <ModalWrapper isOpen={isOpen} onClose={onClose} maxWidth="md:max-w-lg" className="p-6 w-full">
        <div className="flex justify-between items-center pb-4 border-b">
          <h3 className="text-lg font-semibold text-slate-800">Tạo công việc mới</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X /></button>
        </div>
        
        {loadingData ? <div className="py-10 text-center">Đang tải dữ liệu...</div> : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Tên công việc</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required className="mt-1 input-style" />
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-700">Chọn phòng ban/Đơn vị (để lọc)</label>
                <select value={selectedDept} onChange={(e) => setSelectedDept(e.target.value)} className="mt-1 input-style">
                    <option value="">-- Tất cả phòng ban --</option>
                    {departments.map(dept => <option key={dept.id} value={dept.id}>{dept.name}</option>)}
                </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Giao cho</label>
              <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} required className="mt-1 input-style">
                {/* NÂNG CẤP: Bổ sung lựa chọn mặc định */}
                <option value="" disabled>-- Chọn người tiếp nhận --</option>
                {filteredUsers.map(user => <option key={user.id} value={user.id}>{user.full_name}</option>)}
              </select>
            </div>
            <div className="flex space-x-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-slate-700">Ngày hết hạn</label>
                <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required className="mt-1 input-style" />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-slate-700">Độ ưu tiên</label>
                <select value={priority} onChange={(e) => setPriority(e.target.value)} className="mt-1 input-style">
                  <option>Thấp</option>
                  <option>Trung bình</option>
                  <option>Cao</option>
                </select>
              </div>
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-700">Mô tả (tùy chọn)</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows="3" className="mt-1 input-style" />
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}
            <div className="flex justify-end pt-4 border-t mt-6">
              <button type="button" onClick={onClose} className="btn-secondary mr-2">Hủy</button>
              <button type="submit" className="btn-primary">Tạo công việc</button>
            </div>
          </form>
        )}
      </ModalWrapper>
  );
};

export default CreateTaskModal;