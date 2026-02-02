// ubndxanuicam/frontend/src/pages/ReportsPage.jsx
// VERSION 2.0 - FINALIZED AND VERIFIED

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import apiService from '../services/apiService';
import Spinner from '../components/common/Spinner';
import Notification from '../components/common/Notification';
import { format, isPast, eachDayOfInterval, addDays } from 'date-fns';
import { vi } from 'date-fns/locale';
import TaskDetailModal from '../components/tasks/TaskDetailModal';

// Chart.js imports
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
} from 'chart.js';
import { Line, Bar, Pie } from 'react-chartjs-2';

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

// StatCard removed from ReportsPage — dashboard provides stat cards

const ReportsPage = () => {
    // State cho dữ liệu
    const [stats, setStats] = useState(null);
    const [detailedTasks, setDetailedTasks] = useState([]);
    const [filterOptions, setFilterOptions] = useState({ users: [], departments: [] });
    const [showExportMenu, setShowExportMenu] = useState(false);

    // State cho các bộ lọc
    const [filters, setFilters] = useState({ userId: '', departmentId: '', startDate: '', endDate: '', status: '', isOverdue: '' });

    // State cho giao diện
    const [loading, setLoading] = useState(true);
    const [notification, setNotification] = useState({ message: '', type: '' });
    const [selectedTask, setSelectedTask] = useState(null);

    // Tải các tùy chọn cho bộ lọc (danh sách người dùng, phòng ban) một lần duy nhất.
    const fetchFilters = useCallback(async () => {
        try {
            const data = await apiService.getReportFilters();
            setFilterOptions(data);
        } catch (error) {
            setNotification({ message: 'Lỗi khi tải dữ liệu bộ lọc.', type: 'error'});
        }
    }, []);

    // Tải dữ liệu báo cáo chính dựa trên các bộ lọc hiện tại.
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            // Chỉ gửi các bộ lọc có giá trị lên server để tối ưu truy vấn.
            const cleanedFilters = Object.fromEntries(Object.entries(filters).filter(([_, v]) => v !== undefined && v !== null && v !== '' ));
            // Normalize date filters to include full-day bounds when only a date is provided
            const paramsObj = { ...cleanedFilters };
            if (paramsObj.startDate && !paramsObj.startDate.includes('T')) paramsObj.startDate = `${paramsObj.startDate}T00:00:00Z`;
            if (paramsObj.endDate && !paramsObj.endDate.includes('T')) paramsObj.endDate = `${paramsObj.endDate}T23:59:59Z`;

            // `isOverdue` should be sent as string 'true' when checked because backend expects string 'true'
            if (typeof paramsObj.isOverdue === 'boolean') paramsObj.isOverdue = paramsObj.isOverdue ? 'true' : '';

            const [statsRes, tasksRes] = await Promise.all([
                apiService.getOverviewStats(paramsObj),
                apiService.getDetailedTaskReport(paramsObj)
            ]);


            setStats(statsRes);
            setDetailedTasks(tasksRes);
        } catch (error) {
            setNotification({ message: 'Lỗi khi tải dữ liệu báo cáo.', type: 'error' });
        } finally {
            setLoading(false);
        }
    }, [filters]);

    useEffect(() => {
        fetchFilters();
    }, [fetchFilters]);

    // Helper to download a blob with filename
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

    // Request server-side export (csv or xlsx) using current filters
    const exportServer = async (format) => {
        try {
            // Ensure user is logged in
            try {
                const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
                if (!token) throw new Error('NOT_AUTH');
            } catch (te) {
                setNotification({ message: 'Bạn cần đăng nhập để xuất file.', type: 'error' });
                return;
            }
            const params = new URLSearchParams();
            if (filters.departmentId) params.append('departmentId', filters.departmentId);
            if (filters.userId) params.append('accountId', filters.userId);
            params.append('format', format);
                    // Use api client to include Authorization header/token
                    const result = await require('../api/axios').default.get('/reports/kpi-scores', { params: { departmentId: filters.departmentId || undefined, accountId: filters.userId || undefined, format } });
                    const respHeaders = result.headers || {};
                    const disposition = (respHeaders.get && respHeaders.get('content-disposition')) || respHeaders['content-disposition'] || '';
                    let filename = '';
                    const match = /filename="?([^";]+)"?/.exec(disposition);
                    if (match) filename = match[1];
                    else filename = `reports_export.${format === 'xlsx' ? 'xlsx' : 'csv'}`;
                    const blob = result.data;
                    await downloadBlob(blob, filename);
        } catch (e) {
            setNotification({ message: 'Không thể xuất file: ' + (e.message || ''), type: 'error' });
        }
    };

    // Auto-fetch on filters change (real-time filtering)
    useEffect(() => {
        fetchData();
    }, [fetchData]);
    
    // Xử lý khi người dùng thay đổi giá trị bộ lọc.
    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => {
            const newFilters = {...prev, [name]: value};
            // Logic thông minh: Nếu lọc theo phòng ban, reset bộ lọc người dùng.
            if (name === 'departmentId') {
                newFilters.userId = '';
            }
            return newFilters;
        });
    };

    // Tối ưu hóa việc lọc danh sách người dùng theo phòng ban đã chọn.
    const availableUsers = useMemo(() => {
        if (!filters.departmentId) return filterOptions.users;
        return filterOptions.users.filter(user => String(user.department_id) === String(filters.departmentId));
    }, [filters.departmentId, filterOptions.users]);

    

    // Utility: build time-series counts from detailed tasks over an interval
    const buildTimeSeries = (tasks, start, end, metric) => {
        const days = eachDayOfInterval({ start, end });
        return days.map(day => {
            const count = tasks.reduce((acc, t) => {
                const created = t.created_at ? new Date(t.created_at) : null;
                const due = t.due_date ? new Date(t.due_date) : null;
                if (metric === 'total') {
                    if (!created) return acc;
                    return acc + (created.toDateString() === day.toDateString() ? 1 : 0);
                }
                if (metric === 'new') {
                    if (!created) return acc;
                    const isNew = ['Mới tạo', 'Tiếp nhận', 'Yêu cầu làm lại'].includes(t.status);
                    return acc + (isNew && created.toDateString() === day.toDateString() ? 1 : 0);
                }
                if (metric === 'inProgress') {
                    if (!created) return acc;
                    return acc + (t.status === 'Đang thực hiện' && created.toDateString() === day.toDateString() ? 1 : 0);
                }
                if (metric === 'completed') {
                    if (!t.completed_at) return acc;
                    const comp = new Date(t.completed_at);
                    return acc + (comp.toDateString() === day.toDateString() ? 1 : 0);
                }
                if (metric === 'overdue') {
                    if (!due) return acc;
                    return acc + (isPast(new Date(due)) && t.status !== 'Hoàn thành' && due.toDateString() === day.toDateString() ? 1 : 0);
                }
                return acc;
            }, 0);
            return count;
        });
    };


    return (
        <>
            {selectedTask && (
                <TaskDetailModal 
                    task={selectedTask}
                    users={filterOptions.users}
                    onClose={() => setSelectedTask(null)}
                    onUpdate={() => {
                        setSelectedTask(null);
                        fetchData(); // Tải lại dữ liệu sau khi có thay đổi từ modal.
                    }}
                />
            )}
            <div>
                 <Notification 
                    message={notification.message}
                    type={notification.type}
                    onClose={() => setNotification({ message: '', type: '' })}
                />
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800">Báo cáo & Thống kê</h1>
                        <p className="mt-1 text-slate-500">Tổng quan về hiệu suất và tiến độ công việc.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <button className="btn-secondary flex items-center gap-2" onClick={() => setShowExportMenu(s => !s)}>Xuất báo cáo <span className="ml-1">▾</span></button>
                            {showExportMenu && (
                                <div className="absolute right-0 mt-2 w-44 bg-white border rounded shadow z-50">
                                    <button className="w-full text-left px-4 py-2 hover:bg-slate-100" onClick={() => { setShowExportMenu(false); exportServer('xlsx'); }}>Xuất Excel</button>
                                    <button className="w-full text-left px-4 py-2 hover:bg-slate-100" onClick={() => { setShowExportMenu(false); exportServer('csv'); }}>Xuất CSV</button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                
                {/* Khu vực bộ lọc - align with Dashboard layout */}
                <div className="mb-6 bg-white p-4 rounded-lg shadow-sm">
                    <div className="flex flex-col sm:flex-row gap-3 mb-4">
                        <div className="flex flex-wrap gap-3 w-full">
                            <select name="departmentId" value={filters.departmentId} onChange={handleFilterChange} className="input-style w-full sm:w-64">
                                <option value="">Tất cả Phòng ban</option>
                                {filterOptions.departments.map(dep => <option key={dep.id} value={dep.id}>{dep.name}</option>)}
                            </select>
                            <select name="userId" value={filters.userId} onChange={handleFilterChange} className="input-style w-full sm:w-64">
                                <option value="">Tất cả Người dùng</option>
                                {availableUsers.map(user => <option key={user.id} value={user.id}>{user.full_name}</option>)}
                            </select>
                            <select name="status" value={filters.status} onChange={handleFilterChange} className="input-style w-full sm:w-48">
                                <option value="">Tất cả Trạng thái</option>
                                <option value="Mới">Mới</option>
                                <option value="Đang thực hiện">Đang thực hiện</option>
                                <option value="Hoàn thành">Hoàn thành</option>
                                <option value="Đã hủy">Đã hủy</option>
                            </select>
                            <label className="flex items-center gap-2 ml-2">
                                <input type="checkbox" name="isOverdue" checked={filters.isOverdue === true || filters.isOverdue === 'true'} onChange={(e) => setFilters(prev => ({ ...prev, isOverdue: e.target.checked }))} />
                                <span className="text-sm text-slate-600">Công việc Quá hạn</span>
                            </label>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto mt-2 sm:mt-0">
                            <input type="date" name="startDate" value={filters.startDate} onChange={handleFilterChange} className="input-style w-full sm:w-40" />
                            <input type="date" name="endDate" value={filters.endDate} onChange={handleFilterChange} className="input-style w-full sm:w-40" />
                        </div>
                    </div>
                </div>

                {loading ? <Spinner fullPage /> : !stats ? <p>Không thể tải dữ liệu.</p> : (
                    <>
                        {/* Biểu đồ nhanh cho các chỉ số */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                                <div className="bg-white p-6 rounded-lg shadow-md">
                                    <p className="text-sm text-slate-500">Tổng Công Việc</p>
                                    <p className="text-2xl font-bold text-slate-800">{stats.total}</p>
                                    <div className="mt-4">
                                        {(() => {
                                            const end = new Date();
                                            const start = addDays(end, -6);
                                            const labels = eachDayOfInterval({ start, end }).map(d => format(d, 'dd/MM'));
                                            const values = buildTimeSeries(detailedTasks, start, end, 'total');
                                            const dataObj = { labels, datasets: [{ label: 'Tổng', data: values, borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.2)' }] };
                                            return <Line data={dataObj} options={{ plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }} />;
                                        })()}
                                    </div>
                                </div>

                                <div className="bg-white p-6 rounded-lg shadow-md">
                                    <p className="text-sm text-slate-500">Việc mới/Chờ nhận</p>
                                    <p className="text-2xl font-bold text-slate-800">{stats.new}</p>
                                    <div className="mt-4">
                                        {(() => {
                                            const end = new Date();
                                            const start = addDays(end, -6);
                                            const labels = eachDayOfInterval({ start, end }).map(d => format(d, 'dd/MM'));
                                            const values = buildTimeSeries(detailedTasks, start, end, 'new');
                                            const dataObj = { labels, datasets: [{ label: 'Mới', data: values, backgroundColor: '#f59e0b' }] };
                                            return <Bar data={dataObj} options={{ plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }} />;
                                        })()}
                                    </div>
                                </div>

                                <div className="bg-white p-6 rounded-lg shadow-md">
                                    <p className="text-sm text-slate-500">Đang Thực Hiện</p>
                                    <p className="text-2xl font-bold text-slate-800">{stats.inProgress}</p>
                                    <div className="mt-4">
                                        {(() => {
                                            const end = new Date();
                                            const start = addDays(end, -6);
                                            const labels = eachDayOfInterval({ start, end }).map(d => format(d, 'dd/MM'));
                                            const values = buildTimeSeries(detailedTasks, start, end, 'inProgress');
                                            const dataObj = { labels, datasets: [{ label: 'Đang thực hiện', data: values, borderColor: '#fb923c', backgroundColor: 'rgba(251,146,60,0.2)' }] };
                                            return <Line data={dataObj} options={{ plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }} />;
                                        })()}
                                    </div>
                                </div>

                                <div className="bg-white p-6 rounded-lg shadow-md">
                                    <p className="text-sm text-slate-500">Hoàn Thành</p>
                                    <p className="text-2xl font-bold text-slate-800">{stats.completed}</p>
                                    <div className="mt-4">
                                        {(() => {
                                            const done = stats.completed || 0;
                                            const remaining = Math.max((stats.total || 0) - done, 0);
                                            const dataObj = { labels: ['Hoàn thành', 'Chưa hoàn'], datasets: [{ data: [done, remaining], backgroundColor: ['#16a34a', '#eef2ff'] }] };
                                            return <Pie data={dataObj} options={{ plugins: { legend: { position: 'bottom' } } }} />;
                                        })()}
                                    </div>
                                </div>

                                <div className="bg-white p-6 rounded-lg shadow-md">
                                    <p className="text-sm text-slate-500">Quá Hạn</p>
                                    <p className="text-2xl font-bold text-slate-800">{stats.overdue}</p>
                                    <div className="mt-4">
                                        {(() => {
                                            const end = new Date();
                                            const start = addDays(end, -6);
                                            const labels = eachDayOfInterval({ start, end }).map(d => format(d, 'dd/MM'));
                                            const values = buildTimeSeries(detailedTasks, start, end, 'overdue');
                                            const dataObj = { labels, datasets: [{ label: 'Quá hạn', data: values, backgroundColor: '#ef4444' }] };
                                            return <Bar data={dataObj} options={{ plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }} />;
                                        })()}
                                    </div>
                                    <div className="mt-4">
                                        <h4 className="text-sm font-semibold mb-2">Danh sách công việc quá hạn</h4>
                                        <div className="overflow-x-auto bg-white rounded">
                                            <table className="min-w-full divide-y divide-slate-200">
                                                <thead className="bg-slate-50">
                                                    <tr>
                                                        <th className="px-4 py-2 text-left text-xs font-bold text-slate-500 uppercase">Tiêu đề</th>
                                                        <th className="px-4 py-2 text-left text-xs font-bold text-slate-500 uppercase">Người thực hiện</th>
                                                        <th className="px-4 py-2 text-left text-xs font-bold text-slate-500 uppercase">Hạn chót</th>
                                                        <th className="px-4 py-2 text-left text-xs font-bold text-slate-500 uppercase">Trạng thái</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="bg-white divide-y divide-slate-200">
                                                    {detailedTasks.filter(t => t.due_date && isPast(new Date(t.due_date)) && t.status !== 'Hoàn thành').slice(0,20).map(t => (
                                                        <tr key={t.id} onClick={() => setSelectedTask(t)} className="hover:bg-slate-50 cursor-pointer">
                                                            <td className="px-4 py-2 text-sm text-slate-800">{t.title}</td>
                                                            <td className="px-4 py-2 text-sm text-slate-600">{t.assignee_name}</td>
                                                            <td className="px-4 py-2 text-sm text-red-600">{t.due_date ? format(new Date(t.due_date), 'dd/MM/yyyy', { locale: vi }) : '-'}</td>
                                                            <td className="px-4 py-2 text-sm"><span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">{t.status}</span></td>
                                                        </tr>
                                                    ))}
                                                    {detailedTasks.filter(t => t.due_date && isPast(new Date(t.due_date)) && t.status !== 'Hoàn thành').length === 0 && (
                                                        <tr><td colSpan="4" className="text-center py-6 text-slate-500">Không có công việc quá hạn.</td></tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            </div>

                        {/* Bảng chi tiết */}
                        <h2 className="text-2xl font-bold text-slate-800 mb-4">Danh sách công việc chi tiết</h2>
                        <div className="bg-white shadow-lg rounded-lg overflow-x-auto">
                            <table className="min-w-full divide-y divide-slate-200">
                                <thead className="bg-slate-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Tên công việc</th>
                                        <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Người thực hiện</th>
                                        <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Hạn chót</th>
                                        <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Trạng thái</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-slate-200">
                                    {detailedTasks.map(task => (
                                        <tr key={task.id} onClick={() => setSelectedTask(task)} className="hover:bg-slate-50 cursor-pointer">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{task.title}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{task.assignee_name}</td>
                                            <td className={`px-6 py-4 whitespace-nowrap text-sm ${isPast(new Date(task.due_date)) && task.status !== 'Hoàn thành' ? 'text-red-600 font-semibold' : 'text-slate-600'}`}>
                                                {format(new Date(task.due_date), 'dd/MM/yyyy', { locale: vi })}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${task.status === 'Hoàn thành' ? 'bg-green-100 text-green-800' : isPast(new Date(task.due_date)) ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>
                                                  {task.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                    {detailedTasks.length === 0 && (
                                        <tr>
                                            <td colSpan="4" className="text-center py-10 text-slate-500">Không có công việc nào phù hợp với bộ lọc.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* KPI moved to a dedicated page. Removed inline KPI summary to avoid duplicate content. */}
                    </>
                )}
            </div>
        </>
    );
};

export default ReportsPage;