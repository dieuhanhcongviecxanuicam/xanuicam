import React, { useState, useEffect, useMemo, useCallback } from 'react';
import apiService from '../services/apiService';
import api from '../api/axios';
import Spinner from '../components/common/Spinner';
import Notification from '../components/common/Notification';
import TaskDetailModal from '../components/tasks/TaskDetailModal';
import ModalWrapper from '../components/common/ModalWrapper';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

const KpiChartPage = () => {
  const [loading, setLoading] = useState(true);
  const [kpiData, setKpiData] = useState({ points: [] });
  const [filters, setFilters] = useState({ departmentId: '', accountId: '' });
  const [filterOptions, setFilterOptions] = useState({ departments: [], users: [] });
  const [kpiLoading, setKpiLoading] = useState(false);
  const [kpiSort, setKpiSort] = useState({ field: 'average', dir: 'desc' });
  const [selectedKpiUser, setSelectedKpiUser] = useState(null);
  const [kpiUserTasks, setKpiUserTasks] = useState([]);
  const [kpiUserTasksLoading, setKpiUserTasksLoading] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [tasksModalOpen, setTasksModalOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [total, setTotal] = useState(0);
  const [accountInput, setAccountInput] = useState('');
  const [showAccountDropdown, setShowAccountDropdown] = useState(false);
  const [debouncedAccountInput, setDebouncedAccountInput] = useState(accountInput);
  const [notification, setNotification] = useState({ message: '', type: '' });

  const fetchFilters = useCallback(async () => {
    try {
      const f = await apiService.getReportFilters();
      setFilterOptions(f || { departments: [], users: [] });
    } catch (e) {
      setNotification({ message: 'Không thể tải bộ lọc.', type: 'error' });
    }
  }, []);

  const fetchKpi = useCallback(async () => {
    setKpiLoading(true);
    try {
      const cleaned = {};
      if (filters.departmentId) cleaned.departmentId = filters.departmentId;
      if (filters.accountId) cleaned.accountId = filters.accountId;
      // request paged data
      cleaned.page = page;
      cleaned.pageSize = pageSize;
      const res = await apiService.getKpiScores(cleaned);
      if (res && Array.isArray(res.points)) {
        setKpiData({ points: res.points });
        setTotal(res.total || 0);
      } else {
        setKpiData(res || { points: [] });
        setTotal((res && res.points && res.points.length) ? res.points.length : 0);
      }
    } catch (e) {
      setNotification({ message: 'Lỗi khi tải KPI từ server.', type: 'error' });
      setKpiData({ points: [] });
      setTotal(0);
    } finally {
      setKpiLoading(false);
      setLoading(false);
    }
  }, [filters, page, pageSize]);

  useEffect(() => { fetchFilters(); }, [fetchFilters]);
  useEffect(() => { fetchKpi(); }, [fetchKpi]);

  // Debounce account input to reduce rapid filtering
  useEffect(() => {
    const t = setTimeout(() => setDebouncedAccountInput(accountInput), 300);
    return () => clearTimeout(t);
  }, [accountInput]);

  const sortedFiltered = useMemo(() => {
    let pts = (kpiData && kpiData.points) ? [...kpiData.points] : [];
    if (filters.departmentId) pts = pts.filter(p => String(p.department_id) === String(filters.departmentId));
    if (filters.accountId) pts = pts.filter(p => String(p.userId || p.id) === String(filters.accountId));
    pts.sort((a,b) => {
      const af = (a[kpiSort.field] !== undefined && a[kpiSort.field] !== null) ? a[kpiSort.field] : 0;
      const bf = (b[kpiSort.field] !== undefined && b[kpiSort.field] !== null) ? b[kpiSort.field] : 0;
      return (kpiSort.dir === 'asc') ? af - bf : bf - af;
    });
    return pts;
  }, [kpiData, filters, kpiSort]);

  // CSV export helper removed (unused) to satisfy lint

  const downloadBlob = async (blob, filename) => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || '';
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  };

  const exportServer = async (format) => {
    try {
      // Ensure user is logged in (token present) before calling server export
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        if (!token) throw new Error('NOT_AUTH');
      } catch (te) {
        setNotification({ message: 'Bạn cần đăng nhập để xuất file.', type: 'error' });
        return;
      }
      // Build params from current filters
      const params = new URLSearchParams();
      if (filters.departmentId) params.append('departmentId', filters.departmentId);
      if (filters.accountId) params.append('accountId', filters.accountId);
      params.append('format', format);
      // Request full export (no pagination) to export all filtered rows
        // Use the app API client so Authorization header and cookies are attached
        const result = await api.get('/reports/kpi-scores', { params: { departmentId: filters.departmentId || undefined, accountId: filters.accountId || undefined, format } });
        const respHeaders = result.headers || {};
        const disposition = (respHeaders.get && respHeaders.get('content-disposition')) || respHeaders['content-disposition'] || '';
        let filename = '';
        const match = /filename="?([^";]+)"?/.exec(disposition);
        if (match) filename = match[1];
        else filename = `xanuicam_kpi_export.${format === 'xlsx' ? 'xlsx' : 'csv'}`;
        const blob = result.data;
      await downloadBlob(blob, filename);
    } catch (e) {
      setNotification({ message: 'Không thể xuất file: ' + (e.message || ''), type: 'error' });
    }
  };

  const [showExportMenu, setShowExportMenu] = useState(false);

  const openUserTasks = async (user) => {
    setSelectedKpiUser(user);
    setTasksModalOpen(true);
    setKpiUserTasksLoading(true);
    try {
      const tasks = await apiService.getUserTasks(user.userId || user.id);
      setKpiUserTasks(tasks || []);
    } catch (e) {
      setKpiUserTasks([]);
      setNotification({ message: 'Không thể tải danh sách công việc của người dùng.', type: 'error' });
    } finally {
      setKpiUserTasksLoading(false);
    }
  };

  return (
    <div className="p-6">
      <Notification message={notification.message} type={notification.type} onClose={() => setNotification({ message: '', type: '' })} />
      {/* (Removed modal block; tasks now displayed inline below the KPI table) */}

      {selectedTask && (
        <TaskDetailModal task={selectedTask} users={filterOptions.users} onClose={() => setSelectedTask(null)} onUpdate={() => { setSelectedTask(null); fetchKpi(); }} />
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Biểu đồ KPI</h1>
          <p className="mt-1 text-slate-500">Phân tích điểm KPI theo người dùng và phòng ban.</p>
        </div>
          <div className="flex items-center gap-3">
          <button className="btn-primary" onClick={() => { setFilters({ departmentId: '', accountId: '' }); setAccountInput(''); setPage(1); }}>Đặt lại</button>
          <div className="relative">
            <button className="btn-secondary flex items-center gap-2" onClick={() => setShowExportMenu(s => !s)}>Xuất toàn bộ KPI <span className="ml-1">▾</span></button>
            {showExportMenu && (
              <div className="absolute right-0 mt-2 w-44 bg-white border rounded shadow z-50">
                <button className="w-full text-left px-4 py-2 hover:bg-slate-100" onClick={() => { setShowExportMenu(false); exportServer('xlsx'); }}>Xuất Excel</button>
                <button className="w-full text-left px-4 py-2 hover:bg-slate-100" onClick={() => { setShowExportMenu(false); exportServer('csv'); }}>Xuất CSV</button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <select className="input-style w-full sm:w-60" value={filters.departmentId} onChange={(e) => setFilters(prev => ({ ...prev, departmentId: e.target.value, accountId: '' }))}>
            <option value="">Tất cả Phòng ban</option>
            {filterOptions.departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <div className="relative w-full sm:w-64">
            <div className="relative">
              <input
                className="input-style w-full pr-8"
                placeholder="Chọn hoặc tìm tên người dùng"
                value={accountInput}
                onChange={(e) => { setAccountInput(e.target.value); setShowAccountDropdown(true); }}
                onFocus={() => setShowAccountDropdown(true)}
                onBlur={() => setTimeout(() => setShowAccountDropdown(false), 120)}
              />
              <button type="button" className="absolute right-1 top-1/2 -translate-y-1/2 text-slate-500" onClick={() => setShowAccountDropdown(s => !s)}>▾</button>
            </div>
            {showAccountDropdown && (
              <div className="absolute z-50 left-0 right-0 bg-white border rounded shadow mt-1 max-h-56 overflow-y-auto">
                {(filterOptions.users || []).filter(u => (!filters.departmentId || String(u.department_id) === String(filters.departmentId)) && (debouncedAccountInput === '' || (u.full_name || u.username || '').toLowerCase().includes(debouncedAccountInput.toLowerCase()))).map(u => (
                  <button key={u.id} type="button" className="w-full text-left px-3 py-2 hover:bg-slate-100" onMouseDown={(ev) => { ev.preventDefault(); setFilters(prev => ({ ...prev, accountId: u.id })); setAccountInput(u.full_name || u.username || ''); setShowAccountDropdown(false); setPage(1); }}>
                    {u.full_name || u.username || ''}
                  </button>
                ))}
                {(filterOptions.users || []).filter(u => (!filters.departmentId || String(u.department_id) === String(filters.departmentId)) && (debouncedAccountInput === '' || (u.full_name || u.username || '').toLowerCase().includes(debouncedAccountInput.toLowerCase()))).length === 0 && (
                  <div className="p-3 text-slate-500">Không tìm thấy người dùng.</div>
                )}
              </div>
            )}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <label className="text-sm text-slate-600">Lọc:</label>
            <select className="input-style" value={`${kpiSort.field}|${kpiSort.dir}`} onChange={(e) => { const [f,d] = e.target.value.split('|'); setKpiSort({ field: f, dir: d }); }}>
              <option value="average|desc">Điểm trung bình (Giảm dần)</option>
              <option value="average|asc">Điểm trung bình (Tăng dần)</option>
              <option value="count|desc">Số lần chấm (Giảm dần)</option>
              <option value="count|asc">Số lần chấm (Tăng dần)</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? <Spinner fullPage={false} /> : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <div className="bg-white p-6 rounded-lg shadow-md lg:col-span-2">
              <p className="text-sm text-slate-500">Biểu đồ phân phối điểm KPI</p>
              <h3 className="text-lg font-semibold text-slate-800 mb-4">Phân bố điểm trung bình</h3>
              {kpiLoading ? <Spinner /> : (
                (() => {
                  const labels = sortedFiltered.map(p => p.name || 'Không rõ');
                  const values = sortedFiltered.map(p => p.average || 0);
                  const data = { labels, datasets: [{ label: 'Điểm trung bình', data: values, borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.2)' }] };
                  return <Line data={data} options={{ plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }} />;
                })()
              )}
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md">
              <p className="text-sm text-slate-500">Tổng quan</p>
              <h3 className="text-lg font-semibold text-slate-800 mb-4">Số lượng người được chấm</h3>
              <p className="text-3xl font-bold text-slate-800 mb-4">{(kpiData && kpiData.points) ? kpiData.points.length : 0}</p>
              <div className="mt-4">
                <Bar data={{ labels: ['Số người'], datasets: [{ data: [(kpiData && kpiData.points) ? kpiData.points.length : 0], backgroundColor: ['#10b981'] }] }} options={{ plugins: { legend: { display: false } } }} />
              </div>
            </div>
          </div>

          <div className="bg-white shadow-lg rounded-lg overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Người dùng</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Phòng ban</th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase">Điểm trung bình</th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase">Số lần chấm</th>
                  <th className="px-6 py-3 text-center text-xs font-bold text-slate-500 uppercase">Hành động</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {sortedFiltered.map(p => (
                  <tr key={p.userId || p.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{p.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{p.department_name || p.department_id || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right">{p.average !== null && p.average !== undefined ? Number(p.average).toFixed(2) : '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right">{p.count || 0}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                      <button className="btn-tertiary" onClick={() => openUserTasks(p)}>Xem công việc</button>
                    </td>
                  </tr>
                ))}
                {sortedFiltered.length === 0 && (
                  <tr><td colSpan="5" className="text-center py-6 text-slate-500">Không có dữ liệu KPI.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {tasksModalOpen && selectedKpiUser && (
            <ModalWrapper isOpen={tasksModalOpen} onClose={() => { setTasksModalOpen(false); setSelectedKpiUser(null); setKpiUserTasks([]); }} maxWidth="max-w-2xl">
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold">Công việc của {selectedKpiUser.name}</h3>
                    <p className="text-sm text-slate-500">Danh sách các công việc liên quan đến người dùng (từ API)</p>
                  </div>
                  <button className="text-slate-500" onClick={() => { setTasksModalOpen(false); setSelectedKpiUser(null); setKpiUserTasks([]); }}>Đóng</button>
                </div>
                <div className="max-h-72 overflow-y-auto">
                  {kpiUserTasksLoading ? <Spinner /> : (
                    <table className="min-w-full divide-y divide-slate-200">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-bold text-slate-500">Tiêu đề</th>
                          <th className="px-4 py-2 text-left text-xs font-bold text-slate-500">Hạn chót</th>
                          <th className="px-4 py-2 text-xs font-bold text-slate-500">Trạng thái</th>
                          <th className="px-4 py-2 text-xs font-bold text-slate-500">Hành động</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-slate-200">
                        {kpiUserTasks.map(t => (
                          <tr key={t.id} className="hover:bg-slate-50">
                            <td className="px-4 py-2 text-sm text-slate-800">{t.title}</td>
                            <td className="px-4 py-2 text-sm text-slate-600">{t.due_date ? new Date(t.due_date).toLocaleDateString() : '-'}</td>
                            <td className="px-4 py-2 text-sm"><span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-slate-100 text-slate-800">{t.status}</span></td>
                            <td className="px-4 py-2 text-sm"><button className="btn-tertiary" onClick={() => setSelectedTask(t)}>Chi tiết</button></td>
                          </tr>
                        ))}
                        {kpiUserTasks.length === 0 && (
                          <tr><td colSpan="4" className="text-center py-6 text-slate-500">Không có công việc nào.</td></tr>
                        )}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </ModalWrapper>
          )}
        </>
      )}
      {/* Pagination controls moved under table: pageSize select shown before total count */}
      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <select className="input-style" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
            <option value={10}>10 / trang</option>
            <option value={15}>15 / trang</option>
            <option value={25}>25 / trang</option>
            <option value={50}>50 / trang</option>
          </select>
          <button className="btn-secondary px-3 py-1" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Trước</button>
          <div className="px-3 py-1 bg-white border rounded whitespace-nowrap min-w-[64px] text-center">{page} / {Math.max(1, Math.ceil(total / pageSize))}</div>
          <button className="btn-secondary px-3 py-1" disabled={page >= Math.ceil(total / pageSize)} onClick={() => setPage(p => Math.min(Math.ceil(total / pageSize), p + 1))}>Tiếp</button>
        </div>
        <div className="text-sm text-slate-600">Tổng {total} người</div>
      </div>

      {selectedTask && (
        <TaskDetailModal task={selectedTask} users={filterOptions.users} onClose={() => setSelectedTask(null)} onUpdate={() => { setSelectedTask(null); fetchKpi(); }} />
      )}
    </div>
  );
};

export default KpiChartPage;
