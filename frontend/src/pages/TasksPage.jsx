// ubndxanuicam/frontend/src/pages/TasksPage.jsx
// VERSION 3.1 - FINALIZED AND HARDENED DATA FETCHING

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import useAuth from '../hooks/useAuth';
import apiService from '../services/apiService';
import { Link } from 'react-router-dom';
import RotatingSlogans from '../components/common/RotatingSlogans';
import useOutsideClick from '../components/common/useOutsideClick';
import { Plus } from 'lucide-react';
import Spinner from '../components/common/Spinner';
import CreateTaskModal from '../components/tasks/CreateTaskModal';
import TaskDetailModal from '../components/tasks/TaskDetailModal';
import TaskColumn from '../components/tasks/TaskColumn';
import Notification from '../components/common/Notification';

const TasksPage = () => {
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const { hasPermission } = useAuth();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [notification, setNotification] = useState({ message: '', type: '' });
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = React.useRef(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [exportFormat, setExportFormat] = useState(null);
  const [exportPassword, setExportPassword] = useState('');
  const [exportLoading, setExportLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [tasksRes, usersRes] = await Promise.all([
        apiService.getTasks(),
        apiService.getUsers({ limit: 1000 }) // Lấy toàn bộ user cho dropdown
      ]);
      
      setTasks(tasksRes || []);
      // SỬA LỖI QUAN TRỌNG: Chỉ lấy mảng 'data' từ kết quả API
      setUsers(usersRes.data || []); 

    } catch (error) {
      console.error("Lỗi khi tải dữ liệu trang công việc:", error);
      setNotification({ message: 'Không thể tải dữ liệu công việc.', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Close export menu when clicking outside or pressing Escape
  useOutsideClick(exportMenuRef, () => setShowExportMenu(false), showExportMenu);
  
  const canCreateTask = hasPermission(['create_task']);

  const columns = useMemo(() => ({
    'all': tasks,
    'new_and_pending': tasks.filter(t => ['Mới tạo', 'Tiếp nhận', 'Yêu cầu làm lại'].includes(t.status)),
    'in_progress': tasks.filter(t => t.status === 'Đang thực hiện'),
    'reviewing': tasks.filter(t => t.status === 'Chờ duyệt'),
    'overdue': tasks.filter(t => {
      try {
        if (!t.due_date) return false;
        const due = new Date(t.due_date);
        if (Number.isNaN(due.getTime())) return false;
        return due < new Date() && t.status !== 'Hoàn thành' && !(t.status === 'Đã hủy' || t.status === 'Đã Hủy');
      } catch (e) { return false; }
    }),
    'completed': tasks.filter(t => t.status === 'Hoàn thành'),
    // 'cancelled' removed; deleted tasks are managed on a dedicated page
  }), [tasks]);

  const [activeTab, setActiveTab] = useState('all');
  const tabs = [
    { key: 'all', label: 'Tất cả công việc', short: 'Tất cả' },
    { key: 'new_and_pending', label: 'Mới & Chờ tiếp nhận', short: 'Mới & Chờ' },
    { key: 'in_progress', label: 'Đang thực hiện', short: 'Đang' },
    { key: 'overdue', label: 'Quá hạn', short: 'Quá hạn' },
    { key: 'reviewing', label: 'Chờ duyệt', short: 'Chờ duyệt' },
    { key: 'completed', label: 'Hoàn thành', short: 'Hoàn thành' }
  ];

  const handleTaskUpdate = () => {
    setSelectedTask(null);
    fetchData();
    setNotification({ message: 'Cập nhật công việc thành công!', type: 'success' });
  };

  const handleExport = (format) => {
    setShowExportMenu(false);
    setExportFormat(format);
    setShowPasswordModal(true);
  };

  const handleConfirmExport = async () => {
    if (!exportFormat) return;
    setExportLoading(true);
    try {
      const res = await apiService.exportTasksRaw({ format: exportFormat, password: exportPassword });
      // res is axios response with data(ArrayBuffer)
      const ts = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const fnameTs = `${pad(ts.getDate())}${pad(ts.getMonth()+1)}${ts.getFullYear()}${pad(ts.getHours())}${pad(ts.getMinutes())}${pad(ts.getSeconds())}`;
      const ext = exportFormat === 'xlsx' ? 'xlsx' : exportFormat === 'pdf' ? 'pdf' : 'csv';
      const filename = `xanuicam_tasks_${fnameTs}.${ext}`;
      const blobType = exportFormat === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : (exportFormat === 'pdf' ? 'application/pdf' : 'text/csv');
      const blob = new Blob([res.data], { type: blobType });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      setNotification({ message: `Xuất ${ext.toUpperCase()} thành công`, type: 'success' });
      setShowPasswordModal(false);
      setExportPassword('');
    } catch (err) {
      console.error('Export error', err);
      const msg = err && err.message ? err.message : 'Lỗi khi xuất báo cáo.';
      setNotification({ message: msg, type: 'error' });
    } finally {
      setExportLoading(false);
    }
  };

  if (loading) return <Spinner fullPage />;

  return (
    <>
      <Notification 
        message={notification.message}
        type={notification.type}
        onClose={() => setNotification({ message: '', type: '' })}
      />
      <CreateTaskModal 
        isOpen={isCreateModalOpen} 
        onClose={() => setIsCreateModalOpen(false)} 
        onTaskCreated={() => {
            setIsCreateModalOpen(false);
            fetchData();
            setNotification({ message: 'Giao việc mới thành công!', type: 'success' });
        }}
      />
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black opacity-30" onClick={() => setShowPasswordModal(false)} />
          <div className="bg-white rounded shadow-lg z-60 p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-3">Xác thực mật khẩu để xuất báo cáo</h3>
            <input type="password" className="w-full border px-3 py-2 rounded mb-3" placeholder="Nhập mật khẩu" value={exportPassword} onChange={(e) => setExportPassword(e.target.value)} />
            <div className="flex justify-end gap-2">
              <button className="btn" onClick={() => { setShowPasswordModal(false); setExportPassword(''); }}>Hủy</button>
              <button className="btn-primary" onClick={handleConfirmExport} disabled={exportLoading}>{exportLoading ? 'Đang xuất...' : 'Xác nhận & Xuất'}</button>
            </div>
          </div>
        </div>
      )}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          users={users}
          onClose={() => setSelectedTask(null)}
          onUpdate={handleTaskUpdate}
        />
      )}

      <div className="px-0 sm:px-6 md:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
              <div>
                  <h1 className="text-3xl font-bold text-slate-800">Quản lý công việc</h1>
                  <div className="mt-1 text-slate-500 text-base">
                    <RotatingSlogans slogans={[
                      'Hoàn thành đúng hạn - xây dựng niềm tin hiệu quả.',
                      'Giao việc rõ ràng - kết quả minh bạch.',
                      'Ưu tiên đúng việc - tiết kiệm thời gian.'
                    ]} />
                  </div>
              </div>
              <div className="flex items-center gap-3 flex-nowrap">
                {canCreateTask && (
                  <button onClick={() => setIsCreateModalOpen(true)} className="btn-primary whitespace-nowrap">
                      <Plus className="w-5 h-5 mr-2" /> <span className="hidden sm:inline">Giao việc mới</span><span className="sm:hidden">Giao việc</span>
                  </button>
                )}
                {hasPermission({ any: ['view_reports','export_tasks'] }) && (
                  <div className="relative" ref={(el) => { exportMenuRef.current = el; }}>
                    <button onClick={() => setShowExportMenu(s => !s)} className="btn-secondary whitespace-nowrap"><span className="hidden sm:inline">Xuất báo cáo</span><span className="sm:hidden">Xuất file</span></button>
                    {showExportMenu && (
                      <div className="absolute right-0 mt-2 w-44 bg-white border rounded shadow-md z-50">
                        <button className="w-full text-left px-3 py-2 hover:bg-slate-100" onClick={() => handleExport('xlsx')}>Xuất Excel</button>
                        <button className="w-full text-left px-3 py-2 hover:bg-slate-100" onClick={() => handleExport('pdf')}>Xuất PDF</button>
                        <button className="w-full text-left px-3 py-2 hover:bg-slate-100" onClick={() => handleExport('csv')}>Xuất CSV</button>
                      </div>
                    )}
                  </div>
                )}
                {hasPermission({ any: ['view_deleted_tasks','manage_tasks'] }) && (
                  <Link to="/tasks/deleted" className="btn-outline whitespace-nowrap">Công việc đã xóa</Link>
                )}
              </div>
          </div>
          
          <div className="mb-4">
            <div className="flex flex-wrap gap-2">
              {tabs.map(t => (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  className={`px-3 py-2 rounded-md text-sm font-medium ${activeTab === t.key ? 'bg-slate-200 text-slate-800' : 'bg-white text-slate-600 border border-slate-100'}`}>
                  <span className="hidden sm:inline">{t.label}</span>
                  <span className="sm:hidden">{t.short || t.label}</span>
                  {' '}({(columns[t.key] || []).length})
                </button>
              ))}
            </div>
          </div>

          <div>
            <TaskColumn title={tabs.find(x => x.key === activeTab).label} tasks={columns[activeTab]} onTaskClick={setSelectedTask} />
          </div>
      </div>
    </>
  );
};

export default TasksPage;