import React, { useState, useEffect } from 'react';
import apiService from '../services/apiService';
import Spinner from '../components/common/Spinner';
import Notification from '../components/common/Notification';
import DeleteConfirmationModal from '../components/common/DeleteConfirmationModal';

const RETENTION_DAYS = 7;

const DeletedDepartmentsPage = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState({ message: '', type: '' });
  const [confirmRestoreId, setConfirmRestoreId] = useState(null);
  const [confirmPermanentId, setConfirmPermanentId] = useState(null);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const data = await apiService.getDeletedDepartments({ limit: 1000 });
        setItems(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  const handleRestore = async (id) => {
    try {
      await apiService.restoreDeletedDepartment(id);
      apiService.logEvent({ action: 'department.restored', resource_type: 'department', resource_id: id }).catch(()=>{});
      setItems(current => current.filter(i => i.id !== id));
      setNotification({ message: 'Khôi phục phòng ban thành công.', type: 'success' });
    } catch (e) {
      const msg = typeof e === 'string' ? e : (e && (e.message || e.error)) || 'Khôi phục thất bại.';
      setNotification({ message: msg, type: 'error' });
    } finally {
      setConfirmRestoreId(null);
    }
  };

  const handlePermanent = async (id) => {
    try {
      await apiService.permanentlyDeleteDepartment(id);
      apiService.logEvent({ action: 'department.permanently_deleted', resource_type: 'department', resource_id: id }).catch(()=>{});
      setItems(current => current.filter(i => i.id !== id));
      setNotification({ message: 'Phòng ban đã bị xóa vĩnh viễn.', type: 'success' });
    } catch (e) {
      const msg = typeof e === 'string' ? e : (e && (e.message || e.error)) || 'Xóa vĩnh viễn thất bại.';
      setNotification({ message: msg, type: 'error' });
    } finally {
      setConfirmPermanentId(null);
    }
  };

  const renderRemaining = (deletedAt) => {
    if (!deletedAt) return '';
    const deleted = new Date(deletedAt);
    const expiry = new Date(deleted.getTime() + RETENTION_DAYS*24*60*60*1000);
    const ms = expiry - Date.now();
    if (ms <= 0) return 'Đã xóa vĩnh viễn';
    const days = Math.ceil(ms / (24*60*60*1000));
    return `${days} ngày còn lại`;
  };

  if (loading) return <Spinner fullPage />;

  return (
    <div>
      <Notification message={notification.message} type={notification.type} onClose={() => setNotification({ message: '', type: '' })} />
      <h1 className="text-2xl font-bold mb-4">Phòng ban đã xóa</h1>
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full">
          <thead>
            <tr className="text-left">
              <th className="px-6 py-3">Tên phòng ban</th>
              <th className="px-6 py-3">Mô tả</th>
              <th className="px-6 py-3">Đã xóa lúc</th>
              <th className="px-6 py-3">Thời gian còn lại</th>
              <th className="px-6 py-3">Hành động</th>
            </tr>
          </thead>
          <tbody>
            {items.map(i => (
              <tr key={i.id} className="border-t">
                <td className="px-6 py-4">{i.name}</td>
                <td className="px-6 py-4">{i.description}</td>
                <td className="px-6 py-4">{i.deleted_at ? new Date(i.deleted_at).toLocaleString() : ''}</td>
                <td className="px-6 py-4">{renderRemaining(i.deleted_at)}</td>
                <td className="px-6 py-4">
                  <button onClick={() => setConfirmRestoreId(i.id)} className="btn-primary mr-2">Khôi phục</button>
                  <button onClick={() => setConfirmPermanentId(i.id)} className="btn-danger">Xóa vĩnh viễn</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Confirmation modals */}
      <DeleteConfirmationModal
        isOpen={!!confirmRestoreId}
        onClose={() => setConfirmRestoreId(null)}
        onConfirm={() => handleRestore(confirmRestoreId)}
        title="Xác nhận khôi phục"
        message="Bạn có chắc muốn khôi phục phòng ban này?"
      />
      <DeleteConfirmationModal
        isOpen={!!confirmPermanentId}
        onClose={() => setConfirmPermanentId(null)}
        onConfirm={() => handlePermanent(confirmPermanentId)}
        title="Xác nhận xóa vĩnh viễn"
        message="Hành động này sẽ xóa vĩnh viễn phòng ban. Tiếp tục?"
      />
    </div>
  );
};

export default DeletedDepartmentsPage;
