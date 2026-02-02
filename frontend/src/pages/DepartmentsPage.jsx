import React, { useState, useEffect, useCallback } from 'react';
import useAuth from '../hooks/useAuth';
import apiService from '../services/apiService';
import { Plus, Edit, Trash2, User } from 'lucide-react';
import Spinner from '../components/common/Spinner';
import DepartmentModal from '../components/departments/DepartmentModal';
import DeleteConfirmationModal from '../components/common/DeleteConfirmationModal';
import Notification from '../components/common/Notification';
import Pagination from '../components/common/Pagination';
import defaultAvatar from '../assets/images/default-avatar.png';
import { Link } from 'react-router-dom';

const DepartmentsPage = () => {
    const [departments, setDepartments] = useState([]);
    const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1 });
    const [loading, setLoading] = useState(true);
    const { hasPermission, user } = useAuth();
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [selectedDepartment, setSelectedDepartment] = useState(null);
    const [modalMode, setModalMode] = useState('create');
    const [users, setUsers] = useState([]);
    const [notification, setNotification] = useState({ message: '', type: '' });
    const [showExportMenu, setShowExportMenu] = useState(false);
    const exportMenuRef = React.useRef(null);
    const [exportFormat, setExportFormat] = useState(null);
    const [exportLoading, setExportLoading] = useState(false);
    const [showMfaModal, setShowMfaModal] = useState(false);
    const [mfaCode, setMfaCode] = useState('');
    const BACKEND_URL = process.env.REACT_APP_API_BASE_URL.replace('/api', '');

    const fetchDepartments = useCallback(async (page = 1) => {
        setLoading(true);
        try {
            const [departmentsRes, usersRes] = await Promise.all([
                apiService.getDepartments({ page, limit: 10 }),
                apiService.getUsers({ limit: 1000 })
            ]);
            setDepartments(departmentsRes.data);
            setPagination(departmentsRes.pagination);
            setUsers(usersRes.data);
        } catch (error) {
            setNotification({ message: 'Không thể tải dữ liệu.', type: 'error'});
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchDepartments(1);
    }, [fetchDepartments]);
    
    // close export menu when clicking outside (always register hook so Hooks order is stable)
    React.useEffect(() => {
        const onDocClick = (e) => {
            if (!exportMenuRef.current) return;
            if (!exportMenuRef.current.contains(e.target)) setShowExportMenu(false);
        };
        if (showExportMenu) document.addEventListener('click', onDocClick);
        return () => document.removeEventListener('click', onDocClick);
    }, [showExportMenu]);
    
    const handleSuccess = (message) => {
        fetchDepartments(pagination.currentPage);
        setNotification({ message, type: 'success' });
    };

    const handleOpenCreateModal = () => {
        setSelectedDepartment(null);
        setModalMode('create');
        setIsModalOpen(true);
    };

    const handleOpenEditModal = (department) => {
        setSelectedDepartment(department);
        setModalMode('edit');
        setIsModalOpen(true);
    };

    const handleOpenDeleteModal = (department) => {
        setSelectedDepartment(department);
        setIsDeleteModalOpen(true);
    };

    const handleDelete = async () => {
        if (!selectedDepartment) return;
        try {
            const res = await apiService.deleteDepartment(selectedDepartment.id);
            setNotification({ message: res.message || 'Xóa thành công!', type: 'success' });
            fetchDepartments(pagination.currentPage);
        } catch (error) {
            setNotification({ message: error || 'Xóa thất bại.', type: 'error' });
        }
    }
    
    const canManage = hasPermission(['department_management']);

    if (loading && departments.length === 0) return <Spinner fullPage />;

    const handleExportSelect = (format) => {
        setShowExportMenu(false);
        setExportFormat(format);
        // If user has MFA enabled, require TOTP; otherwise proceed
        if (user && user.mfa_enabled) {
            setShowMfaModal(true);
            return;
        }
        doExport(format);
    };

    const doExport = async (format, totp) => {
        setExportLoading(true);
        try {
            // If MFA code provided, verify first via API
            if (totp) {
                await apiService.mfaVerify({ token: totp });
            }
            const res = await apiService.exportDepartmentsRaw({ format, totp });
            const ts = new Date();
            const pad = (n) => String(n).padStart(2, '0');
            const fnameTs = `${pad(ts.getDate())}${pad(ts.getMonth()+1)}${ts.getFullYear()}${pad(ts.getHours())}${pad(ts.getMinutes())}${pad(ts.getSeconds())}`;
            const ext = format === 'xlsx' ? 'xlsx' : format === 'pdf' ? 'pdf' : 'csv';
            const filename = `xanuicam_departments_${fnameTs}.${ext}`;
            const blobType = format === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : (format === 'pdf' ? 'application/pdf' : 'text/csv');
            const blob = new Blob([res.data], { type: blobType });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
            setNotification({ message: `Xuất ${ext.toUpperCase()} thành công`, type: 'success' });
            setShowMfaModal(false);
            setMfaCode('');
        } catch (err) {
            console.error('Export error', err);
            const msg = err && err.message ? err.message : 'Lỗi khi xuất báo cáo.';
            setNotification({ message: msg, type: 'error' });
        } finally {
            setExportLoading(false);
        }
    };

    const handleConfirmMfaExport = async () => {
        if (!exportFormat) return;
        await doExport(exportFormat, mfaCode);
    };


    return (
        <>
            <Notification 
                message={notification.message}
                type={notification.type}
                onClose={() => setNotification({ message: '', type: '' })}
            />
                        {showMfaModal && (
                                <div className="fixed inset-0 z-50 flex items-center justify-center">
                                    <div className="absolute inset-0 bg-black opacity-30" onClick={() => setShowMfaModal(false)} />
                                    <div className="bg-white rounded shadow-lg z-60 p-6 w-full max-w-md">
                                        <h3 className="text-lg font-semibold mb-3">Xác thực TOTP để xuất báo cáo</h3>
                                        <input type="text" className="w-full border px-3 py-2 rounded mb-3" placeholder="Nhập mã 6 chữ số TOTP" value={mfaCode} onChange={(e) => setMfaCode(e.target.value)} />
                                        <div className="flex justify-end gap-2">
                                            <button className="btn" onClick={() => { setShowMfaModal(false); setMfaCode(''); }}>Hủy</button>
                                            <button className="btn-primary" onClick={handleConfirmMfaExport} disabled={exportLoading}>{exportLoading ? 'Đang xác thực...' : 'Xác nhận & Xuất'}</button>
                                        </div>
                                    </div>
                                </div>
                        )}
            <div>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800">Quản lý Phòng ban & Đơn vị</h1>
                        <p className="text-sm text-slate-500">(Tạo, chỉnh sửa các Phòng chuyên môn, Trung tâm, Tổ giúp việc,...)</p>
                    </div>
                    {canManage && (
                        <div className="flex items-center gap-2">
                            <button onClick={handleOpenCreateModal} className="btn-primary">
                                <Plus size={20} className="mr-2"/>
                                Thêm mới
                            </button>
                            <div className="relative" ref={exportMenuRef}>
                                <button onClick={() => setShowExportMenu(s => !s)} className="btn-secondary">Xuất báo cáo</button>
                                {showExportMenu && (
                                    <div className="absolute right-0 mt-2 w-44 bg-white border rounded shadow-md z-50">
                                        <button className="w-full text-left px-3 py-2 hover:bg-slate-100" onClick={() => handleExportSelect('xlsx')}>Xuất Excel</button>
                                        <button className="w-full text-left px-3 py-2 hover:bg-slate-100" onClick={() => handleExportSelect('pdf')}>Xuất PDF</button>
                                        <button className="w-full text-left px-3 py-2 hover:bg-slate-100" onClick={() => handleExportSelect('csv')}>Xuất CSV</button>
                                    </div>
                                )}
                            </div>
                            <Link to="/departments/deleted" className="btn-outline">Phòng ban đã xóa</Link>
                        </div>
                    )}
                </div>

                <div className="bg-white shadow-lg rounded-lg overflow-hidden">
                    <ul className="divide-y divide-slate-200">
                        {loading && <div className="p-4 text-center"><Spinner /></div>}
                        {!loading && departments.length > 0 ? departments.map(dep => (
                            <li key={dep.id} className="p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between hover:bg-slate-50 gap-4">
                                <div className="flex items-center flex-grow">
                                    <img 
                                        src={dep.avatar ? `${BACKEND_URL}/${dep.avatar}` : defaultAvatar} 
                                        alt={`Avatar của ${dep.name}`}
                                        className="w-12 h-12 rounded-full object-cover mr-4"
                                    />
                                    <div className="flex-grow">
                                        <p className="font-semibold text-slate-800">{dep.name}</p>
                                        <p className="text-sm text-slate-500 mt-1">{dep.description || 'Không có mô tả'}</p>
                                        {
                                            // Prefer manager info from fetched `users` list if available, fallback to dep.manager_name
                                        }
                                        {(() => {
                                            const manager = users.find(u => u.id === dep.manager_id);
                                            const managerLabel = manager ? (manager.full_name || manager.username) : (dep.manager_name || null);
                                            if (managerLabel) {
                                                return (
                                                    <div className="flex items-center text-xs text-blue-600 mt-2">
                                                        <User size={14} className="mr-1.5" />
                                                        <span className="font-medium">Phụ trách: {managerLabel}</span>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        })()}
                                    </div>
                                </div>
                                {canManage && (
                                    <div className="flex gap-2 self-start sm:self-center">
                                        <button onClick={() => handleOpenEditModal(dep)} className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-100 rounded-full">
                                            <Edit size={18} />
                                        </button>
                                        <button onClick={() => handleOpenDeleteModal(dep)} className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-100 rounded-full">
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                )}
                            </li>
                        )) : (
                             !loading && <p className="text-center py-10 text-slate-500">Chưa có phòng ban nào được tạo.</p>
                        )}
                    </ul>
                </div>
                <Pagination 
                    currentPage={pagination.currentPage}
                    totalPages={pagination.totalPages}
                    onPageChange={(page) => fetchDepartments(page)}
                    useTextButtons={true}
                    summary={{ total: pagination.totalItems }}
                    summaryLabel="Số lượng phòng ban"
                />
            </div>

            {canManage && (
                <>
                    <DepartmentModal 
                        isOpen={isModalOpen}
                        onClose={() => setIsModalOpen(false)}
                        onSuccess={() => handleSuccess(modalMode === 'create' ? 'Tạo phòng ban thành công!' : 'Cập nhật thành công!')}
                        mode={modalMode}
                        departmentData={selectedDepartment}
                        users={users}
                    />
                    <DeleteConfirmationModal
                        isOpen={isDeleteModalOpen}
                        onClose={() => setIsDeleteModalOpen(false)}
                        onConfirm={handleDelete}
                        title="Xác nhận xóa"
                        message={`Bạn có chắc chắn muốn xóa phòng ban "${selectedDepartment?.name}"? Hành động này không thể khôi phục.`}
                    />
                </>
            )}
        </>
    );
};

export default DepartmentsPage;