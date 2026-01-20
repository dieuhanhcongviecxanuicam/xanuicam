import React from 'react';

const QuickConfigModal = ({ visible, user, config, onClose }) => {
  if (!visible || !user) return null;

  const cfg = config || {};

  return (
    <div className="fixed z-50 right-6 top-20 w-96 bg-white shadow-lg rounded-md border overflow-hidden">
      <div className="p-3 border-b flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">{user.full_name}</div>
          <div className="text-xs text-slate-500">{user.username}</div>
        </div>
        <button className="text-slate-500 text-sm" onClick={onClose}>CÁ NHÂN TỰ QUẢN LÝ</button>
      </div>
      <div className="p-3 text-sm space-y-2">
        <div><strong>IP:</strong> {cfg.ip || '-'}</div>
        <div><strong>MAC:</strong> {cfg.mac || '-'}</div>
        <div><strong>Model:</strong> {cfg.model || '-'}</div>
        <div><strong>Manufacturer:</strong> {cfg.manufacturer || '-'}</div>
        <div><strong>Phòng/ĐV:</strong> {cfg.assigned_department || '-'}</div>
        <div className="pt-2 text-xs text-slate-500">Bảng tóm tắt xem thông tin nhanh.</div>
      </div>
    </div>
  );
};

export default QuickConfigModal;
