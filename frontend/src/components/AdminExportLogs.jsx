import React, { useState } from 'react';
import api from '../api/axios';
import useAuth from '../hooks/useAuth';

const AdminExportLogs = () => {
  const { hasPermission } = useAuth();
  const [log, setLog] = useState(null);
  const [loading, setLoading] = useState(false);

  if (!hasPermission(['user_management'])) return null;

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get('/computer-configs/export/logs');
      setLog(r.data || null);
    } catch (e) {
      setLog({ error: e && e.message ? e.message : 'Lỗi khi tải log' });
    } finally { setLoading(false); }
  };

  return (
    <div className="inline-block ml-4">
      <button className="btn-secondary" onClick={load}>Xem log xuất</button>
      {loading && <div className="text-sm text-slate-500">Đang tải...</div>}
      {log && log.content && (
        <div className="mt-2 p-2 bg-slate-50 border rounded max-h-64 overflow-auto text-sm">
          <div className="font-medium mb-2">{log.file}</div>
          <pre className="whitespace-pre-wrap">{log.content}</pre>
        </div>
      )}
      {log && log.error && <div className="text-red-600 mt-2">{log.error}</div>}
    </div>
  );
};

export default AdminExportLogs;
