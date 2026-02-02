import React, { useEffect, useState } from 'react';
import useDepartments from '../hooks/useDepartments';
import apiService from '../services/apiService';
import useAuth from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';

const RETENTION_DAYS = 7;

const DeletedUsersPage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const { user } = useAuth();
  const navigate = useNavigate();
  const { departmentsMap } = useDepartments();
  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const data = await apiService.getDeletedUsers({ limit: 1000 });
        const items = Array.isArray(data) ? data : (data && Array.isArray(data.items) ? data.items : []);
        setUsers(items);
      } catch (e) {
        console.error(e);
        setError(e && e.message ? e.message : 'Không thể tải danh sách tài khoản đã xóa.');
        setUsers([]);
      } finally { setLoading(false); }
    };
    fetch();
  }, []);

  if (!user || !(Array.isArray(user.permissions) && (user.permissions.includes('user_management') || user.permissions.includes('full_access')))) {
    return <div className="p-6">Bạn không có quyền truy cập trang này.</div>;
  }

  const handleRestore = async (id) => {
    if (!window.confirm('Khôi phục tài khoản này?')) return;
    try {
      await apiService.restoreDeletedUser(id);
      setUsers(prev => prev.filter(u => u.id !== id));
      alert('Đã khôi phục tài khoản.');
    } catch (e) {
      alert((e && e.message) || 'Khôi phục thất bại');
    }
  };


  const renderRemainingDays = (deletedAt) => {
    if (!deletedAt) return '';
    try {
      const deleted = new Date(deletedAt);
      const expiry = new Date(deleted.getTime() + RETENTION_DAYS * 24 * 60 * 60 * 1000);
      const now = new Date();
      if (now >= expiry) return 'Đã đến hạn xóa vĩnh viễn';
      const diff = Math.ceil((expiry - now) / (24 * 60 * 60 * 1000));
      return `Còn lại ${diff} ngày`;
    } catch (e) {
      return '';
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Tài khoản đã xóa</h1>
        <div>
          <button onClick={() => navigate('/users')} className="btn">Quay lại Danh sách tài khoản</button>
        </div>
      </div>
      {loading ? <p>Đang tải...</p> : (
        <>
          {error && <p className="text-red-500">{error}</p>}
          <div className="overflow-auto bg-white rounded shadow p-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th>UID</th>
                  <th>Họ tên</th>
                  <th>Tài khoản</th>
                  <th>Phòng ban</th>
                  <th>Đã xóa lúc</th>
                  <th>Thời gian lưu</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="border-t">
                    <td className="px-6 py-4 whitespace-nowrap">{u.id}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{u.full_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap">@{u.username}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{departmentsMap[String(u.department_id)] || u.department_name || ''}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{u.deleted_at ? format(new Date(u.deleted_at), 'dd/MM/yyyy HH:mm') : ''}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{renderRemainingDays(u.deleted_at)}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button className="btn-secondary mr-2" onClick={() => handleRestore(u.id)}>Khôi phục</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {users.length === 0 && <p className="mt-4 text-slate-500">Không có tài khoản đã xóa.</p>}
          </div>
        </>
      )}

      
    </div>
  );
};

export default DeletedUsersPage;

