import React from 'react';
import useDepartments from '../../hooks/useDepartments';

const QuickUserSummary = ({ visible, type = 'user', data, onClose, x = 0, y = 0 }) => {
  const { departmentsMap = {} } = useDepartments();
  if (!visible || !data) return null;

  if (type === 'user') {
    const u = data;
    const left = x + 12;
    const top = y + 12;
    return (
      <div className="fixed z-50 w-96 bg-white shadow-lg rounded-md border overflow-hidden transition-transform transform duration-150" style={{ boxShadow: '0 8px 24px rgba(15,23,42,0.12)', left: `${left}px`, top: `${top}px` }}>
        <div className="p-3 border-b flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">{u.full_name}</div>
            <div className="text-xs text-slate-500">@{u.username}</div>
          </div>
          <button className="text-slate-500 text-sm" onClick={onClose}>Đóng</button>
        </div>
          <div className="p-3 text-sm space-y-2">
          <div><strong>Họ và Tên:</strong> {u.full_name || '-'}</div>
          <div><strong>Mã công chức:</strong> {u.staff_code || u.employee_code || '-'}</div>
          <div><strong>Ngày sinh:</strong> {u.birth_date || '-'}</div>
          <div><strong>Email:</strong> {u.email || '-'}</div>
          <div><strong>Số điện thoại:</strong> {u.phone_number || '-'}</div>
          <div><strong>Vai trò:</strong> {u.role_name || '-'}</div>
          <div><strong>Phòng ban/Đơn vị:</strong> {departmentsMap[u.department_id] || u.department_name || '-'}</div>
          <div><strong>Người phụ trách:</strong> {u.department_manager_name || u.department_manager || u.manager_name || '-'}</div>
          <div><strong>Ghi chú:</strong> {u.note || u.notes || '-'}</div>
        </div>
      </div>
    );
  }

  if (type === 'tasks') {
    const t = data;
    const leftD = x + 12;
    const topD = y + 12;
    return (
      <div className="fixed z-50 w-96 bg-white shadow-lg rounded-md border overflow-hidden transition-transform transform duration-150" style={{ boxShadow: '0 8px 24px rgba(15,23,42,0.12)', left: `${leftD}px`, top: `${topD}px` }}>
        <div className="p-3 border-b flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">Công việc: {t.userName || '-'}</div>
            <div className="text-xs text-slate-500">Số lượng: {t.count || 0}</div>
          </div>
          <button className="text-slate-500 text-sm" onClick={onClose}>Đóng</button>
        </div>
        <div className="p-3 text-sm space-y-2">
          {Array.isArray(t.items) && t.items.length ? t.items.slice(0,6).map(it => (
            <div key={it.id}><strong>{it.title || it.name}</strong> <div className="text-xs text-slate-500">{it.status || ''}</div></div>
          )) : <div>Không có công việc hiển thị.</div>}
        </div>
      </div>
    );
  }

  if (type === 'department') {
    const d = data;
    const leftDep = x + 12;
    const topDep = y + 12;
    return (
      <div className="fixed z-50 w-96 bg-white shadow-lg rounded-md border overflow-hidden transition-transform transform duration-150" style={{ boxShadow: '0 8px 24px rgba(15,23,42,0.12)', left: `${leftDep}px`, top: `${topDep}px` }}>
        <div className="p-3 border-b flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">{d.name}</div>
            <div className="text-xs text-slate-500">Mã: {d.code || '-'}</div>
          </div>
          <button className="text-slate-500 text-sm" onClick={onClose}>Đóng</button>
        </div>
        <div className="p-3 text-sm space-y-2">
          <div><strong>Người phụ trách:</strong> {d.manager_name || d.leader || '-'}</div>
          <div><strong>Số lượng tài khoản:</strong> {d.user_count || d.member_count || '-'}</div>
          <div><strong>Số điện thoại:</strong> {d.phone || d.phone_number || '-'}</div>
          <div><strong>Mô tả:</strong> {d.description || d.note || '-'}</div>
        </div>
      </div>
    );
  }

  return null;
};

export default QuickUserSummary;
