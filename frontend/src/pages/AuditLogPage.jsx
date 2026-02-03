import React, { useState, useEffect, useCallback } from 'react';
import apiService from '../services/apiService';
import auditService from '../services/auditService';
import Spinner from '../components/common/Spinner';
import PasswordExportModal from '../components/users/PasswordExportModal';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Search, User, Filter } from 'lucide-react';
import Pagination from '../components/common/Pagination';
import AuditDetailModal from '../components/audit/AuditDetailModal';

const MODULE_OPTIONS = [
    { value: 'Công việc', label: 'Quản lý Công việc' },
    { value: 'Tài khoản', label: 'Quản lý Tài khoản' },
    { value: 'Phòng ban', label: 'Quản lý Phòng ban' },
    { value: 'Phân quyền', label: 'Quản lý Phân quyền' },
];

const AuditLogPage = () => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({ user: '', action: '', module: '', startDate: '', endDate: '' });
    const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, totalItems: 0 });
    const [perPage, setPerPage] = useState(10);
    const [exportOpen, setExportOpen] = useState(false);
    const [exportFormat, setExportFormat] = useState('xlsx');
    const [passwordModalOpen, setPasswordModalOpen] = useState(false);
    const [exportQuota, setExportQuota] = useState(null);
    const [selectedLogId, setSelectedLogId] = useState(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);

    const fetchLogs = useCallback(async (page = 1, currentFilters) => {
        setLoading(true);
        try {
            const cleanedFilters = Object.fromEntries(
                Object.entries(currentFilters).filter(([_, v]) => v != null && v !== '')
            );
            const params = { page, limit: perPage, ...cleanedFilters };
            const res = await apiService.getAuditLogs(params);
            setLogs(res.logs);
            setPagination({ 
                currentPage: res.currentPage, 
                totalPages: res.totalPages,
                totalItems: res.totalItems 
            });
        } catch (error) {
            console.error("Lỗi khi tải nhật ký:", error);
        } finally {
            setLoading(false);
        }
    }, [perPage]);

    useEffect(() => {
        const handler = setTimeout(() => {
            fetchLogs(1, filters);
        }, 500);
        // keep export quota up-to-date for export UI
        fetchExportQuota();
        return () => clearTimeout(handler);
    }, [filters, fetchLogs, perPage]);

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const downloadBlob = (blob, filename) => {
        try {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (e) {
            console.error('Download failed', e);
        }
    };

    const fetchExportQuota = async () => {
        try {
            const q = await apiService.getAuditExportQuota();
            if (q && q.remaining !== undefined) setExportQuota(q);
        } catch (e) {
            // ignore errors retrieving quota
        }
    };

    const openExportPasswordModal = async (format) => {
        setExportFormat(format);
        // fetch quota (graceful)
        try {
            const res = await fetch('/api/audit-logs/export/quota', { credentials: 'include' });
            if (res.ok) {
                const js = await res.json(); setExportQuota(js);
            }
        } catch (e) {}
        setPasswordModalOpen(true);
    };

    const confirmExportWithPassword = async (password) => {
        setPasswordModalOpen(false);
        try {
            const body = { format: exportFormat, page: pagination.currentPage, limit: perPage, filters };
            // include password for confirmation
            body.password = password;
            const out = await auditService.exportLogs(body);
            if (out && out.blob && out.filename) {
                downloadBlob(out.blob, out.filename);
            } else if (out && out.data && out.filename) {
                // some clients return { data: blob }
                downloadBlob(out.data, out.filename);
            } else {
                alert('Không thể xuất file');
            }
        } catch (e) {
            const msg = (e && e.message) ? e.message : 'Lỗi khi xuất báo cáo';
            try { alert(msg); } catch (err) {}
        }
    };
    
    return (
        <div>
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800 mb-2">Nhật ký hệ thống</h1>
                    <p className="text-slate-500">Theo dõi mọi hoạt động quan trọng diễn ra trên hệ thống.</p>
                </div>
                <div className="relative">
                    <button className="btn-primary" onClick={() => setExportOpen((s) => !s)}>Xuất báo cáo ▾</button>
                    {exportOpen && (
                        <div data-export-dropdown className="absolute right-0 mt-2 w-40 bg-white border rounded shadow-md z-40">
                            <button className="w-full text-left px-3 py-2 hover:bg-slate-100" onClick={() => { openExportPasswordModal('xlsx'); setExportOpen(false); }}>Xuất Excel</button>
                            <button className="w-full text-left px-3 py-2 hover:bg-slate-100" onClick={() => { openExportPasswordModal('pdf'); setExportOpen(false); }}>Xuất PDF</button>
                            <button className="w-full text-left px-3 py-2 hover:bg-slate-100" onClick={() => { openExportPasswordModal('csv'); setExportOpen(false); }}>Xuất CSV</button>
                        </div>
                    )}
                </div>
            </div>

            {/* Filters: responsive grid so controls stack on narrow screens */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-4 mb-4 p-4 bg-white rounded-lg shadow-sm">
                <div className="relative col-span-1 md:col-span-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input type="text" name="action" placeholder="Tìm theo hành động..." onChange={handleFilterChange} className="w-full pl-10 input-style" />
                </div>
                <div className="relative col-span-1 md:col-span-1">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input type="text" name="user" placeholder="Tìm theo người thực hiện..." onChange={handleFilterChange} className="w-full pl-10 input-style" />
                </div>
                <div className="relative col-span-1 md:col-span-1">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <select name="module" onChange={handleFilterChange} value={filters.module} className="w-full pl-10 input-style appearance-none">
                        <option value="">Tất cả Module</option>
                        {MODULE_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                </div>
                <div className="relative col-span-1 md:col-span-1">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <select name="event" onChange={handleFilterChange} value={filters.event || ''} className="w-full pl-10 input-style appearance-none">
                        <option value="">Tất cả sự kiện</option>
                        <option value="lock">Khóa tài khoản</option>
                        <option value="unlock">Mở khóa tài khoản</option>
                    </select>
                </div>
                <div className="col-span-1 md:col-span-1">
                    <input type="date" name="startDate" onChange={handleFilterChange} className="input-style w-full" />
                </div>
                <div className="col-span-1 md:col-span-1">
                    <input type="date" name="endDate" onChange={handleFilterChange} className="input-style w-full" />
                </div>
            </div>

            {/* Table */}
            <div className="bg-white shadow-lg rounded-lg overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Người thực hiện</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Module</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Hành động</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Chi tiết</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Thời gian</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                        {loading && (
                            <tr><td colSpan="5" className="text-center py-10"><Spinner/></td></tr>
                        )}
                        {!loading && logs.map(log => (
                            <tr key={log.id} className="cursor-pointer hover:bg-slate-50" onClick={() => { setSelectedLogId(log.id); setIsDetailOpen(true); }}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-800">{log.user_name}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{log.module}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{log.action}</td>
                                <td className="px-6 py-4 text-sm text-slate-600">
                                    {log.details}
                                    {log.task_title && <span className="block text-xs text-blue-600"> (Công việc: {log.task_title})</span>}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                    {format(new Date(log.created_at), 'HH:mm, dd/MM/yyyy', { locale: vi })}
                                </td>
                            </tr>
                        ))}
                        {!loading && logs.length === 0 && (
                            <tr>
                                <td colSpan="5" className="text-center py-10 text-slate-500">Không tìm thấy nhật ký phù hợp.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
                <Pagination 
                    currentPage={pagination.currentPage}
                    totalPages={pagination.totalPages}
                    onPageChange={(page) => fetchLogs(page, filters)}
                    perPage={perPage}
                    onPerPageChange={(n) => { setPerPage(n); fetchLogs(1, filters); }}
                    summary={{ total: pagination.totalItems }}
                    summaryLabel="Số lượng nhật ký"
                    useTextButtons={true}
                    showPerPageLabel={true}
                />
            </div>
            <AuditDetailModal isOpen={isDetailOpen} onClose={() => setIsDetailOpen(false)} auditId={selectedLogId} />
            <PasswordExportModal isOpen={passwordModalOpen} onClose={() => setPasswordModalOpen(false)} onConfirm={confirmExportWithPassword} format={exportFormat} quota={exportQuota} />
        </div>
    );
};

export default AuditLogPage;