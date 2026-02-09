// ubndxanuicam/frontend/src/pages/DashboardPage.jsx
// VERSION 2.2 - CORRECTED USER DATA HANDLING

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import apiService from '../services/apiService';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import useAuth from '../hooks/useAuth';
import eventBus from '../utils/eventBus';
import { Briefcase, FilePlus2, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import Spinner from '../components/common/Spinner';
import DashboardTasksModal from '../components/dashboard/DashboardTasksModal';
import TaskDetailModal from '../components/tasks/TaskDetailModal';

const StatCard = ({ title, value, icon, color, onClick }) => (
    <div 
        className={`p-4 bg-white rounded-lg shadow-md flex items-center justify-between ${onClick ? 'cursor-pointer hover:shadow-lg hover:border-blue-500 border-2 border-transparent transition-all' : ''}`} 
        onClick={onClick}
    >
        <div>
            <p className="text-sm font-medium text-slate-500">{title}</p>
            <p className="text-2xl font-bold text-slate-800">{value}</p>
        </div>
        <div className={`p-3 rounded-full ${color}`}>
            {React.cloneElement(icon, { className: 'text-white' })}
        </div>
    </div>
);

const slogans = [
    'Ra về ta tự hỏi ta, tám giờ vàng ngọc làm ra những gì!',
    'Việc dân là việc của mình. Tận tâm cống hiến, nghĩa tình trước sau.',
    'Việc hôm nay chớ để ngày mai. Chậm trễ một khắc, kéo dài gian nan.',
    'Cần, Kiệm, Liêm, Chính giữ mình. Chí công vô tư, quang minh rạng ngời.',
    'Gian nan chẳng ngại, khó chẳng từ. Sáng tạo đổi mới, việc hư hóa thành.',
    'Trà dư tửu hậu xin dừng, Việc công chưa dứt, chớ mừng vội nha.',
    'Hồ sơ xếp lớp tầng tầng. Xử xong một cái, tinh thần lên hương.'
];

const SloganBanner = ({ user }) => {
    const [index, setIndex] = useState(0);
    const [visible, setVisible] = useState(true);

    useEffect(() => {
        const id = setInterval(() => {
            // fade out, change, fade in
            setVisible(false);
            setTimeout(() => {
                setIndex(i => (i + 1) % slogans.length);
                setVisible(true);
            }, 600);
        }, 15000);
        return () => clearInterval(id);
    }, []);

    return (
        <p className="mt-1 text-slate-500 transition-opacity duration-600" style={{ opacity: visible ? 1 : 0 }}>
            {slogans[index]}
        </p>
    );
};

const DashboardPage = () => {
    const { user } = useAuth();
    const [allTasks, setAllTasks] = useState([]);
    const [allUsers, setAllUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    
    const [isTasksModalOpen, setIsTasksModalOpen] = useState(false);
    const [modalContent, setModalContent] = useState({ title: '', tasks: [] });
    
    const [selectedTask, setSelectedTask] = useState(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [tasksRes, usersRes] = await Promise.all([
                apiService.getTasks(),
                apiService.getUsers({ limit: 1000 })
            ]);
            setAllTasks(tasksRes);
            // SỬA LỖI QUAN TRỌNG: Chỉ lấy mảng 'data' từ kết quả API
            setAllUsers(usersRes.data || []);
        } catch (error) {
            console.error("Lỗi khi tải dữ liệu dashboard:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    // Reports data (merged into dashboard)
    const [reportFilters, setReportFilters] = useState({ users: [], departments: [] });
    const [reportFiltersSelected, setReportFiltersSelected] = useState({ userId: '', departmentId: '', startDate: '', endDate: '', status: '', isOverdue: false });
    const [reportTasks, setReportTasks] = useState([]);
    const [reportTotal, setReportTotal] = useState(0);
    const [reportPage, setReportPage] = useState(1);
    const [reportPerPage, setReportPerPage] = useState(10);
    const [showExportMenu, setShowExportMenu] = useState(false);
    const exportMenuRef = useRef(null);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [exportFormat, setExportFormat] = useState(null);
    const [exportPassword, setExportPassword] = useState('');
    const [exportLoading, setExportLoading] = useState(false);

    const fetchReportFilters = useCallback(async () => {
        try {
            const data = await apiService.getReportFilters();
            setReportFilters(data);
        } catch (err) {
            console.error('Lỗi tải bộ lọc báo cáo', err);
        }
    }, []);

    const fetchReportData = useCallback(async () => {
        try {
            // Build cleaned object similar to ReportsPage so apiService receives a plain params object
            const cleaned = Object.fromEntries(Object.entries(reportFiltersSelected).filter(([_, v]) => v !== undefined && v !== null && v !== ''));
            const paramsObj = { ...cleaned };
            if (paramsObj.startDate && !paramsObj.startDate.includes('T')) paramsObj.startDate = `${paramsObj.startDate}T00:00:00Z`;
            if (paramsObj.endDate && !paramsObj.endDate.includes('T')) paramsObj.endDate = `${paramsObj.endDate}T23:59:59Z`;

            // Ensure isOverdue is sent as string 'true' when checked (backend expects string)
            if (typeof paramsObj.isOverdue === 'boolean') paramsObj.isOverdue = paramsObj.isOverdue ? 'true' : '';

            // include pagination params for server-side pagination
            const paramsWithPage = { ...paramsObj, page: reportPage, pageSize: reportPerPage };
            const [, tasksRes] = await Promise.all([
                apiService.getOverviewStats(paramsObj),
                apiService.getDetailedTaskReport(paramsWithPage)
            ]);
            // tasksRes expected { items, total } when paged
            if (tasksRes && Array.isArray(tasksRes.items)) {
                setReportTasks(tasksRes.items);
                setReportTotal(tasksRes.total || 0);
            } else if (Array.isArray(tasksRes)) {
                setReportTasks(tasksRes);
                setReportTotal(tasksRes.length);
            } else {
                setReportTasks([]);
                setReportTotal(0);
            }
        } catch (err) {
            console.error('Lỗi tải dữ liệu báo cáo', err);
        }
    }, [reportFiltersSelected, reportPage, reportPerPage]);

    // Available users filtered by selected department (same logic as ReportsPage)
    const availableUsers = useMemo(() => {
        if (!reportFiltersSelected.departmentId) return reportFilters.users || [];
        return (reportFilters.users || []).filter(u => u.department_id === parseInt(reportFiltersSelected.departmentId));
    }, [reportFiltersSelected.departmentId, reportFilters.users]);

    useEffect(() => {
        fetchData();
        fetchReportFilters();
    }, [fetchData, fetchReportFilters]);

    // Close export menu when clicking outside or pressing Esc
    useEffect(() => {
        const onDoc = (e) => {
            if (!showExportMenu) return;
            if (e.type === 'keydown' && e.key === 'Escape') return setShowExportMenu(false);
            if (exportMenuRef.current && !exportMenuRef.current.contains(e.target)) setShowExportMenu(false);
        };
        document.addEventListener('click', onDoc);
        document.addEventListener('keydown', onDoc);
        return () => {
            document.removeEventListener('click', onDoc);
            document.removeEventListener('keydown', onDoc);
        };
    }, [showExportMenu]);

    useEffect(() => {
        // fetch reports when filters change
        fetchReportData();
    }, [fetchReportData]);
    
    const stats = useMemo(() => {
        const now = new Date();
        return {
            total: { title: 'Tất cả Công Việc', tasks: allTasks },
            new: { title: 'Việc mới/Chờ nhận', tasks: allTasks.filter(t => ['Mới tạo', 'Tiếp nhận', 'Yêu cầu làm lại'].includes(t.status)) },
            inProgress: { title: 'Đang Thực Hiện', tasks: allTasks.filter(t => t.status === 'Đang thực hiện') },
            pendingApproval: { title: 'Chờ duyệt', tasks: allTasks.filter(t => t.status === 'Chờ duyệt') },
            completed: { title: 'Hoàn Thành', tasks: allTasks.filter(t => t.status === 'Hoàn thành') },
            overdue: { title: 'Quá Hạn', tasks: allTasks.filter(t => t.status !== 'Hoàn thành' && new Date(t.due_date) < now) },
            // Note: 'Công Việc Đã Hủy' removed from main cards; managed separately in Deleted Tasks page
        };
    }, [allTasks]);

    const handleStatClick = (type) => {
        if (stats[type]) {
            setModalContent({ title: stats[type].title, tasks: stats[type].tasks });
            setIsTasksModalOpen(true);
        }
    };
    
    const handleTaskClickFromModal = (task) => {
        setIsTasksModalOpen(false);
        setSelectedTask(task);
    };

    useEffect(() => {
        const off = eventBus.on('task.kpi.updated', (payload) => {
            // update allTasks in-place to reflect new kpi score
            setAllTasks(prev => prev.map(t => t.id === payload.id ? { ...t, kpi_score: payload.kpi_score } : t));
        });
        return off;
    }, []);
    
    const handleCloseDetailModal = () => {
        setSelectedTask(null);
    };

    if (loading) return <Spinner fullPage />;

    return (
        <>
            <DashboardTasksModal 
                isOpen={isTasksModalOpen}
                onClose={() => setIsTasksModalOpen(false)}
                onTaskClick={handleTaskClickFromModal}
                title={modalContent.title}
                tasks={modalContent.tasks}
                users={allUsers}
                onUpdate={fetchData}
            />
            
            {selectedTask && (
                 <TaskDetailModal
                    task={selectedTask}
                    users={allUsers}
                    onClose={handleCloseDetailModal}
                    onUpdate={() => {
                        fetchData();
                        handleCloseDetailModal();
                    }}
                />
            )}

            <div>
                <h1 className="text-3xl font-bold text-slate-800">Bảng điều khiển</h1>
                <SloganBanner user={user} />
                
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 xl:grid-cols-7 gap-4 mt-6">
                    <StatCard title={stats.total.title} value={stats.total.tasks.length} icon={<Briefcase size={20}/>} color="bg-blue-500" onClick={() => handleStatClick('total')} />
                    <StatCard title={stats.new.title} value={stats.new.tasks.length} icon={<FilePlus2 size={20}/>} color="bg-yellow-500" onClick={() => handleStatClick('new')} />
                    <StatCard title={stats.inProgress.title} value={stats.inProgress.tasks.length} icon={<Loader2 size={20} className="animate-spin"/>} color="bg-orange-500" onClick={() => handleStatClick('inProgress')} />
                    <StatCard title={stats.pendingApproval.title} value={stats.pendingApproval.tasks.length} icon={<Loader2 size={20}/>} color="bg-indigo-500" onClick={() => handleStatClick('pendingApproval')} />
                    <StatCard title={stats.completed.title} value={stats.completed.tasks.length} icon={<CheckCircle size={20}/>} color="bg-green-500" onClick={() => handleStatClick('completed')} />
                    <StatCard title={stats.overdue.title} value={stats.overdue.tasks.length} icon={<AlertTriangle size={20}/>} color="bg-red-500" onClick={() => handleStatClick('overdue')} />
                </div>

                {/* Merged Reports section */}
                <div className="mt-8 bg-white p-4 rounded-lg shadow-sm">
                    <h2 className="text-xl font-bold mb-4">Báo cáo nhanh</h2>
                    <div className="flex flex-col sm:flex-row gap-3 mb-4">
                        <div className="flex flex-wrap gap-3 w-full">
                            <select name="departmentId" value={reportFiltersSelected.departmentId} onChange={(e)=> setReportFiltersSelected(prev=> ({...prev, departmentId: e.target.value, userId: ''}))} className="input-style w-full sm:w-64">
                                <option value="">Tất cả Phòng ban</option>
                                {reportFilters.departments?.map(d=> <option key={d.id} value={d.id}>{d.name}</option>)}
                            </select>
                            <select name="userId" value={reportFiltersSelected.userId} onChange={(e)=> setReportFiltersSelected(prev=> ({...prev, userId: e.target.value}))} className="input-style w-full sm:w-64">
                                <option value="">Tất cả Người dùng</option>
                                {availableUsers.map(u=> <option key={u.id} value={u.id}>{u.full_name}</option>)}
                            </select>
                            <select name="status" value={reportFiltersSelected.status} onChange={(e)=> {
                                const v = e.target.value;
                                if (v === 'overdue') {
                                    setReportFiltersSelected(prev=> ({...prev, status: '', isOverdue: true}));
                                } else {
                                    setReportFiltersSelected(prev=> ({...prev, status: v, isOverdue: false}));
                                }
                            }} className="input-style w-full sm:w-48">
                                <option value="">Tất cả công việc</option>
                                <option value="Mới">Mới</option>
                                <option value="Đang thực hiện">Đang thực hiện</option>
                                <option value="Hoàn thành">Hoàn thành</option>
                                <option value="Chờ duyệt">Chờ duyệt</option>
                                <option value="Đã hủy">Đã hủy</option>
                                <option value="overdue">Công việc quá hạn</option>
                            </select>
                        </div>
                        <div className="flex items-center gap-3 w-full sm:w-auto mt-2 sm:mt-0">
                            <div className="flex flex-col sm:flex-row gap-3 w-full">
                                <input type="date" name="startDate" value={reportFiltersSelected.startDate} onChange={(e)=> setReportFiltersSelected(prev=> ({...prev, startDate: e.target.value}))} className="input-style w-full sm:w-40" />
                                <input type="date" name="endDate" value={reportFiltersSelected.endDate} onChange={(e)=> setReportFiltersSelected(prev=> ({...prev, endDate: e.target.value}))} className="input-style w-full sm:w-40" />
                            </div>
                            {/* Export dropdown near date selectors */}
                            <div className="relative" ref={exportMenuRef}>
                                <button data-testid="export-dropdown-button" onClick={() => setShowExportMenu(s => !s)} className="btn-secondary" style={{ whiteSpace: 'nowrap' }}>Xuất báo cáo ▾</button>
                                {showExportMenu && (
                                    <div className="absolute right-0 mt-2 w-44 bg-white border rounded shadow-md z-50">
                                        <button data-testid="export-excel" className="w-full text-left px-3 py-2 hover:bg-slate-100" onClick={() => { setExportFormat('xlsx'); setShowExportMenu(false); setShowPasswordModal(true); }}>Xuất Excel</button>
                                        <button data-testid="export-pdf" className="w-full text-left px-3 py-2 hover:bg-slate-100" onClick={() => { setExportFormat('pdf'); setShowExportMenu(false); setShowPasswordModal(true); }}>Xuất PDF</button>
                                        <button data-testid="export-csv" className="w-full text-left px-3 py-2 hover:bg-slate-100" onClick={() => { setExportFormat('csv'); setShowExportMenu(false); setShowPasswordModal(true); }}>Xuất CSV</button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {showPasswordModal && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center">
                          <div className="absolute inset-0 bg-black opacity-30" onClick={() => setShowPasswordModal(false)} />
                          <div className="bg-white rounded shadow-lg z-60 p-6 w-full max-w-md">
                            <h3 className="text-lg font-semibold mb-3">Xác thực mật khẩu để xuất báo cáo</h3>
                            <input data-testid="export-password-input" type="password" className="w-full border px-3 py-2 rounded mb-3" placeholder="Nhập mật khẩu" value={exportPassword} onChange={(e) => setExportPassword(e.target.value)} />
                            <div className="flex justify-end gap-2">
                              <button className="btn" onClick={() => { setShowPasswordModal(false); setExportPassword(''); }}>Hủy</button>
                              <button data-testid="export-confirm-button" className="btn-primary" onClick={async () => {
                                  // check quota via backend then perform export
                                  setExportLoading(true);
                                  try {
                                      // attempt server-side quota check if available
                                      let allowed = true;
                                      try {
                                          const q = await apiService.getExportQuota();
                                          // expect shape { allowed: boolean, last_export_at: string }
                                          if (q && typeof q.allowed !== 'undefined') allowed = q.allowed;
                                      } catch (e) {
                                          // fallback to localStorage per-user
                                          const uid = (user && user.id) ? user.id : 'anon';
                                          const key = `export_quota_${uid}`;
                                          const last = localStorage.getItem(key);
                                          if (last) {
                                              const d = new Date(last);
                                              const today = new Date();
                                              if (d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate()) {
                                                  allowed = false;
                                              }
                                          }
                                      }
                                      if (!allowed) {
                                          alert('Mỗi tài khoản chỉ được xuất báo cáo 1 lần mỗi ngày.');
                                          setExportLoading(false);
                                          return;
                                      }

                                      // Build export payload
                                      const payload = { params: reportFiltersSelected, format: exportFormat, password: exportPassword };
                                      // include nice filename and sheet name hints
                                      const ts = new Date();
                                      const pad = (n) => String(n).padStart(2, '0');
                                      const fnameTs = `${pad(ts.getDate())}${pad(ts.getMonth()+1)}${ts.getFullYear()}${pad(ts.getHours())}${pad(ts.getMinutes())}${pad(ts.getSeconds())}`;
                                      const sheetDay = `${pad(ts.getDate())}${pad(ts.getMonth()+1)}${ts.getFullYear()}`;
                                      const ext = exportFormat === 'xlsx' ? 'xlsx' : exportFormat === 'pdf' ? 'pdf' : 'csv';
                                      const filename = `xanuicam_dashboard_${fnameTs}.${ext}`;
                                      payload.filename = filename;
                                      payload.sheet_name = `xanuicam_dashboard_${sheetDay}`;
                                      payload.module = 'dashboard';

                                      const resp = await apiService.exportTasksRaw(payload);
                                      const blob = resp && resp.blob ? resp.blob : (resp.data || null);
                                      const fname = resp && resp.filename ? resp.filename : filename;
                                      if (!blob) throw new Error('Không nhận được dữ liệu file từ server.');
                                      const url = window.URL.createObjectURL(blob);
                                      const a = document.createElement('a');
                                      a.href = url;
                                      a.download = fname;
                                      document.body.appendChild(a);
                                      a.click();
                                      a.remove();
                                      window.URL.revokeObjectURL(url);

                                      // mark quota used locally if backend didn't block
                                      try {
                                          const uid = (user && user.id) ? user.id : 'anon';
                                          const key = `export_quota_${uid}`;
                                          localStorage.setItem(key, new Date().toISOString());
                                      } catch (e) { /* ignore */ }

                                      alert('Xuất báo cáo thành công');
                                      setShowPasswordModal(false);
                                      setExportPassword('');
                                  } catch (err) {
                                      console.error('Export error', err);
                                      const msg = err && err.message ? err.message : 'Lỗi khi xuất báo cáo.';
                                      alert(msg);
                                  } finally { setExportLoading(false); }
                              }} disabled={exportLoading}>{exportLoading ? 'Đang xuất...' : 'Xác nhận & Xuất'}</button>
                            </div>
                          </div>
                        </div>
                    )}

                    <div className="overflow-x-auto">
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
                                {reportTasks.map(t => (
                                    <tr
                                        key={t.id}
                                        className="hover:bg-slate-50 cursor-pointer"
                                        role="button"
                                        tabIndex={0}
                                        title={`Xem chi tiết: ${t.title}`}
                                        onClick={() => setSelectedTask(t)}
                                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedTask(t); }}
                                    >
                                        <td className="px-6 py-4 text-sm font-medium text-slate-900">{t.title}</td>
                                        <td className="px-6 py-4 text-sm text-slate-600">{t.assignee_name}</td>
                                        <td className="px-6 py-4 text-sm text-slate-600">{t.due_date ? format(new Date(t.due_date), 'dd/MM/yyyy', { locale: vi }) : ''}</td>
                                        <td className="px-6 py-4 text-sm"><span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${t.status === 'Hoàn thành' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>{t.status}</span></td>
                                    </tr>
                                ))}
                                {reportTasks.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="text-center py-8 text-slate-500">Không có dữ liệu báo cáo.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                        <div className="flex items-center justify-between mt-3">
                            <div className="flex items-center gap-3">
                                <label className="text-sm">Hiển thị</label>
                                <select value={reportPerPage} onChange={(e)=> { setReportPerPage(parseInt(e.target.value,10)); setReportPage(1); }} className="input-style text-sm w-20">
                                    <option value={5}>5</option>
                                    <option value={10}>10</option>
                                    <option value={20}>20</option>
                                </select>
                                <span className="text-sm">Số lượng công việc: {reportTotal} mục</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <button className="btn-secondary" onClick={() => setReportPage(p => Math.max(1, p-1))} disabled={reportPage === 1}>Trước</button>
                                <div className="text-sm">{reportPage} / {Math.max(1, Math.ceil(reportTotal / reportPerPage))}</div>
                                <button className="btn-secondary" onClick={() => setReportPage(p => Math.min(Math.ceil(reportTotal / reportPerPage), p+1))} disabled={reportPage >= Math.ceil(reportTotal / reportPerPage)}>Tiếp</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default DashboardPage;