import React, { useEffect, useState } from 'react';
import apiService from '../services/apiService';
import useAuth from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';

const DeletedTasksPage = () => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');
  const [confirmingId, setConfirmingId] = useState(null);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const data = await apiService.getDeletedTasks({ limit: 500 });
        // support API that returns { items, total } or a plain array
        const items = Array.isArray(data) ? data : (data && Array.isArray(data.items) ? data.items : []);
        setTasks(items);
      } catch (e) {
        console.error(e);
        setError(e && e.message ? e.message : 'Không thể tải danh sách công việc đã xóa.');
        setTasks([]);
      } finally { setLoading(false); }
    };
    fetch();
  }, []);

  const handleRestore = async (id) => {
    if (!window.confirm('Khôi phục công việc này?')) return;
    try {
      await apiService.restoreDeletedTask(id);
      setTasks(prev => prev.filter(t => t.id !== id));
      apiService.logEvent({ action: 'task.restored', resource_type: 'task', resource_id: id }).catch(() => {});
      alert('Khôi phục thành công.');
    } catch (e) {
      alert((e && e.message) || 'Khôi phục thất bại');
    }
  };

  const handlePermanentDelete = async (id) => {
    if (!password) return alert('Vui lòng nhập mật khẩu để xác thực.');
    try {
      await apiService.permanentlyDeleteTask(id, { password });
      setPassword('');
      setConfirmingId(null);
      setTasks(prev => prev.filter(t => t.id !== id));
      apiService.logEvent({ action: 'task.permanently_deleted', resource_type: 'task', resource_id: id }).catch(() => {});
      alert('Đã xóa vĩnh viễn');
    } catch (e) {
      alert((e && e.message) || 'Xóa vĩnh viễn thất bại');
    }
  };

  if (!user || !(Array.isArray(user.permissions) && (user.permissions.includes('task_management') || user.permissions.includes('full_access')))) {
    return <div className="p-6">Bạn không có quyền truy cập trang này.</div>;
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Công việc đã xóa</h1>
        <div>
          <button onClick={() => navigate('/tasks')} className="btn">Quay lại Danh sách công việc</button>
        </div>
      </div>
      {loading ? <p>Đang tải...</p> : (
        <>
          {error && <p className="text-red-500">{error}</p>}
          <div className="overflow-auto bg-white rounded shadow p-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th className="px-6 py-3">ID</th>
                  <th className="px-6 py-3">Tên công việc</th>
                  <th className="px-6 py-3">Người thực hiện</th>
                  <th className="px-6 py-3">Thời gian</th>
                  <th className="px-6 py-3">Hành động bởi</th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {tasks.map(t => (
                  <tr key={t.id} className="border-t">
                    <td className="py-2">{t.id}</td>
                    <td className="py-2">{t.title}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{t.assignee_name || ''}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{t.deleted_at ? format(new Date(t.deleted_at), 'dd/MM/yyyy HH:mm') : ''}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{t.deleted_by_name || t.deleted_by || ''}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button className="btn-secondary mr-2" onClick={() => handleRestore(t.id)}>Khôi phục</button>
                      {confirmingId === t.id ? (
                        <span className="inline-flex items-center gap-2">
                          <input type="password" value={password} onChange={(e)=> setPassword(e.target.value)} placeholder="Mật khẩu" className="input-style" />
                          <button className="bg-red-600 text-white px-3 py-1 rounded" onClick={() => handlePermanentDelete(t.id)}>Xóa vĩnh viễn</button>
                          <button className="btn-secondary" onClick={() => { setConfirmingId(null); setPassword(''); }}>Hủy</button>
                        </span>
                      ) : (
                        <button className="bg-red-600 text-white px-3 py-1 rounded" onClick={() => setConfirmingId(t.id)}>Xóa vĩnh viễn</button>
                      )}
                    </td>
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

export default DeletedTasksPage;
